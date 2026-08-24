import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { promisify } from "node:util";
import { normalizeJsonStdout } from "../medpsy-shared-runtime-v2/json-framing.js";

const [inputPath, manifestPath, outputPath] = process.argv.slice(2);
if (!inputPath || !manifestPath || !outputPath) {
  throw new Error("usage: run-raw <input.json> <producer-manifest.json> <output.json>");
}

const contract = JSON.parse(await readFile("config/medpsy-raw-profiler-v2/contract.json", "utf8"));
const canonical = JSON.parse(await readFile("config/canonical-model.json", "utf8"));
const manifestBytes = await readFile(manifestPath);
const inputBytes = await readFile(inputPath);
const input = JSON.parse(inputBytes.toString("utf8"));
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

if (JSON.stringify(canonical) === "{}" || canonical.sha256 !== contract.candidate.sha256) {
  throw new Error("canonical/raw contract identity drift");
}
const modelDigest = createHash("sha256");
for await (const chunk of createReadStream(canonical.path)) modelDigest.update(chunk);
if ((await stat(canonical.path)).size !== contract.candidate.bytes || modelDigest.digest("hex") !== contract.candidate.sha256) {
  throw new Error("GGUF identity mismatch");
}

type Prompt = { id: string; text: string };
function promptsFrom(value: any): Prompt[] {
  if (Array.isArray(value.test_prompts)) {
    return value.test_prompts.map((item: any) => ({ id: String(item.prompt_id), text: String(item.prompt) }));
  }
  if (Array.isArray(value.cases)) {
    return value.cases.map((item: any) => ({ id: String(item.id), text: String(item.request?.caseText ?? item.prompt ?? "") }));
  }
  throw new Error("input has no supported prompt collection");
}

function rawPrompt(text: string): string {
  return "Answer the request faithfully without diagnosis or prescription. Emit exactly one JSON object " +
    "with one string field named response and no other text. REQUEST:\n" + text;
}

const run = promisify(execFile);
const rows = [];
for (const item of promptsFrom(input)) {
  const prompt = rawPrompt(item.text);
  const args = [
    "-m", canonical.path, "-t", "4", "-ngl", "0", "-c", "2048", "-n", "128",
    "--temp", "0", "--jinja", "--single-turn", "-p", prompt,
  ];
  const result = await run("llama-cli", args, { timeout: 120_000, killSignal: "SIGKILL", maxBuffer: 1_000_000 });
  const normalized = normalizeJsonStdout(result.stdout);
  rows.push({
    caseId: item.id,
    promptSha256: sha256(prompt),
    command: ["llama-cli", ...args],
    rawStdout: normalized.rawStdout,
    normalizedPayload: normalized.normalizedPayload,
    rawSha256: sha256(normalized.rawStdout),
    normalizedSha256: sha256(normalized.normalizedPayload),
    rawStderrSha256: sha256(result.stderr),
  });
}

const evidence = {
  schemaVersion: 2,
  namespace: contract.namespace,
  evidenceTier: contract.evidenceTier,
  manifestSha256: sha256(manifestBytes),
  candidate: contract.candidate,
  runtime: { name: contract.runtime.name, revision: contract.runtime.revision },
  inputSha256: sha256(inputBytes),
  rows,
  artifacts: ["producer-manifest.json", "raw-calibration.json", "calibration-evaluation.json", "raw-profiler.json", "profiler-evaluation.json", "hashes.sha256"],
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx" });
console.log(`captured ${rows.length} raw/profiler rows`);
