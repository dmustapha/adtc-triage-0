import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { assertCaseTextSafe, candidateId, revision, runtimeArgs } from "./contract.js";

const outputPath = process.argv[2];
if (!outputPath) throw new Error("usage: freeze-manifest <output.json>");
const paths = {
  corpus: "config/finalist-corpus.json",
  rubric: "config/finalist-rubric.json",
  candidate: "evidence/finalists/replacement/olmo-2-1124-7b-instruct-q4-k-m-candidate.json",
  lineage: "evidence/finalists/replacement/olmo-2-1124-7b-instruct-q4-k-m-training-lineage.json",
  systemPrompt: `config/${revision}/system-prompt.txt`, extractionSchema: `config/${revision}/extraction.schema.json`,
  grammar: `config/${revision}/extraction.gbnf`, calibration: `config/${revision}/calibration-corpus.json`,
  expectations: `config/${revision}/evaluation-expectations.json`, fatalGates: `config/${revision}/fatal-gates.json`,
  llamaCliSource: `config/${revision}/llama-cli-source.json`,
  contract: `scripts/${revision}/contract.ts`, rawProducer: `scripts/${revision}/run-raw-finalist.ts`,
  evaluator: `scripts/${revision}/evaluate.ts`, manifestProducer: `scripts/${revision}/freeze-manifest.ts`,
  workflow: `.github/workflows/olmo2-7b-${revision}-evidence.yml`,
  attempt4Raw: "evidence/remote-run-32669387576/olmo2-7b-recovery-phase-1-32669387576-1/raw/olmo-2-1124-7b-instruct-q4-k-m-responses.jsonl",
  attempt4Review: "evidence/remote-run-32669387576/independent-raw-gate-review.json"
};
const bytes = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await readFile(path)]))) as Record<keyof typeof paths, Buffer>;
const digest = (value: Buffer) => createHash("sha256").update(value).digest("hex");
const corpus = JSON.parse(bytes.corpus.toString("utf8"));
const calibration = JSON.parse(bytes.calibration.toString("utf8"));
const evaluationIds = [...corpus.splits.pediatricHoldout, ...corpus.splits.generalMedicalHoldout].map((item: { id: string }) => item.id);
const calibrationIds = calibration.cases.map((item: { id: string }) => item.id);
const allCases = [...calibration.cases, ...corpus.splits.pediatricHoldout, ...corpus.splits.generalMedicalHoldout];
for (const item of allCases as Array<{ prompt: string }>) assertCaseTextSafe(item.prompt);
const expectedCalibrationCases = JSON.parse(bytes.fatalGates.toString("utf8")).applicableFatalGates.calibrationCompleteness.expectedCases;
if (calibrationIds.length !== expectedCalibrationCases || new Set(calibrationIds).size !== expectedCalibrationCases) throw new Error("calibration case set is not exact and unique");
if (new Set([...evaluationIds, ...calibrationIds]).size !== evaluationIds.length + calibrationIds.length) throw new Error("calibration/evaluation overlap");
const manifest = { schemaVersion: 1, revision, freezeRule: "all identities and producers frozen before revised inference", candidateId,
  llamaRevision: "c8ade30036139e32108fee53d8b7164dbfda4bee", runtimeArgs: [...runtimeArgs, "--jinja", "--single-turn"],
  llamaCliSource: JSON.parse(bytes.llamaCliSource.toString("utf8")),
  calibration: { cases: calibrationIds.length, idsSha256: digest(Buffer.from(JSON.stringify(calibrationIds))) },
  evaluation: { pediatricCases: corpus.splits.pediatricHoldout.length, generalMedicalCases: corpus.splits.generalMedicalHoldout.length,
    idsSha256: digest(Buffer.from(JSON.stringify(evaluationIds))) },
  historicalAttempt4: { rawSha256: digest(bytes.attempt4Raw), reviewSha256: digest(bytes.attempt4Review), disposition: "authoritative-bare-prompt-failure-preserved" },
  inputHashes: Object.fromEntries(Object.entries(bytes).map(([key, value]) => [key, digest(value)])),
  producers: {
    calibration: ["node", "--import", "tsx", `scripts/${revision}/run-raw-finalist.ts`, candidateId, `evidence/finalists/${revision}/training-lineage.json`, `config/${revision}/calibration-corpus.json`, `evidence/finalists/${revision}/raw/calibration.jsonl`],
    evaluation: ["node", "--import", "tsx", `scripts/${revision}/run-raw-finalist.ts`, candidateId, `evidence/finalists/${revision}/training-lineage.json`, "config/finalist-corpus.json", `evidence/finalists/${revision}/raw/evaluation.jsonl`]
  },
  unresolved: ["humanRubric", "targetLaptopResources"] };
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(manifest, null, 2) + "\n", { flag: "wx" });
console.log(`froze ${revision} manifest: ${outputPath}`);
