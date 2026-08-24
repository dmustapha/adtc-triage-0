import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const outputPath = process.argv[2];
if (!outputPath) throw new Error("usage: freeze-manifest <output.json>");

const paths = {
  canonicalModel: "config/canonical-model.json",
  profilerPolicy: "config/profiler-prompt-policy.json",
  contract: "config/medpsy-raw-profiler-v2/contract.json",
  framingAdapter: "scripts/medpsy-shared-runtime-v2/json-framing.ts",
  evaluator: "scripts/medpsy-raw-profiler-v2/evaluate.ts",
  manifestProducer: "scripts/medpsy-raw-profiler-v2/freeze-manifest.ts"
} as const;
const entries = await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await readFile(path)] as const));
const bytes = Object.fromEntries(entries) as Record<keyof typeof paths, Buffer>;
const sha256 = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
const contract = JSON.parse(bytes.contract.toString("utf8"));
const canonical = JSON.parse(bytes.canonicalModel.toString("utf8"));

if (contract.namespace !== "medpsy-raw-profiler-v2" || canonical.sha256 !== contract.candidate.sha256) throw new Error("raw/profiler identity drift");
if (contract.claims.productSafety || contract.claims.dangerOwnership || contract.claims.qvacProductBehavior) throw new Error("raw/profiler claim boundary drift");
const manifest = {
  schemaVersion: 2,
  namespace: contract.namespace,
  evidenceTier: contract.evidenceTier,
  candidate: contract.candidate,
  runtime: contract.runtime,
  commands: contract.commands,
  schemas: contract.schemas,
  requiredRowHashes: contract.requiredRowHashes,
  thresholds: contract.thresholds,
  claims: contract.claims,
  forbiddenArtifactSuffixes: contract.forbiddenArtifactSuffixes,
  sourceHashes: Object.fromEntries(entries.map(([key, value]) => [key, sha256(value)])),
  notEvaluated: ["dangerOwnership", "productSafety", "qvacProductBehavior"],
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
console.log(`froze MedPsy raw/profiler v2 manifest: ${outputPath}`);
