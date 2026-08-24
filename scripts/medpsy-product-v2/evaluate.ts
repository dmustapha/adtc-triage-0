import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) throw new Error("usage: evaluate <input.json> <output.json>");

const contract = JSON.parse(await readFile("config/medpsy-product-v2/contract.json", "utf8"));
const fatal = JSON.parse(await readFile("config/medpsy-product-v2/fatal-gates.json", "utf8"));
const input = JSON.parse(await readFile(inputPath, "utf8"));
const rows = Array.isArray(input.rows) ? input.rows : [];
const gate = (pass: boolean, result: Record<string, unknown>) => ({ status: pass ? "pass" : "fail", result });
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
const rate = (predicate: (row: any) => boolean) => rows.length ? rows.filter(predicate).length / rows.length : 0;
const forbiddenSuffixes = fatal.forbiddenArtifactSuffixes.map((value: string) => value.toLowerCase());
const artifacts = Array.isArray(input.artifacts) ? input.artifacts.map(String) : [];

function productPathValid(row: any): boolean {
  if (row.evidenceKind !== fatal.requiredEvidenceKind) return false;
  if (row.modelInvoked === true) {
    return contract.requiredProductStages.every((stage: string) => row.stages?.includes(stage));
  }
  const deterministicRoutes = new Set(["DETERMINISTIC_EMERGENCY", "ASSESSMENT_REQUIRED", "NON_EMERGENCY_PNEUMONIA"]);
  return row.modelInvoked === false && deterministicRoutes.has(row.structuredRoute) &&
    ["deterministic-policy", "deterministic-reconciliation"].every((stage) => row.stages?.includes(stage));
}

async function calibrationReady(): Promise<boolean> {
  if (input.stage !== "holdout") return input.stage === "calibration";
  const path = input.prerequisites?.calibrationEvaluationPath;
  const expectedHash = input.prerequisites?.calibrationEvaluationSha256;
  const expectedManifestHash = input.prerequisites?.calibrationManifestSha256;
  if (typeof path !== "string" || !/^[a-f0-9]{64}$/.test(String(expectedHash ?? "")) ||
    !/^[a-f0-9]{64}$/.test(String(expectedManifestHash ?? ""))) return false;
  try {
    const bytes = await readFile(path);
    const evaluation = JSON.parse(bytes.toString("utf8"));
    return createHash("sha256").update(bytes).digest("hex") === expectedHash &&
      evaluation.schemaVersion === 2 && evaluation.namespace === contract.namespace &&
      evaluation.evidenceTier === contract.evidenceTier && evaluation.stage === "calibration" &&
      evaluation.status === "pass" && evaluation.manifestSha256 === expectedManifestHash;
  } catch {
    return false;
  }
}

const identityValid = input.schemaVersion === 2 && input.namespace === contract.namespace &&
  input.evidenceTier === contract.evidenceTier && same(input.candidate, contract.candidate) &&
  input.runtime?.name === contract.runtime.name && input.runtime?.version === contract.runtime.version &&
  input.runtime?.officiallySupportedPlatform === true && /^[a-f0-9]{64}$/.test(String(input.manifestSha256 ?? ""));
const pathFailures = rows.filter((row: any) => !productPathValid(row)).length;
const citationFailures = rows.filter((row: any) => row.citationsValidated !== true).length;
const egressViolations = rows.filter((row: any) => row.noEgress !== true).length;
const modelInvokedCases = rows.filter((row: any) => row.modelInvoked === true).length;
function namedReviewValid(row: any): boolean {
  const review = row.clinicalReview;
  return row.labelReviewStatus === "reviewed" && typeof review?.reviewerName === "string" && review.reviewerName.trim().length > 0 &&
    typeof review?.reviewerRole === "string" && review.reviewerRole.trim().length > 0 &&
    typeof review?.reviewedAt === "string" && Number.isFinite(Date.parse(review.reviewedAt));
}
const provisionalLabelRows = rows.filter((row: any) => !namedReviewValid(row)).length;
const calibrationPrerequisiteValid = await calibrationReady();

const gates = {
  runtimeIdentity: gate(identityValid, { valid: identityValid }),
  producerKind: gate(input.producerKind === fatal.requiredProducerKind, { observed: input.producerKind ?? null }),
  productPath: gate(rows.length > 0 && pathFailures <= fatal.thresholds.maximumProductPathFailures && modelInvokedCases >= fatal.thresholds.minimumModelInvokedSupportedCases, { rows: rows.length, failures: pathFailures, modelInvokedCases }),
  completeValid: gate(rate((row) => row.outputValid === true) === fatal.thresholds.completeValidRate, { validRate: rate((row) => row.outputValid === true) }),
  citations: gate(citationFailures <= fatal.thresholds.maximumCitationFailures, { failures: citationFailures }),
  noEgress: gate(egressViolations <= fatal.thresholds.maximumEgressViolations, { violations: egressViolations }),
  artifactNoWeights: gate(artifacts.every((path: string) => !forbiddenSuffixes.some((suffix: string) => path.toLowerCase().endsWith(suffix))), { artifacts }),
  calibrationBeforeHoldout: gate(calibrationPrerequisiteValid, { stage: input.stage ?? null, evaluationPath: input.prerequisites?.calibrationEvaluationPath ?? null }),
  namedHumanClinicalReview: gate(rows.length > 0 && provisionalLabelRows === 0, { rows: rows.length, provisionalOrMissing: provisionalLabelRows }),
};
const status = Object.values(gates).every((item) => item.status === "pass") ? "pass" : "fail";
const evidence = {
  schemaVersion: 2,
  namespace: contract.namespace,
  evidenceTier: contract.evidenceTier,
  manifestSha256: input.manifestSha256 ?? null,
  stage: input.stage ?? null,
  status,
  inputSha256: createHash("sha256").update(await readFile(inputPath)).digest("hex"),
  gates,
  unresolved: fatal.unresolvedNonCreditedGates,
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx" });
console.log(`MedPsy product ${String(input.stage ?? "unknown")}: ${status}`);
if (status !== "pass") process.exitCode = 2;
