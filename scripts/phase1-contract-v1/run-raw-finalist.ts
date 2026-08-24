import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { promisify } from "node:util";
import { assertCaseTextSafe, buildPrompt, candidateId as approvedCandidate, llamaArgs, revision } from "./contract.js";

const [candidateId, lineagePath, corpusPath, outputPath] = process.argv.slice(2);
if (!candidateId || !lineagePath || !corpusPath || !outputPath) throw new Error("usage: run-raw-finalist <candidate> <lineage> <corpus> <output>");
if (candidateId !== approvedCandidate) throw new Error("phase1 contract candidate is not approved");
const approvedCorpora = new Set([`config/${revision}/calibration-corpus.json`, "config/finalist-corpus.json"]);
if (!approvedCorpora.has(corpusPath)) throw new Error(`corpus is not an approved frozen ${revision} input`);
const corpusBytes = await readFile(corpusPath);
const corpus = JSON.parse(corpusBytes.toString("utf8"));
const cases = corpus.cases ?? [...corpus.splits.pediatricHoldout, ...corpus.splits.generalMedicalHoldout];
for (const item of cases) assertCaseTextSafe(item.prompt);
const lineage = JSON.parse(await readFile(lineagePath, "utf8"));
if (lineage.status !== "pass" || lineage.result?.reviewed !== true || lineage.model?.candidateId !== candidateId) throw new Error("verified matching lineage is required");
const model = JSON.parse(await readFile("config/model-finalists.json", "utf8"))[candidateId];
const modelPath = `model/${candidateId}.gguf`;
const hash = createHash("sha256");
for await (const chunk of createReadStream(modelPath)) hash.update(chunk);
if ((await stat(modelPath)).size !== model.bytes || hash.digest("hex") !== model.sha256) throw new Error("GGUF identity mismatch");
const run = promisify(execFile);
const rows: string[] = [];
for (const item of cases) {
  const prompt = await buildPrompt(item.prompt);
  const args = llamaArgs(modelPath, prompt);
  console.error(`START ${revision} case ${item.id}`);
  const result = await run("llama-cli", args, { maxBuffer: 1_000_000, timeout: 120_000, killSignal: "SIGKILL" });
  rows.push(JSON.stringify({ schemaVersion: 1, revision, candidateId, caseId: item.id,
    corpusSha256: createHash("sha256").update(corpusBytes).digest("hex"), promptSha256: createHash("sha256").update(prompt).digest("hex"),
    command: ["llama-cli", ...args], rawStdout: result.stdout, rawStderr: result.stderr }));
  console.error(`COMPLETE ${revision} case ${item.id}`);
}
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, rows.join("\n") + "\n", { flag: "wx" });
console.log(`captured ${rows.length} ${revision} raw responses for ${candidateId}`);
