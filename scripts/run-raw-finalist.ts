import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { promisify } from "node:util";

const [candidateId, lineagePath, outputPath] = process.argv.slice(2);
if (!candidateId || !lineagePath || !outputPath) throw new Error("usage: run-raw-finalist <candidate> <lineage-evidence> <raw-output>");
let lineage: any;
try { lineage = JSON.parse(await readFile(lineagePath, "utf8")); } catch { throw new Error("training-lineage prerequisite is not a verified pass"); }
if (lineage.status !== "pass" || lineage.result?.reviewed !== true) throw new Error("training-lineage prerequisite is not a verified pass");
if (lineage.model?.candidateId !== candidateId) throw new Error("training-lineage candidate does not match raw finalist");
const finalists = JSON.parse(await readFile("config/model-finalists.json", "utf8"));
const model = finalists[candidateId];
if (!model) throw new Error(`unknown finalist: ${candidateId}`);
const modelPath = `model/${candidateId}.gguf`;
const hash = createHash("sha256"); for await (const chunk of createReadStream(modelPath)) hash.update(chunk);
if ((await stat(modelPath)).size !== model.bytes || hash.digest("hex") !== model.sha256) throw new Error("raw finalist GGUF identity mismatch");
const corpus = JSON.parse(await readFile("config/finalist-corpus.json", "utf8"));
const cases = [...corpus.splits.pediatricHoldout, ...corpus.splits.generalMedicalHoldout];
const run = promisify(execFile);
const rows = [];
for (const item of cases) {
  const args = ["-m", modelPath, "-t", "4", "-ngl", "0", "-c", "2048", "-n", "128", "--temp", "0", "--no-display-prompt", "--jinja", "--single-turn", "-p", item.prompt];
  console.error(`START raw case ${item.id}`);
  const result = await run("llama-cli", args, { maxBuffer: 4_000_000, timeout: 120_000, killSignal: "SIGKILL" });
  rows.push(JSON.stringify({ candidateId, caseId: item.id, command: ["llama-cli", ...args], rawStdout: result.stdout, rawStderr: result.stderr }));
  console.error(`COMPLETE raw case ${item.id}`);
}
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, rows.join("\n") + "\n", { flag: "wx" });
console.log(`captured ${rows.length} raw responses for ${candidateId}`);
