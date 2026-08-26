import { createHash } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import { arch, hostname, platform, release } from "node:os";
import { promisify } from "node:util";
import {
  PINNED_LLAMA_REVISION,
  buildCasePlan,
  evaluateEvidenceRow,
  loadPromptContract,
  runEvidenceCase,
  writeEvidence,
  type CaseKind,
  type ExecutionResult,
} from "./harness.js";

const [binaryPath, sourcePath, modelPath, outputPath, additionalPath] = process.argv.slice(2);
if (!binaryPath || !sourcePath || !modelPath || !outputPath) {
  throw new Error("usage: run <llama-cli> <llama.cpp-source> <model.gguf> <output.json> [additional-cases.json]");
}
if ([sourcePath, modelPath, outputPath, additionalPath ?? ""].some((value) => value.includes("32742482642"))) {
  throw new Error("historical failed-run paths are forbidden");
}

await access(binaryPath);
const git = promisify(execFile);
const revision = (await git("git", ["-C", sourcePath, "rev-parse", "HEAD"], { encoding: "utf8" })).stdout.trim();
if (revision !== PINNED_LLAMA_REVISION) throw new Error(`llama.cpp revision mismatch: ${revision}`);

const canonical = JSON.parse(await readFile("config/canonical-model.json", "utf8"));
const modelDigest = createHash("sha256");
for await (const chunk of createReadStream(modelPath)) modelDigest.update(chunk);
const modelStat = await stat(modelPath);
const modelSha256 = modelDigest.digest("hex");
if (modelStat.size !== canonical.bytes || modelSha256 !== canonical.sha256) throw new Error("GGUF identity mismatch");

let additional: Array<{ caseId: string; kind: Exclude<CaseKind, "submitted-exact">; promptId: string; prompt: string }> = [];
if (additionalPath) {
  const parsed = JSON.parse(await readFile(additionalPath, "utf8"));
  if (!Array.isArray(parsed.cases)) throw new Error("additional cases must contain a cases array");
  additional = parsed.cases;
}
const promptContract = await loadPromptContract(process.cwd());
const plan = buildCasePlan(promptContract.prompts, additional);
const host = {
  label: process.env.EVIDENCE_HOST?.trim() || `${hostname()}-${platform()}-${arch()}`,
  platform: platform(),
  arch: arch(),
  release: release(),
};

function execute(command: string[]): Promise<ExecutionResult> {
  return new Promise((resolveExecution) => {
    const started = performance.now();
    const child = spawn(command[0], command.slice(1), { stdio: ["ignore", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let timedOut = false;
    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, 120_000);
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolveExecution({
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
        exitCode: code ?? (timedOut ? 124 : 1),
        timedOut,
        wallTimeMs: Math.round(performance.now() - started),
      });
    });
  });
}

const rows = [];
for (const item of plan) {
  rows.push(await runEvidenceCase({
    item,
    binaryPath,
    modelPath,
    modelSha256,
    modelBytes: modelStat.size,
    host,
    execute,
  }));
}
const evaluations = rows.map((row) => ({ caseId: row.caseId, ...evaluateEvidenceRow(row) }));
const status = evaluations.every((item) => item.status === "pass") ? "pass" : "fail";
await writeEvidence(outputPath, {
  schemaVersion: 1,
  kind: "submitted-prompt-evidence",
  status,
  promptContract: promptContract.prompts.map(({ promptId, sha256, metadataSha256, policySha256 }) => ({
    promptId,
    normalizedSha256: sha256,
    metadataSha256,
    policySha256,
  })),
  runtime: { name: "llama.cpp", revision: PINNED_LLAMA_REVISION, cpuOnly: true, threads: 4, gpuLayers: 0 },
  host,
  model: { path: modelPath, bytes: modelStat.size, sha256: modelSha256 },
  rows,
  evaluations,
});
if (status !== "pass") process.exitCode = 2;
