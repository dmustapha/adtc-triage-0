import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { promisify } from "node:util";
import { buildPrompt, llamaArgs } from "../phase1-contract-v1/contract.js";

const [candidateId, corpusPath, outputPath] = process.argv.slice(2);
if (!candidateId || !corpusPath || !outputPath) throw new Error("usage: run-raw <candidate> <corpus> <output>");
if (candidateId !== "medpsy-1.7b-q4") throw new Error("canonical MedPsy candidate is required");

const approved = new Set(["config/phase1-contract-v1/calibration-corpus.json", "config/finalist-corpus.json", "metadata.json"]);
if (!approved.has(corpusPath)) throw new Error("corpus is not an approved frozen MedPsy input");
const canonical = JSON.parse(await readFile("config/canonical-model.json", "utf8"));
if (canonical.candidateId !== candidateId) throw new Error("canonical MedPsy identity drift");

const corpusBytes = await readFile(corpusPath);
const corpus = JSON.parse(corpusBytes.toString("utf8"));
const cases = corpus.test_prompts?.map((item: { prompt_id: string; prompt: string }) => ({ id: item.prompt_id, prompt: item.prompt })) ??
  corpus.cases ?? [...corpus.splits.pediatricHoldout, ...corpus.splits.generalMedicalHoldout];
const modelPath = canonical.path;
const modelHash = createHash("sha256");
for await (const chunk of createReadStream(modelPath)) modelHash.update(chunk);
if ((await stat(modelPath)).size !== canonical.bytes || modelHash.digest("hex") !== canonical.sha256) throw new Error("GGUF identity mismatch");

const directProfilerArgs = (prompt: string) => ["-m", modelPath, "-t", "4", "-ngl", "0", "-c", "2048", "-n", "128", "--temp", "0", "--jinja", "--single-turn", "-p", prompt];
const run = promisify(execFile);
const rows: string[] = [];
for (const item of cases as Array<{ id: string; prompt: string }>) {
  const profilerMode = corpusPath === "metadata.json";
  const prompt = profilerMode ? item.prompt : await buildPrompt(item.prompt);
  const args = profilerMode ? directProfilerArgs(prompt) : llamaArgs(modelPath, prompt);
  const result = await run("llama-cli", args, { maxBuffer: 1_000_000, timeout: 120_000, killSignal: "SIGKILL" });
  rows.push(JSON.stringify({ schemaVersion: 1, revision: "medpsy-shared-runtime-v1", candidateId, caseId: item.id,
    evidenceTier: process.env.EVIDENCE_TIER ?? "unlabeled-local", host: process.env.EVIDENCE_HOST ?? "unlabeled-local",
    corpusSha256: createHash("sha256").update(corpusBytes).digest("hex"), promptSha256: createHash("sha256").update(prompt).digest("hex"),
    chatTemplate: "embedded-gguf", command: ["llama-cli", ...args], rawStdout: result.stdout, rawStderr: result.stderr }));
}
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, rows.join("\n") + "\n", { flag: "wx" });
console.log(`captured ${rows.length} MedPsy raw responses`);
