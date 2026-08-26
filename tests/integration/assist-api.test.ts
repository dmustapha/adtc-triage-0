import assert from "node:assert/strict";
import test from "node:test";

import { InferenceQueue } from "../../src/qvac/inference-queue.js";
import { createApp } from "../../src/server.js";

function parseSse(text: string) {
  return text.split("\n\n").filter(Boolean).map((block) => ({
    event: block.match(/^event: (.+)$/m)?.[1], data: JSON.parse(block.match(/^data: (.+)$/m)?.[1] ?? "{}"),
  }));
}

async function fixture(run: (input: unknown, options: any) => Promise<any>, queue?: InferenceQueue, overrides: Record<string, unknown> = {}) {
  const selectedQueue = queue ?? new InferenceQueue({
    maxPending: 1,
    idFactory: (() => { let id = 0; return () => `job-${++id}`; })(),
  });
  const app = createApp({
    supervisedWorkflow: { assess: async () => ({ reviewState: "UNAVAILABLE" }) },
    promptRunner: { run }, confirmationStore: { consume: () => ({ ok: false, reason: "NOT_FOUND" }) },
    projectReferenceActions: () => ({ referenceActions: null, doseState: { status: "NOT_APPLICABLE", missingFields: [] } }),
    inferenceQueue: selectedQueue,
    sessionOwner: (request: any) => request.headers["x-test-owner"] ?? "local-owner",
    ...overrides,
  } as any);
  const server = await new Promise<any>((resolve) => { const listening = app.listen(0, () => resolve(listening)); });
  return { base: `http://127.0.0.1:${server.address().port}`, server, queue: selectedQueue };
}

const assist = (base: string, prompt: string, init: RequestInit = {}) => fetch(`${base}/assist`, {
  method: "POST", headers: { "Content-Type": "application/json", ...init.headers }, body: JSON.stringify({ prompt }), ...init,
});

test("/assist emits job, stage, answer, done and rejected, done in exact order", async (t) => {
  let rejected = false;
  const f = await fixture(async () => rejected
    ? { status: "REJECTED", answer: null, reason: "Unsafe output.", validation: { passed: false, categories: ["MALFORMED"] } }
    : { status: "COMPLETED", answer: "Safe answer.", uncertainty: [], limitations: [], validation: { passed: true, categories: [] } });
  t.after(() => f.server.close());
  assert.deepEqual(parseSse(await (await assist(f.base, "Summarize this.")).text()).map((item) => item.event), ["job", "stage", "answer", "done"]);
  rejected = true;
  assert.deepEqual(parseSse(await (await assist(f.base, "Summarize this.")).text()).map((item) => item.event), ["job", "stage", "rejected", "done"]);
});

test("DELETE /jobs/:id enforces ownership and terminal behavior", async (t) => {
  let release!: () => void;
  const f = await fixture((_input, options) => new Promise((resolve) => {
    release = () => resolve(options.signal.aborted
      ? { status: "CANCELLED", answer: null, reason: "Cancelled.", validation: { passed: false, categories: [] } }
      : { status: "COMPLETED", answer: "late", uncertainty: [], limitations: [], validation: { passed: true, categories: [] } });
  }));
  t.after(() => { release?.(); f.server.close(); });
  const pending = assist(f.base, "Wait.");
  await new Promise((resolve) => setTimeout(resolve, 20));
  const status = f.queue.status("job-1", "local-owner");
  const jobId = status?.id;
  assert.ok(jobId);
  const wrong = await fetch(`${f.base}/jobs/${jobId}`, { method: "DELETE", headers: { "X-Test-Owner": "wrong-owner" } });
  assert.equal(wrong.status, 404);
  const cancelled = await fetch(`${f.base}/jobs/${jobId}`, { method: "DELETE" });
  assert.equal(cancelled.status, 200);
  release();
  const cancelledStream = parseSse(await (await pending).text());
  assert.equal(cancelledStream.find((item) => item.event === "error")?.data.code, "CANCELLED");
  assert.equal(cancelledStream.find((item) => item.event === "error")?.data.retryable, true);
  assert.equal(cancelledStream.at(-1)?.event, "done");
  assert.equal((await fetch(`${f.base}/jobs/${jobId}`, { method: "DELETE" })).status, 409);
});

test("queue saturation returns 429 with bounded retry guidance", async (t) => {
  const queue = new InferenceQueue({ maxPending: 0, idFactory: (() => { let id = 0; return () => `job-${++id}`; })() });
  let release!: () => void;
  const f = await fixture(() => new Promise((resolve) => { release = () => resolve({ status: "CANCELLED", answer: null, reason: "done", validation: { passed: false, categories: [] } }); }), queue);
  t.after(() => { release?.(); f.server.close(); });
  const active = assist(f.base, "First");
  await new Promise((resolve) => setTimeout(resolve, 20));
  const saturated = await assist(f.base, "Second");
  assert.equal(saturated.status, 429);
  assert.match(saturated.headers.get("retry-after") ?? "", /^\d+$/);
  assert.deepEqual(await saturated.json(), {
    error: "Local inference is busy. Please retry shortly.",
    code: "QUEUE_BUSY",
    retryable: true,
    retryAfterSeconds: 2,
  });
  release();
  await active;
});

test("closed queue rejects admission with a stable non-retryable code", async (t) => {
  const queue = new InferenceQueue();
  await queue.shutdown(0);
  const f = await fixture(async () => ({ status: "UNAVAILABLE", answer: null }), queue);
  t.after(() => f.server.close());
  const response = await assist(f.base, "Summarize this.");
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: "Local inference is shutting down. Restart the supported app before retrying.",
    code: "QUEUE_CLOSED",
    retryable: false,
  });
});

test("assist validation, body limits, and method contracts are fixed and model-free", async (t) => {
  let calls = 0;
  const f = await fixture(async () => { calls += 1; return { status: "UNAVAILABLE", answer: null }; });
  t.after(() => f.server.close());
  assert.equal((await assist(f.base, "x".repeat(4001))).status, 400);
  assert.equal((await assist(f.base, "facts\u202Ehidden instruction")).status, 400);
  const malformed = await fetch(`${f.base}/assist`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
  assert.equal(malformed.status, 400);
  const oversized = await fetch(`${f.base}/assist`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: "x".repeat(300_000) }) });
  assert.equal(oversized.status, 413);
  const method = await fetch(`${f.base}/assist`, { method: "PUT" });
  assert.equal(method.status, 405);
  assert.equal(method.headers.get("allow"), "POST");
  assert.equal(calls, 0);
});

test("disconnect aborts work and fixed failures leak no late answer, path, or SDK detail", async (t) => {
  let aborted = false;
  let release!: () => void;
  const f = await fixture((_input, options) => new Promise((resolve) => {
    options.signal.addEventListener("abort", () => { aborted = true; });
    release = () => resolve({ status: "COMPLETED", answer: "/Users/MAC secret RPCError @qvac late answer", uncertainty: [], limitations: [], validation: { passed: true, categories: [] } });
  }));
  t.after(() => { release?.(); f.server.close(); });
  const controller = new AbortController();
  const pending = assist(f.base, "Wait.", { signal: controller.signal }).catch(() => null);
  await new Promise((resolve) => setTimeout(resolve, 20));
  controller.abort();
  await new Promise((resolve) => setTimeout(resolve, 20));
  release();
  await pending;
  assert.equal(aborted, true);
});

test("unexpected assist failures return one fixed unavailable terminal payload", async (t) => {
  const f = await fixture(async () => { throw new Error("RPCError /Users/MAC/model.gguf fd-lock"); });
  t.after(() => f.server.close());
  const stream = parseSse(await (await assist(f.base, "Summarize this.")).text());
  assert.equal(stream.at(-1)?.event, "done");
  assert.equal(stream.filter((item) => ["answer", "rejected", "error"].includes(item.event ?? "")).length, 1);
  assert.equal(stream.find((item) => item.event === "error")?.data.code, "INFERENCE_FAILED");
  assert.equal(stream.find((item) => item.event === "error")?.data.retryable, false);
  assert.doesNotMatch(JSON.stringify(stream), /RPCError|\/Users\/|model\.gguf|fd-lock|@qvac/i);
});

test("assist deadline aborts native work and emits one fixed timeout-safe terminal", async (t) => {
  let aborted = false;
  const f = await fixture((_input, options) => new Promise((resolve) => {
    options.signal.addEventListener("abort", () => {
      aborted = true;
      setTimeout(() => resolve({ status: "COMPLETED", answer: "late secret", uncertainty: [], limitations: [], validation: { passed: true, categories: [] } }), 5);
    }, { once: true });
  }), undefined, { assistDeadlineMs: 10 });
  t.after(() => f.server.close());

  const stream = parseSse(await (await assist(f.base, "Wait for timeout.")).text());
  assert.equal(aborted, true);
  assert.deepEqual(stream.map((item) => item.event), ["job", "stage", "error", "done"]);
  assert.equal(stream.find((item) => item.event === "error")?.data.code, "TIMEOUT");
  assert.equal(stream.find((item) => item.event === "error")?.data.retryable, true);
  assert.match(stream.find((item) => item.event === "error")?.data.reason ?? "", /retry/i);
  assert.doesNotMatch(JSON.stringify(stream), /late secret|timed out after|JobTimedOut/i);
});

test("DELETE /jobs rejects malformed identifiers before queue lookup", async (t) => {
  const f = await fixture(async () => ({ status: "UNAVAILABLE", answer: null }));
  t.after(() => f.server.close());
  const response = await fetch(`${f.base}/jobs/${"x".repeat(129)}`, { method: "DELETE" });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Invalid job identifier." });
});
