import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";

import {
  InferenceQueue,
  JobCancelledError,
  JobDisconnectedError,
  JobTimedOutError,
  QueueClosedError,
  QueueSaturatedError,
} from "../../src/qvac/inference-queue.js";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function eventually(assertion: () => void): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { assertion(); return; } catch { await delay(1); }
  }
  assertion();
}

test("clinical and prompt jobs share FIFO capacity, saturation, and fresh retry identity", async () => {
  let nextId = 0;
  const queue = new InferenceQueue({ maxPending: 1, idFactory: () => `matrix-job-${++nextId}` });
  const release = deferred<void>();
  const order: string[] = [];
  const clinical = queue.submit("owner", "triage", async () => { order.push("clinical"); await release.promise; return "clinical"; });
  const prompt = queue.submit("owner", "assist", async () => { order.push("prompt"); return "prompt"; });

  assert.throws(() => queue.submit("owner", "assist", async () => "overflow"), QueueSaturatedError);
  await eventually(() => assert.deepEqual(order, ["clinical"]));
  release.resolve();
  assert.equal(await clinical.promise, "clinical");
  assert.equal(await prompt.promise, "prompt");
  const retry = queue.submit("owner", "assist", async () => "retry");
  assert.equal(await retry.promise, "retry");
  assert.notEqual(retry.id, prompt.id);
  assert.deepEqual(order, ["clinical", "prompt"]);
});

test("queued and active cancellation abort only owned work and do not release native ownership early", async () => {
  const queue = new InferenceQueue({ maxPending: 2 });
  const nativeRelease = deferred<void>();
  let activeSignal: AbortSignal | undefined;
  const active = queue.submit("owner", "triage", async ({ signal }) => { activeSignal = signal; await nativeRelease.promise; });
  let queuedStarted = false;
  const queued = queue.submit("owner", "assist", async () => { queuedStarted = true; });

  assert.equal(queue.cancel(queued.id, "other").ok, false);
  assert.deepEqual(queue.cancel(queued.id, "owner"), { ok: true, state: "cancelled" });
  await assert.rejects(queued.promise, JobCancelledError);
  assert.deepEqual(queue.cancel(active.id, "owner"), { ok: true, state: "cancelled" });
  await assert.rejects(active.promise, JobCancelledError);
  assert.equal(activeSignal?.aborted, true);
  assert.equal(queuedStarted, false);
  assert.equal(queue.size, 1, "cancelled native work retains the one inference slot until settlement");
  nativeRelease.resolve();
  await eventually(() => assert.equal(queue.size, 0));
});

test("timeout suppresses late completion and starts queued retry only after native settlement", async () => {
  let fireDeadline!: () => void;
  const queue = new InferenceQueue({
    maxPending: 1,
    schedule: (callback) => { fireDeadline = callback; return 1; },
    clearScheduled: () => undefined,
  });
  const nativeRelease = deferred<string>();
  const timed = queue.submit("owner", "triage", () => nativeRelease.promise, { deadlineMs: 5, label: "assessment" });
  let retryStarted = false;
  const retry = queue.submit("owner", "assist", async () => { retryStarted = true; return "safe retry"; });

  fireDeadline();
  await assert.rejects(timed.promise, JobTimedOutError);
  assert.equal(retryStarted, false);
  assert.equal(queue.status(timed.id, "owner")?.state, "timed_out");
  nativeRelease.resolve("late result");
  assert.equal(await retry.promise, "safe retry");
  assert.equal(retryStarted, true);
});

test("disconnect blocks late publication and clean shutdown drains abort-aware work", async () => {
  const queue = new InferenceQueue({ maxPending: 1 });
  const release = deferred<void>();
  const publications: string[] = [];
  let latePublish: boolean | undefined;
  const disconnected = queue.submit("owner", "assist", async (context) => {
    context.publish(() => publications.push("early"));
    await release.promise;
    latePublish = context.publish(() => publications.push("late"));
  });

  await eventually(() => assert.deepEqual(publications, ["early"]));
  assert.equal(disconnected.disconnect(), true);
  await assert.rejects(disconnected.promise, JobDisconnectedError);
  release.resolve();
  await eventually(() => assert.equal(queue.status(disconnected.id, "owner")?.nativeSettled, true));
  assert.equal(latePublish, false);
  assert.deepEqual(publications, ["early"]);

  const abortAware = queue.submit("owner", "triage", ({ signal }) => new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true })));
  await eventually(() => assert.equal(queue.status(abortAware.id, "owner")?.state, "running"));
  const shutdown = await queue.shutdown(50);
  assert.deepEqual(shutdown, { drained: true, activeJobId: null, pendingCancelled: 0 });
  await assert.rejects(abortAware.promise, JobCancelledError);
  assert.throws(() => queue.submit("owner", "assist", async () => "closed"), QueueClosedError);
  assert.equal(queue.size, 0);
});
