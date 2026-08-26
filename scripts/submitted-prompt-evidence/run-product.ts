import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { arch, hostname, platform, release } from "node:os";
import { dirname } from "node:path";

import { app, sharedInferenceQueue } from "../../src/server.js";
import { orchestrator } from "../../src/qvac/orchestrator.js";
import { PROMPT_SYSTEM_CONTRACT_VERSION } from "../../src/prompt/runner.js";
import { loadPromptContract, type CaseKind } from "./harness.js";
import {
  buildProductCasePlan,
  buildProductEvidence,
  parseSseTranscript,
  productPromptSha256,
  type ProductCase,
} from "./product-harness.js";

const [outputPath, additionalPath, caseMode = "all"] = process.argv.slice(2);
if (!outputPath) throw new Error("usage: run-product <output.json> [additional-cases.json]");
if ([outputPath, additionalPath ?? ""].some((value) => value.includes("32742482642"))) {
  throw new Error("historical failed-run paths are forbidden");
}

async function sha256File(path: string): Promise<string> {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest("hex");
}

async function closeServer(server: ReturnType<typeof app.listen>): Promise<void> {
  await new Promise<void>((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
}

async function listenerClosed(base: string): Promise<boolean> {
  try {
    await fetch(`${base}/health`, { signal: AbortSignal.timeout(1_000) });
    return false;
  } catch { return true; }
}

async function loadCases(): Promise<{ prompts: Array<{ promptId: string; prompt: string }>; cases: ProductCase[] }> {
  const contract = await loadPromptContract(process.cwd());
  const prompts = contract.prompts.map((item) => ({ promptId: item.promptId, prompt: item.metadataPrompt }));
  const exact = buildProductCasePlan(prompts);
  if (!additionalPath) return { prompts, cases: exact };
  const source = JSON.parse(await readFile(additionalPath, "utf8"));
  const additional = (source.cases ?? []).map((item: any) => ({
    caseId: String(item.caseId),
    caseKind: item.kind as Exclude<CaseKind, "submitted-exact">,
    promptId: String(item.promptId),
    prompt: String(item.prompt),
    repeat: null,
  }));
  if (!new Set(["all", "additional-only"]).has(caseMode)) throw new Error("case mode must be all or additional-only");
  return { prompts, cases: caseMode === "additional-only" ? additional : [...exact, ...additional] };
}

async function executeCase(base: string, item: ProductCase, cookie: string | null) {
  const requestBody = JSON.stringify({ prompt: item.prompt });
  const started = performance.now();
  const response = await fetch(`${base}/assist`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: requestBody,
    signal: AbortSignal.timeout(180_000),
  });
  const transcript = await response.text();
  const parsed = parseSseTranscript(transcript);
  return {
    caseId: item.caseId,
    caseKind: item.caseKind,
    promptId: item.promptId,
    repeat: item.repeat,
    prompt: item.prompt,
    promptSha256: productPromptSha256(item.prompt),
    request: { method: "POST", endpoint: "/assist", bodySha256: productPromptSha256(requestBody) },
    httpStatus: response.status,
    responseContentType: response.headers.get("content-type"),
    cookie: response.headers.get("set-cookie")?.split(";")[0] ?? cookie,
    jobId: parsed.jobId,
    stageKeys: parsed.stageKeys,
    terminalEvent: parsed.terminalEvent,
    result: parsed.result,
    done: parsed.done,
    rawTranscript: transcript,
    durationMs: Math.round(performance.now() - started),
  };
}

const canonical = JSON.parse(await readFile("config/canonical-model.json", "utf8"));
const sdkPackage = JSON.parse(await readFile("node_modules/@qvac/sdk/package.json", "utf8"));
const modelStat = await stat(canonical.path);
const modelSha256 = await sha256File(canonical.path);
if (modelStat.size !== canonical.bytes || modelSha256 !== canonical.sha256) throw new Error("GGUF identity mismatch");

const { prompts, cases } = await loadCases();
const startedAt = new Date().toISOString();
const server = app.listen(0, "127.0.0.1");
await new Promise<void>((resolveReady, reject) => {
  server.once("listening", resolveReady);
  server.once("error", reject);
});
const address = server.address();
if (!address || typeof address === "string") throw new Error("failed to bind product evidence server");
const base = `http://127.0.0.1:${address.port}`;
const executions: any[] = [];
let cookie: string | null = null;
let runError: string | null = null;
try {
  for (const item of cases) {
    const execution = await executeCase(base, item, cookie);
    cookie = execution.cookie;
    executions.push(execution);
  }
} catch (error) {
  runError = error instanceof Error ? error.message : String(error);
} finally {
  await closeServer(server);
  await sharedInferenceQueue.shutdown(5_000);
  await orchestrator.shutdown();
}

const closed = await listenerClosed(base);
const workerClosed = orchestrator.residentRoles().length === 0;
const evidence = {
  ...buildProductEvidence({
    promptContract: prompts,
    executions,
    runtime: { sdkVersion: sdkPackage.version, workflowVersion: PROMPT_SYSTEM_CONTRACT_VERSION },
    model: { path: canonical.path, bytes: modelStat.size, sha256: modelSha256 },
    host: {
      label: process.env.EVIDENCE_HOST?.trim() || `${hostname()}-${platform()}-${arch()} Apple development host`,
      platform: platform(), arch: arch(), release: release(),
    },
    startedAt,
    finishedAt: new Date().toISOString(),
    listenerClosed: closed,
    workerClosed,
  }),
  executionContract: {
    command: process.argv,
    endpoint: "/assist",
    queue: "single-inference",
    reasonPredict: 1024,
    extractPredict: 512,
    maxExtractAttempts: 3,
    temperature: 0,
    rawReasoningPreserved: false,
  },
  runError,
};
if (runError) evidence.status = "fail";
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx" });
if (evidence.status !== "pass") process.exitCode = 2;
