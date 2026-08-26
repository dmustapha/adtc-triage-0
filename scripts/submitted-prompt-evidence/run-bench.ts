import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { arch, hostname, platform, release } from "node:os";
import { dirname } from "node:path";
import { buildBenchCommand, PINNED_LLAMA_REVISION } from "./harness.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const [binaryPath, sourcePath, modelPath, outputPath] = process.argv.slice(2);
if (!binaryPath || !sourcePath || !modelPath || !outputPath) {
  throw new Error("usage: run-bench <llama-bench> <llama.cpp-source> <model.gguf> <output.json>");
}
if ([sourcePath, modelPath, outputPath].some((value) => value.includes("32742482642"))) {
  throw new Error("historical failed-run paths are forbidden");
}
const git = promisify(execFile);
const revision = (await git("git", ["-C", sourcePath, "rev-parse", "HEAD"], { encoding: "utf8" })).stdout.trim();
if (revision !== PINNED_LLAMA_REVISION) throw new Error(`llama.cpp revision mismatch: ${revision}`);
const canonical = JSON.parse(await readFile("config/canonical-model.json", "utf8"));
const digest = createHash("sha256");
for await (const chunk of createReadStream(modelPath)) digest.update(chunk);
const modelStat = await stat(modelPath);
const modelSha256 = digest.digest("hex");
if (modelStat.size !== canonical.bytes || modelSha256 !== canonical.sha256) throw new Error("GGUF identity mismatch");

const command = buildBenchCommand(binaryPath, modelPath);
const started = performance.now();
const result = await new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolveResult) => {
  const child = spawn(command[0], command.slice(1), { stdio: ["ignore", "pipe", "pipe"] });
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
  child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
  child.on("close", (code) => resolveResult({
    stdout: Buffer.concat(stdout).toString("utf8"),
    stderr: Buffer.concat(stderr).toString("utf8"),
    exitCode: code ?? 1,
  }));
});
let rows: unknown = null;
try { rows = JSON.parse(result.stdout); } catch { /* raw output remains authoritative */ }
const evidence = {
  schemaVersion: 1,
  kind: "official-runtime-cpu-benchmark",
  status: result.exitCode === 0 && Array.isArray(rows) ? "pass" : "fail",
  runtime: { name: "llama.cpp", revision, cpuOnly: true, threads: 4, gpuLayers: 0 },
  host: {
    label: process.env.EVIDENCE_HOST?.trim() || `${hostname()}-${platform()}-${arch()}`,
    platform: platform(), arch: arch(), release: release(),
  },
  model: { path: modelPath, bytes: modelStat.size, sha256: modelSha256 },
  command,
  wallTimeMs: Math.round(performance.now() - started),
  rawStdout: result.stdout,
  rawStderr: result.stderr,
  rows,
  exitCode: result.exitCode,
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx" });
if (evidence.status !== "pass") process.exitCode = 2;
