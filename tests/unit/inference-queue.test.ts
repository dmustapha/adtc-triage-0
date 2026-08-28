import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";

import {
  InferenceQueue,
  JobCancelledError,
  JobDisconnectedError,
  JobTimedOutError,
  QueueClosedError,
  QueueRecoveryRequiredError,
  QueueSaturatedError,
} from "../../src/qvac/inference-queue.js";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function fakeScheduler() {
  let nextHandle = 0;
  const callbacks = new Map<number, () => void>();
  return {
    schedule(callback: () => void) {
      const handle = ++nextHandle;
      callbacks.set(handle, callback);
      return handle;
    },
    clearScheduled(handle: unknown) {
      callbacks.delete(handle as number);
    },
    fireAll() {
      const ready = [...callbacks.values()];
      callbacks.clear();
      for (const callback of ready) callback();
    },
  };
}

async function eventually(assertion: () => void): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      assertion();
      return;
    } catch {
      await delay(1);
    }
  }
  assertion();
}

test("runs jobs in strict FIFO order with at most one native job active", async () => {
  const queue = new InferenceQueue({ maxPending: 3 });
  const releases = [deferred<void>(), deferred<void>(), deferred<void>()];
  const events: string[] = [];
  let active = 0;
  let maximumActive = 0;

  const jobs = releases.map((release, index) => queue.submit("owner", "triage", async () => {
    events.push(`start-${index}`);
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await release.promise;
    active -= 1;
    events.push(`end-${index}`);
    return index;
  }));

  assert.deepEqual(jobs.map((job) => job.position), [0, 1, 2]);
  await eventually(() => assert.deepEqual(events, ["start-0"]));
  assert.equal(queue.status(jobs[0].id, "owner")?.position, 0);
  assert.equal(queue.status(jobs[1].id, "owner")?.position, 1);
  assert.equal(queue.status(jobs[2].id, "owner")?.position, 2);

  releases[0].resolve();
  assert.equal(await jobs[0].promise, 0);
  await eventually(() => assert.deepEqual(events, ["start-0", "end-0", "start-1"]));
  assert.equal(queue.status(jobs[2].id, "owner")?.position, 1);
  releases[1].resolve();
  assert.equal(await jobs[1].promise, 1);
  releases[2].resolve();
  assert.equal(await jobs[2].promise, 2);
  assert.equal(maximumActive, 1);
  assert.deepEqual(events, ["start-0", "end-0", "start-1", "end-1", "start-2", "end-2"]);
});

test("rejects saturation synchronously without enqueueing another job", async () => {
  const queue = new InferenceQueue({ maxPending: 1 });
  const firstRelease = deferred<void>();
  const first = queue.submit("owner", "triage", () => firstRelease.promise);
  const second = queue.submit("owner", "assist", async () => "second");

  assert.throws(
    () => queue.submit("owner", "assist", async () => "third"),
    QueueSaturatedError,
  );
  assert.equal(queue.size, 2);
  firstRelease.resolve();
  await first.promise;
  assert.equal(await second.promise, "second");
});

test("queued cancellation removes work before start and enforces ownership", async () => {
  const queue = new InferenceQueue({ maxPending: 2 });
  const release = deferred<void>();
  const first = queue.submit("one", "triage", () => release.promise);
  let secondStarted = false;
  const second = queue.submit("one", "assist", async () => {
    secondStarted = true;
    return "late";
  });

  assert.equal(queue.cancel(second.id, "other").ok, false);
  assert.equal(queue.status(second.id, "other"), null);
  assert.deepEqual(queue.cancel(second.id, "one"), { ok: true, state: "cancelled" });
  await assert.rejects(second.promise, JobCancelledError);
  release.resolve();
  await first.promise;
  assert.equal(secondStarted, false);
});

test("active cancellation aborts supported work but retains native ownership until settlement", async () => {
  const queue = new InferenceQueue({ maxPending: 2 });
  const nativeRelease = deferred<void>();
  let signal: AbortSignal | undefined;
  const first = queue.submit("owner", "triage", async (context) => {
    signal = context.signal;
    await nativeRelease.promise;
  });
  let secondStarted = false;
  const second = queue.submit("owner", "assist", async () => {
    secondStarted = true;
  });

  await eventually(() => assert.equal(queue.status(first.id, "owner")?.state, "running"));
  assert.deepEqual(queue.cancel(first.id, "owner"), { ok: true, state: "cancelled" });
  assert.equal(signal?.aborted, true);
  await assert.rejects(first.promise, JobCancelledError);
  await delay(10);
  assert.equal(secondStarted, false);
  nativeRelease.resolve();
  await second.promise;
  assert.equal(secondStarted, true);
});

test("disconnect suppresses publication and late terminal delivery", async () => {
  const queue = new InferenceQueue({ maxPending: 1 });
  const release = deferred<string>();
  const publications: string[] = [];
  let publishAfterDisconnect: boolean | undefined;
  const job = queue.submit("owner", "assist", async (context) => {
    assert.equal(context.publish(() => publications.push("early")), true);
    const result = await release.promise;
    publishAfterDisconnect = context.publish(() => publications.push("late"));
    return result;
  });

  await eventually(() => assert.deepEqual(publications, ["early"]));
  assert.equal(job.disconnect(), true);
  await assert.rejects(job.promise, JobDisconnectedError);
  release.resolve("answer");
  await eventually(() => assert.equal(queue.status(job.id, "owner")?.nativeSettled, true));
  assert.equal(publishAfterDisconnect, false);
  assert.deepEqual(publications, ["early"]);
});

test("deadline rejects the response but never releases native ownership early", async () => {
  const clock = fakeScheduler();
  const queue = new InferenceQueue({
    maxPending: 1,
    schedule: clock.schedule,
    clearScheduled: clock.clearScheduled,
  });
  const nativeRelease = deferred<void>();
  const first = queue.submit("owner", "triage", () => nativeRelease.promise, { deadlineMs: 5, label: "first" });
  let secondStarted = false;
  const second = queue.submit("owner", "assist", async () => {
    secondStarted = true;
  });

  clock.fireAll();
  await assert.rejects(first.promise, (error: unknown) => {
    assert.ok(error instanceof JobTimedOutError);
    assert.match(error.message, /first timed out after 5ms/);
    return true;
  });
  assert.equal(secondStarted, false);
  assert.equal(queue.status(first.id, "owner")?.state, "timed_out");
  nativeRelease.resolve();
  await second.promise;
  assert.equal(secondStarted, true);
});

test("a never-settling timed-out runner fails queued work and exposes restart-required admission", async () => {
  const clock = fakeScheduler();
  const queue = new InferenceQueue({
    maxPending: 1,
    nativeCancelGraceMs: 25,
    schedule: clock.schedule,
    clearScheduled: clock.clearScheduled,
  });
  const nativeRelease = deferred<void>();
  const active = queue.submit("owner", "triage", () => nativeRelease.promise, { deadlineMs: 5 });
  const pending = queue.submit("owner", "assist", async () => "must-not-run");

  clock.fireAll();
  await assert.rejects(active.promise, JobTimedOutError);
  clock.fireAll();
  await assert.rejects(pending.promise, QueueRecoveryRequiredError);
  assert.equal(queue.recoveryRequired, true);
  assert.throws(() => queue.submit("owner", "assist", async () => "blocked"), QueueRecoveryRequiredError);

  nativeRelease.resolve();
  await eventually(() => assert.equal(queue.recoveryRequired, false));
  assert.equal(await queue.submit("owner", "assist", async () => "recovered").promise, "recovered");
});

test("active cancellation of a never-settling runner enters recovery after native grace", async () => {
  const clock = fakeScheduler();
  const queue = new InferenceQueue({
    maxPending: 1,
    nativeCancelGraceMs: 25,
    schedule: clock.schedule,
    clearScheduled: clock.clearScheduled,
  });
  const active = queue.submit("owner", "triage", () => new Promise<void>(() => {}));
  const pending = queue.submit("owner", "assist", async () => "must-not-run");
  pending.promise.catch(() => {});

  await eventually(() => assert.equal(queue.status(active.id, "owner")?.state, "running"));
  assert.deepEqual(queue.cancel(active.id, "owner"), { ok: true, state: "cancelled" });
  await assert.rejects(active.promise, JobCancelledError);
  clock.fireAll();

  assert.equal(queue.recoveryRequired, true, "cancel must arm native-stall grace");
  await assert.rejects(pending.promise, QueueRecoveryRequiredError);
  assert.throws(() => queue.submit("owner", "assist", async () => "blocked"), QueueRecoveryRequiredError);
});

test("active disconnect of a never-settling runner enters recovery after native grace", async () => {
  const clock = fakeScheduler();
  const queue = new InferenceQueue({
    maxPending: 1,
    nativeCancelGraceMs: 25,
    schedule: clock.schedule,
    clearScheduled: clock.clearScheduled,
  });
  const active = queue.submit("owner", "assist", () => new Promise<void>(() => {}));
  const pending = queue.submit("owner", "triage", async () => "must-not-run");
  pending.promise.catch(() => {});

  await eventually(() => assert.equal(queue.status(active.id, "owner")?.state, "running"));
  assert.equal(active.disconnect(), true);
  await assert.rejects(active.promise, JobDisconnectedError);
  clock.fireAll();

  assert.equal(queue.recoveryRequired, true, "disconnect must arm native-stall grace");
  await assert.rejects(pending.promise, QueueRecoveryRequiredError);
  assert.throws(() => queue.submit("owner", "assist", async () => "blocked"), QueueRecoveryRequiredError);
});

test("abort-aware cancellation settles inside native grace without poisoning the queue", async () => {
  const clock = fakeScheduler();
  const queue = new InferenceQueue({
    maxPending: 1,
    nativeCancelGraceMs: 25,
    schedule: clock.schedule,
    clearScheduled: clock.clearScheduled,
  });
  const active = queue.submit("owner", "triage", ({ signal }) => new Promise<void>((resolve) => {
    signal.addEventListener("abort", () => resolve(), { once: true });
  }));
  const pending = queue.submit("owner", "assist", async () => "next");

  await eventually(() => assert.equal(queue.status(active.id, "owner")?.state, "running"));
  queue.cancel(active.id, "owner");
  await assert.rejects(active.promise, JobCancelledError);
  assert.equal(await pending.promise, "next");
  clock.fireAll();
  assert.equal(queue.recoveryRequired, false);
  assert.equal(await queue.submit("owner", "assist", async () => "healthy").promise, "healthy");
});

test("abort-aware disconnect settles inside native grace without poisoning the queue", async () => {
  const clock = fakeScheduler();
  const queue = new InferenceQueue({
    maxPending: 1,
    nativeCancelGraceMs: 25,
    schedule: clock.schedule,
    clearScheduled: clock.clearScheduled,
  });
  const active = queue.submit("owner", "assist", ({ signal }) => new Promise<void>((resolve) => {
    signal.addEventListener("abort", () => resolve(), { once: true });
  }));
  const pending = queue.submit("owner", "triage", async () => "next");

  await eventually(() => assert.equal(queue.status(active.id, "owner")?.state, "running"));
  active.disconnect();
  await assert.rejects(active.promise, JobDisconnectedError);
  assert.equal(await pending.promise, "next");
  clock.fireAll();
  assert.equal(queue.recoveryRequired, false);
  assert.equal(await queue.submit("owner", "triage", async () => "healthy").promise, "healthy");
});

test("publishes exactly one terminal notification even after late native rejection", async () => {
  const terminals: string[] = [];
  const clock = fakeScheduler();
  const queue = new InferenceQueue({
    maxPending: 1,
    onTerminal: (status) => terminals.push(status.state),
    schedule: clock.schedule,
    clearScheduled: clock.clearScheduled,
  });
  const native = deferred<void>();
  const job = queue.submit("owner", "triage", () => native.promise, { deadlineMs: 5 });

  clock.fireAll();
  await assert.rejects(job.promise, JobTimedOutError);
  native.reject(new Error("late failure"));
  await eventually(() => assert.equal(queue.status(job.id, "owner")?.nativeSettled, true));
  assert.deepEqual(terminals, ["timed_out"]);
});

test("a retry is a fresh submission with a fresh ID", async () => {
  let nextId = 0;
  const queue = new InferenceQueue({ idFactory: () => `job-${++nextId}` });
  const first = queue.submit("owner", "assist", async () => "first");
  await first.promise;
  const retry = queue.submit("owner", "assist", async () => "retry");
  await retry.promise;

  assert.equal(first.id, "job-1");
  assert.equal(retry.id, "job-2");
  assert.notEqual(retry.id, first.id);
});

test("duplicate generated IDs are retried instead of overwriting another owner's job", async () => {
  const ids = ["same", "same", "unique"];
  const queue = new InferenceQueue({ idFactory: () => ids.shift() ?? "fallback" });
  const first = queue.submit("owner-a", "assist", async () => "first");
  await first.promise;
  const second = queue.submit("owner-b", "assist", async () => "second");
  await second.promise;

  assert.equal(first.id, "same");
  assert.equal(second.id, "unique");
  assert.equal(queue.status(first.id, "owner-a")?.state, "completed");
  assert.equal(queue.status(second.id, "owner-b")?.state, "completed");
});

test("terminal status retention is bounded", async () => {
  let nextId = 0;
  const queue = new InferenceQueue({ idFactory: () => `job-${++nextId}`, maxRetained: 2 });
  for (let index = 0; index < 3; index += 1) {
    await queue.submit("owner", "assist", async () => index).promise;
  }

  assert.equal(queue.status("job-1", "owner"), null);
  assert.equal(queue.status("job-2", "owner")?.state, "completed");
  assert.equal(queue.status("job-3", "owner")?.state, "completed");
});

test("shutdown closes admission, cancels pending work, and reports an undrained active job", async () => {
  const queue = new InferenceQueue({ maxPending: 2 });
  const nativeRelease = deferred<void>();
  const active = queue.submit("owner", "triage", () => nativeRelease.promise);
  const pending = queue.submit("owner", "assist", async () => "never");
  const activeCancelled = assert.rejects(active.promise, JobCancelledError);
  const pendingCancelled = assert.rejects(pending.promise, JobCancelledError);

  const result = await queue.shutdown(5);
  assert.deepEqual(result, { drained: false, activeJobId: active.id, pendingCancelled: 1 });
  assert.throws(() => queue.submit("owner", "assist", async () => "closed"), QueueClosedError);
  await activeCancelled;
  await pendingCancelled;
  nativeRelease.resolve();
  await eventually(() => assert.equal(queue.status(active.id, "owner")?.nativeSettled, true));
});

test("shutdown reports drained when active abort-aware work settles inside grace", async () => {
  const queue = new InferenceQueue();
  const job = queue.submit("owner", "triage", ({ signal }) => new Promise<void>((resolve) => {
    signal.addEventListener("abort", () => resolve(), { once: true });
  }));
  await eventually(() => assert.equal(queue.status(job.id, "owner")?.state, "running"));

  const result = await queue.shutdown(50);
  assert.deepEqual(result, { drained: true, activeJobId: null, pendingCancelled: 0 });
  await assert.rejects(job.promise, JobCancelledError);
});
