import { createHash } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { createReadStream } from "node:fs";
import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { arch, hostname, platform, release } from "node:os";
import { dirname } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { createPromptRunner, PROMPT_SYSTEM_CONTRACT_VERSION } from "../../src/prompt/runner.js";
import { PINNED_LLAMA_REVISION, loadPromptContract } from "./harness.js";
import { buildProductCasePlan, evaluateProductExecution, productPromptSha256 } from "./product-harness.js";
import {
  captureOfficialAttempt,
  officialGreedySampling,
  officialServerCommand,
  selectOfficialCases,
  stopOfficialServer,
} from "./official-product-harness.js";

const [binaryPath, sourcePath, modelPath, outputPath] = process.argv.slice(2);
if (!binaryPath || !sourcePath || !modelPath || !outputPath) {
  throw new Error("usage: run-official-product <llama-server> <source> <model.gguf> <output.json>");
}
if ([sourcePath, modelPath, outputPath].some((value) => value.includes("32742482642"))) throw new Error("historical failed-run paths are forbidden");

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

async function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("port allocation failed"));
      server.close((error) => error ? reject(error) : resolvePort(address.port));
    });
  });
}

async function waitReady(port: number, child: ChildProcess): Promise<void> {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`llama-server exited ${child.exitCode}`);
    try { if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) return; } catch { /* loading */ }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error("llama-server startup timeout");
}

await access(binaryPath);
const git = promisify(execFile);
const revision = (await git("git", ["-C", sourcePath, "rev-parse", "HEAD"], { encoding: "utf8" })).stdout.trim();
if (revision !== PINNED_LLAMA_REVISION) throw new Error(`llama.cpp revision mismatch: ${revision}`);
const canonical = JSON.parse(await readFile("config/canonical-model.json", "utf8"));
const digest = createHash("sha256");
for await (const chunk of createReadStream(modelPath)) digest.update(chunk);
const modelStat = await stat(modelPath);
const modelSha256 = digest.digest("hex");
if (modelStat.size !== canonical.bytes || modelSha256 !== canonical.sha256) throw new Error("GGUF identity mismatch");

const contract = await loadPromptContract(process.cwd());
const prompts = contract.prompts.map((item) => ({ promptId: item.promptId, prompt: item.metadataPrompt }));
const plannedCases = buildProductCasePlan(prompts);
const caseLimit = process.env.OFFICIAL_CASE_LIMIT ? Number(process.env.OFFICIAL_CASE_LIMIT) : undefined;
if (caseLimit !== undefined && (!Number.isInteger(caseLimit) || caseLimit < 1)) throw new Error("OFFICIAL_CASE_LIMIT must be a positive integer");
const promptFilter = process.env.OFFICIAL_PROMPT_ID?.trim() || undefined;
const cases = selectOfficialCases(plannedCases, { promptId: promptFilter, limit: caseLimit });
if (cases.length === 0) throw new Error("official case selection is empty");
const port = await freePort();
const command = officialServerCommand(binaryPath, modelPath, port);
const child = spawn(command[0], command.slice(1), { stdio: ["ignore", "pipe", "pipe"] });
const serverStdout: Buffer[] = [];
const serverStderr: Buffer[] = [];
child.stdout.on("data", (chunk) => serverStdout.push(Buffer.from(chunk)));
child.stderr.on("data", (chunk) => serverStderr.push(Buffer.from(chunk)));

const traces: any[] = [];
const executions: any[] = [];
let startupError: string | null = null;
let gracefulShutdown = false;
let activeCaseId: string | undefined;
try {
  await waitReady(port, child);
  const completion = async (args: any) => {
    const body = {
      messages: args.history,
      max_tokens: args.generationParams?.predict,
      ...officialGreedySampling(),
      seed: 42,
      stream: false,
      chat_template_kwargs: { enable_thinking: false },
      ...(args.responseFormat ? { response_format: args.responseFormat } : {}),
    };
    const requestJson = JSON.stringify(body);
    const attempt = await captureOfficialAttempt({
      traces,
      base: { phase: args.phase, requestSha256: sha256(requestJson), caseId: activeCaseId },
      operation: async () => {
        const response = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
          method: "POST", headers: { "content-type": "application/json" }, body: requestJson,
          signal: AbortSignal.timeout(180_000),
        });
        const raw = await response.text();
        const parsed = JSON.parse(raw);
        const text = parsed.choices?.[0]?.message?.content;
        if (!response.ok || typeof text !== "string") throw new Error("official runtime completion failed");
        return { raw, parsed, text };
      },
      success: ({ raw, parsed, text }, durationMs) => ({
        responseSha256: sha256(raw),
        rawOutput: args.phase === "assist-extract" ? text : null,
        privateReasoningPreserved: false,
        durationMs,
        generatedTokens: parsed.usage?.completion_tokens ?? parsed.timings?.predicted_n ?? null,
        tokensPerSecond: parsed.timings?.predicted_per_second ?? null,
        error: null,
      }),
    });
    return { text: attempt.text, stopReason: attempt.parsed.choices?.[0]?.finish_reason === "length" ? "length" as const : "eos" as const };
  };
  const runner = createPromptRunner({ completion });
  for (const item of cases) {
    activeCaseId = item.caseId;
    process.stderr.write(`[official-product] START ${item.caseId}\n`);
    const traceStart = traces.length;
    const started = performance.now();
    const result = await runner.run({ prompt: item.prompt }, { modelId: "official-llama.cpp" });
    const execution = {
      ...item,
      promptSha256: productPromptSha256(item.prompt),
      result,
      done: result.status === "COMPLETED",
      durationMs: Math.round(performance.now() - started),
      traceIndexes: Array.from({ length: traces.length - traceStart }, (_, index) => traceStart + index),
    };
    executions.push(execution);
    process.stderr.write(`[official-product] END ${item.caseId} ${result.status} ${execution.durationMs}ms\n`);
  }
} catch (error) {
  startupError = error instanceof Error ? error.message : String(error);
} finally {
  gracefulShutdown = await stopOfficialServer(child);
}

let listenerClosed = false;
try { await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(1_000) }); } catch { listenerClosed = true; }
const evaluations = executions.map((execution) => ({ caseId: execution.caseId, ...evaluateProductExecution({ ...execution, caseKind: execution.caseKind }) }));
const status = !startupError && executions.length === cases.length && gracefulShutdown && listenerClosed
  && evaluations.every((item) => item.status === "pass") ? "pass" : "fail";
const evidence = {
  schemaVersion: 1,
  kind: "submitted-prompt-official-product-evidence",
  plane: "pinned official llama.cpp application workflow",
  status,
  historicalRawOneShotEvidence: "preserved-and-unchanged",
  runtime: { name: "llama.cpp", frontend: "llama-server", revision, cpuOnly: true, threads: 4, gpuLayers: 0 },
  workflow: { version: PROMPT_SYSTEM_CONTRACT_VERSION, reasonPredict: 1024, extractPredict: 512, maxExtractAttempts: 3, temperature: 0 },
  selection: { promptId: promptFilter ?? null, limit: caseLimit ?? null, selectedCaseIds: cases.map((item) => item.caseId) },
  host: { label: process.env.EVIDENCE_HOST?.trim() || `${hostname()}-${platform()}-${arch()}`, platform: platform(), arch: arch(), release: release() },
  model: { path: modelPath, bytes: modelStat.size, sha256: modelSha256 },
  server: { command, loopbackOnly: true, startupError, gracefulShutdown, listenerClosed, rawStdout: Buffer.concat(serverStdout).toString("utf8"), rawStderr: Buffer.concat(serverStderr).toString("utf8") },
  promptContract: prompts.map((item) => ({ ...item, sha256: productPromptSha256(item.prompt) })),
  executions,
  traces,
  evaluations,
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx" });
if (status !== "pass") process.exitCode = 2;
