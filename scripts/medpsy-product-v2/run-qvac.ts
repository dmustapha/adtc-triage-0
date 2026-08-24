import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { orchestrator } from "../../src/qvac/orchestrator.js";
import { guard } from "../../src/qvac/egress-guard.js";
import { readPerfRows } from "../../src/qvac/perf-logger.js";
import { StructuredDangerRequestSchema, TriageCardSchema } from "../../src/triage/schema.js";
import { evaluateDangerPolicy } from "../../src/triage/danger-observations.js";
import { makeStructuredDangerResult, runTriage, setTriageExecutionObserver } from "../../src/triage/triage.js";

const [stage, corpusPath, manifestPath, outputPath, calibrationEvaluationPath] = process.argv.slice(2);
if (!stage || !corpusPath || !manifestPath || !outputPath) {
  throw new Error("usage: run-qvac <calibration|holdout> <corpus.json> <producer-manifest.json> <output.json> [calibration-evaluation.json]");
}
const supportedPlatformEvidencePath = process.env.QVAC_SUPPORTED_PLATFORM_EVIDENCE;
if (!supportedPlatformEvidencePath) throw new Error("QVAC supported-platform evidence is required");
if (process.env.GITHUB_ACTIONS === "true") throw new Error("QVAC product evidence may not run in this GitHub Actions workflow");

const contract = JSON.parse(await readFile("config/medpsy-product-v2/contract.json", "utf8"));
const canonical = JSON.parse(await readFile("config/canonical-model.json", "utf8"));
const manifestBytes = await readFile(manifestPath);
const corpusBytes = await readFile(corpusPath);
const corpus = JSON.parse(corpusBytes.toString("utf8"));
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const supportedPlatformEvidenceBytes = await readFile(supportedPlatformEvidencePath);
const supportedPlatformEvidence = JSON.parse(supportedPlatformEvidenceBytes.toString("utf8"));
const supportedPlatformEvidenceSha256 = sha256(supportedPlatformEvidenceBytes);
if (supportedPlatformEvidence.status !== "pass" || supportedPlatformEvidence.qvacSdkVersion !== contract.runtime.version ||
  typeof supportedPlatformEvidence.platform !== "string" || !supportedPlatformEvidence.platform.trim()) {
  throw new Error("QVAC supported-platform evidence is invalid");
}

if (!contract.stageOrder.includes(stage)) throw new Error("invalid product evidence stage");
let calibrationPrerequisites: Record<string, string> | undefined;
if (stage === "holdout") {
  if (!calibrationEvaluationPath) throw new Error("calibration evaluation did not pass");
  const calibrationBytes = await readFile(calibrationEvaluationPath);
  const calibration = JSON.parse(calibrationBytes.toString("utf8"));
  const calibrationEvaluationSha256 = sha256(calibrationBytes);
  if (calibration.status !== "pass" || calibration.namespace !== contract.namespace || calibration.stage !== "calibration" ||
    calibration.manifestSha256 !== sha256(manifestBytes)) {
    throw new Error("calibration evaluation did not pass");
  }
  calibrationPrerequisites = {
    calibrationEvaluationPath,
    calibrationEvaluationSha256,
    calibrationManifestSha256: calibration.manifestSha256,
  };
}
const modelDigest = createHash("sha256");
for await (const chunk of createReadStream(canonical.path)) modelDigest.update(chunk);
if ((await stat(canonical.path)).size !== contract.candidate.bytes || modelDigest.digest("hex") !== contract.candidate.sha256) {
  throw new Error("GGUF identity mismatch");
}

function citationValid(card: any): boolean {
  const citations = [card.protocol_citation, ...(card.plan?.medicines ?? []).map((x: any) => x.citation),
    ...(card.plan?.supportive ?? []).map((x: any) => x.citation), ...(card.plan?.home_care ?? []).map((x: any) => x.citation),
    ...(card.plan?.return_now ?? []).map((x: any) => x.citation), card.plan?.follow_up?.citation, card.plan?.referral?.citation].filter(Boolean);
  return citations.length > 0 && citations.every((item: any) => String(item.doc ?? "").length > 0 && String(item.page ?? "").length > 0);
}

const rows = [];
let qvacContext: { medpsyId: string; embedId: string } | undefined;
try {
  for (const item of corpus.cases ?? []) {
    const parsed = item.inputSurface === "internal-reconciliation-fixture"
      ? item.request
      : StructuredDangerRequestSchema.parse({
        patientAge: item.request?.patientAge,
        dangerObservations: item.request?.dangerObservations,
      });
    const decision = evaluateDangerPolicy(parsed.patientAge, parsed.dangerObservations);
    const boundaries: string[] = [];
    const restore = setTriageExecutionObserver((boundary) => boundaries.push(boundary));
    const perfStart = readPerfRows().length;
    try {
      let result;
      if (decision.route === "QVAC") {
        if (!qvacContext) {
          qvacContext = {
            medpsyId: await orchestrator.getMedpsy("medpsy-product-v2"),
            embedId: await orchestrator.getEmbeddings("medpsy-product-v2"),
          };
          guard.arm(true);
        }
        result = await runTriage(item.request.caseText, qvacContext, { structuredDanger: decision });
      } else {
        result = makeStructuredDangerResult(decision);
      }
      const perf = readPerfRows().slice(perfStart);
      const modelInvoked = boundaries.includes("medpsy");
      const stages = modelInvoked
        ? contract.requiredProductStages
        : ["deterministic-policy", "deterministic-reconciliation", "source-bound-plan-assembly"];
      rows.push({
        caseId: item.id,
        evidenceKind: "real-product-execution",
        modelInvoked,
        structuredRoute: decision.route,
        stages,
        boundaryEvents: boundaries,
        invocationTelemetry: perf,
        retryAttempts: result.attempts,
        citationsValidated: citationValid(result.card),
        noEgress: guard.violations.length === 0,
        outputValid: TriageCardSchema.safeParse(result.card).success,
        classification: result.classification,
        retrieval: result.retrieval,
        labelReviewStatus: item.labelReviewStatus,
        clinicalReview: null,
      });
    } finally {
      restore();
    }
  }
} finally {
  guard.disarm();
  await orchestrator.shutdown();
}

const evidence = {
  schemaVersion: 2,
  namespace: contract.namespace,
  evidenceTier: "supported-platform-qvac-product",
  manifestSha256: sha256(manifestBytes),
  stage,
  producerKind: "production-qvac-orchestration",
  supportedPlatformEvidence: {
    platform: supportedPlatformEvidence.platform,
    sha256: supportedPlatformEvidenceSha256,
  },
  candidate: contract.candidate,
  runtime: { ...contract.runtime, officiallySupportedPlatform: true },
  corpusSha256: sha256(corpusBytes),
  rows,
  artifacts: ["producer-manifest.json", `raw/product-${stage}.json`, `${stage}-evaluation.json`],
  prerequisites: calibrationPrerequisites,
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx" });
console.log(`captured ${rows.length} supported-platform QVAC product rows`);
