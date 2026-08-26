import { createHash } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { createReadStream } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import { createServer } from "node:net";
import { arch, hostname, platform, release } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  PINNED_LLAMA_REVISION,
  buildCasePlan,
  buildServerCommand,
  buildServerRequest,
  decodeServerResponse,
  evaluateEvidenceRow,
  loadPromptContract,
  normalizeLineEndings,
  writeEvidence,
  type CaseKind,
} from "./harness.js";

const [binaryPath, sourcePath, modelPath, outputPath, additionalPath] = process.argv.slice(2);
if (!binaryPath || !sourcePath || !modelPath || !outputPath) {
  throw new Error("usage: run-server <llama-server> <llama.cpp-source> <model.gguf> <output.json> [additional-cases.json]");
}
const protectedPaths = [sourcePath, modelPath, outputPath, additionalPath ?? ""];
if (protectedPaths.some((value) => value.includes("32742482642"))) throw new Error("historical failed-run paths are forbidden");

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

async function findLoopbackPort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("failed to allocate loopback port"));
      server.close((error) => error ? reject(error) : resolvePort(address.port));
    });
  });
}

async function waitForHealth(port: number, child: ChildProcess): Promise<void> {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`llama-server exited during startup with ${child.exitCode}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return;
    } catch { /* server is still loading */ }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error("llama-server health timeout");
}

async function stopServer(child: ChildProcess): Promise<boolean> {
  if (child.exitCode !== null) return true;
  child.kill("SIGTERM");
  const closed = await Promise.race([
    new Promise<boolean>((resolveClose) => child.once("close", () => resolveClose(true))),
    new Promise<boolean>((resolveTimeout) => setTimeout(() => resolveTimeout(false), 15_000)),
  ]);
  if (closed) return true;
  child.kill("SIGKILL");
  await new Promise((resolveClose) => child.once("close", resolveClose));
  return false;
}

async function verifyClosed(port: number): Promise<boolean> {
  try {
    await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(1_000) });
    return false;
  } catch {
    return true;
  }
}

async function requestCompletion(port: number, rawPrompt: string) {
  const request = buildServerRequest(rawPrompt);
  const requestJson = JSON.stringify(request);
  const started = performance.now();
  const response = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: requestJson,
    signal: AbortSignal.timeout(120_000),
  });
  const rawResponse = await response.text();
  const decoded = decodeServerResponse(rawResponse);
  return { request, requestJson, rawResponse, decoded, status: response.status, wallTimeMs: Math.round(performance.now() - started) };
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

const contract = await loadPromptContract(process.cwd());
const plan = buildCasePlan(contract.prompts, additional);
const port = await findLoopbackPort();
const command = buildServerCommand(binaryPath, modelPath, port);
const child = spawn(command[0], command.slice(1), { stdio: ["ignore", "pipe", "pipe"] });
const serverStdout: Buffer[] = [];
const serverStderr: Buffer[] = [];
child.stdout.on("data", (chunk) => serverStdout.push(Buffer.from(chunk)));
child.stderr.on("data", (chunk) => serverStderr.push(Buffer.from(chunk)));

const rows: any[] = [];
let startupError: string | null = null;
let gracefulShutdown = false;
try {
  await waitForHealth(port, child);
  for (const item of plan) {
    const result = await requestCompletion(port, item.rawPrompt);
    rows.push({
      caseId: item.caseId,
      caseKind: item.kind,
      promptId: item.promptId,
      repeat: item.repeat,
      rawPrompt: item.rawPrompt,
      rawPromptSha256: sha256(item.rawPrompt),
      normalizedPromptSha256: sha256(normalizeLineEndings(item.rawPrompt)),
      request: result.request,
      requestSha256: sha256(result.requestJson),
      rawHttpResponse: result.rawResponse,
      rawHttpResponseSha256: sha256(result.rawResponse),
      rawStdout: result.decoded.text,
      reasoningChannel: result.decoded.reasoning,
      httpStatus: result.status,
      exitCode: result.status === 200 ? 0 : result.status,
      timedOut: false,
      performance: {
        wallTimeMs: result.wallTimeMs,
        generatedTokens: result.decoded.generatedTokens,
        tokensPerSecond: result.decoded.tokensPerSecond,
      },
    });
  }
} catch (error) {
  startupError = error instanceof Error ? error.message : String(error);
} finally {
  gracefulShutdown = await stopServer(child);
}

const evaluations = rows.map((row) => ({ caseId: row.caseId, ...evaluateEvidenceRow(row) }));
const listenerClosed = await verifyClosed(port);
const allCasesRan = rows.length === plan.length;
const status = !startupError && allCasesRan && gracefulShutdown && listenerClosed &&
  evaluations.every((item) => item.status === "pass") ? "pass" : "fail";

await writeEvidence(outputPath, {
  schemaVersion: 2,
  kind: "submitted-prompt-evidence",
  plane: "pinned official llama.cpp server",
  status,
  promptContract: contract.prompts.map(({ promptId, sha256: normalizedSha256, metadataSha256, policySha256 }) => ({
    promptId, normalizedSha256, metadataSha256, policySha256,
  })),
  runtime: { name: "llama.cpp", frontend: "llama-server", revision, cpuOnly: true, threads: 4, gpuLayers: 0 },
  host: { label: process.env.EVIDENCE_HOST?.trim() || `${hostname()}-${platform()}-${arch()}`, platform: platform(), arch: arch(), release: release() },
  model: { path: modelPath, bytes: modelStat.size, sha256: modelSha256 },
  server: {
    command,
    endpoint: `http://127.0.0.1:${port}`,
    loopbackOnly: true,
    startupError,
    gracefulShutdown,
    listenerClosed,
    rawStdout: Buffer.concat(serverStdout).toString("utf8"),
    rawStderr: Buffer.concat(serverStderr).toString("utf8"),
  },
  rows,
  evaluations,
});
if (status !== "pass") process.exitCode = 2;
