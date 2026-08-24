import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const outputPath = process.argv[2];
if (!outputPath) throw new Error("usage: freeze-manifest <output.json>");

const paths = {
  candidate: "config/canonical-model.json",
  licenseDecision: "config/model-license-decision.json",
  metadata: "metadata.json",
  productPolicy: "config/product-generation-policy.json",
  profilerPolicy: "config/profiler-prompt-policy.json",
  corpus: "config/finalist-corpus.json",
  calibration: "config/phase1-contract-v1/calibration-corpus.json",
  extractionSchema: "config/phase1-contract-v1/extraction.schema.json",
  grammar: "config/phase1-contract-v1/extraction.gbnf",
  expectations: "config/phase1-contract-v1/evaluation-expectations.json",
  fatalGates: "config/medpsy-shared-runtime/fatal-gates.json",
  reviewRubric: "config/medpsy-shared-runtime/review-rubric.json",
  rawProducer: "scripts/medpsy-shared-runtime/run-raw.ts",
  evaluator: "scripts/medpsy-shared-runtime/evaluate.ts",
  manifestProducer: "scripts/medpsy-shared-runtime/freeze-manifest.ts",
  workflow: ".github/workflows/medpsy-shared-runtime-evidence.yml"
} as const;

const entries = await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await readFile(path)] as const));
const bytes = Object.fromEntries(entries) as Record<keyof typeof paths, Buffer>;
const hash = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
const candidate = JSON.parse(bytes.candidate.toString("utf8"));
const license = JSON.parse(bytes.licenseDecision.toString("utf8"));
const corpus = JSON.parse(bytes.corpus.toString("utf8"));
const calibration = JSON.parse(bytes.calibration.toString("utf8"));
const gates = JSON.parse(bytes.fatalGates.toString("utf8"));

if (candidate.candidateId !== "medpsy-1.7b-q4" || candidate.sha256 !== "41ee947d9cce72ec657577219fd1798fabeabf0d832217fe23c9d6d3d18d5880") {
  throw new Error("canonical MedPsy identity drift");
}
if (license.status !== gates.applicableFatalGates.licenseDecision.requiredStatus) throw new Error("license decision status drift");
if (hash(bytes.corpus) !== gates.applicableFatalGates.untouchedHoldouts.corpusSha256) throw new Error("holdout corpus drift");

const calibrationIds = calibration.cases.map((item: { id: string }) => item.id);
const pediatricIds = corpus.splits.pediatricHoldout.map((item: { id: string }) => item.id);
const generalIds = corpus.splits.generalMedicalHoldout.map((item: { id: string }) => item.id);
const evaluationIds = [...pediatricIds, ...generalIds];
const overlap = calibrationIds.filter((id: string) => evaluationIds.includes(id));
if (calibrationIds.length !== 12 || new Set(calibrationIds).size !== 12) throw new Error("calibration set drift");
if (pediatricIds.length !== 50 || generalIds.length !== 50 || overlap.length) throw new Error("holdout split drift");

const manifest = {
  schemaVersion: 1,
  revision: "medpsy-shared-runtime-v1",
  freezeRule: "candidate, prompts, cases, gates, and producers frozen before inference; no tuning after holdout observation",
  candidate,
  llamaRevision: "c8ade30036139e32108fee53d8b7164dbfda4bee",
  chatTemplate: { source: "embedded-gguf", jinja: true, override: null },
  evidenceTier: "remote-ci-direct-llama.cpp",
  host: "github-actions-ubuntu-24.04",
  calibration: { cases: calibrationIds.length, idsSha256: hash(JSON.stringify(calibrationIds)) },
  evaluation: { pediatricCases: pediatricIds.length, generalMedicalCases: generalIds.length, idsSha256: hash(JSON.stringify(evaluationIds)) },
  calibrationEvaluationOverlap: overlap.length,
  inputHashes: Object.fromEntries(entries.map(([key, value]) => [key, hash(value)])),
  expectedArtifacts: ["producer-manifest.json", "raw/calibration.jsonl", "raw/evaluation.jsonl", "raw/profiler.jsonl", "calibration-evaluation.json", "evaluation.json", "hashes.sha256"],
  unresolved: ["humanClinicalReview", "physicalTargetLaptop"]
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(manifest, null, 2) + "\n", { flag: "wx" });
console.log(`froze MedPsy shared-runtime manifest: ${outputPath}`);
