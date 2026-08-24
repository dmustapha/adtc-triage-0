import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const outputPath = process.argv[2];
if (!outputPath) throw new Error("usage: freeze-manifest <output.json>");

const paths = {
  canonicalModel: "config/canonical-model.json",
  structuredDangerContract: "config/structured-danger-v1/contract.json",
  productPolicy: "config/product-generation-policy.json",
  contract: "config/medpsy-product-v2/contract.json",
  fatalGates: "config/medpsy-product-v2/fatal-gates.json",
  evaluator: "scripts/medpsy-product-v2/evaluate.ts",
  manifestProducer: "scripts/medpsy-product-v2/freeze-manifest.ts"
} as const;
const entries = await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await readFile(path)] as const));
const bytes = Object.fromEntries(entries) as Record<keyof typeof paths, Buffer>;
const sha256 = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
const contract = JSON.parse(bytes.contract.toString("utf8"));
const fatal = JSON.parse(bytes.fatalGates.toString("utf8"));
const canonical = JSON.parse(bytes.canonicalModel.toString("utf8"));

if (contract.namespace !== "medpsy-product-v2" || canonical.sha256 !== contract.candidate.sha256) throw new Error("product identity drift");
if (fatal.evidenceTier !== contract.evidenceTier) throw new Error("product evidence-tier drift");
const manifest = {
  schemaVersion: 2,
  namespace: contract.namespace,
  evidenceTier: contract.evidenceTier,
  candidate: contract.candidate,
  runtime: contract.runtime,
  commands: contract.commands,
  schemas: contract.schemas,
  thresholds: fatal.thresholds,
  calibrationBeforeHoldout: fatal.calibrationMustPassBeforeHoldout,
  unitFixturesAreFinalEvidence: fatal.unitFixturesAreFinalEvidence,
  noWeightArtifacts: true,
  forbiddenArtifactSuffixes: fatal.forbiddenArtifactSuffixes,
  historicalEvidence: contract.historicalEvidence,
  sourceHashes: Object.fromEntries(entries.map(([key, value]) => [key, sha256(value)])),
  unresolved: fatal.unresolvedNonCreditedGates,
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
console.log(`froze MedPsy product v2 manifest: ${outputPath}`);
