import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import assert from "node:assert/strict";

import { bindCompletionAbort } from "../src/qvac/engine.js";
import { InferenceQueue } from "../src/qvac/inference-queue.js";

test("debug: aborting a completion targets its exact QVAC request ID", async () => {
  const controller = new AbortController();
  const cancelled: string[] = [];
  const unbind = bindCompletionAbort(controller.signal, "request-123", async (requestId) => {
    cancelled.push(requestId);
  });

  controller.abort();
  await delay(0);
  unbind();
  assert.deepEqual(cancelled, ["request-123"]);
});

test("debug: response timeout never releases the single-inference queue early", async () => {
  const queue = new InferenceQueue({ maxPending: 1 });
  let releaseFirst!: () => void;
  const firstWork = new Promise<void>((resolve) => { releaseFirst = resolve; });
  const firstResponse = queue.submit("debug", "triage", () => firstWork, {
    deadlineMs: 5,
    label: "first",
  }).promise;

  await assert.rejects(firstResponse, /first timed out/);

  let secondStarted = false;
  const secondResponse = queue.submit("debug", "triage", async () => {
    secondStarted = true;
  }, { deadlineMs: 1_000, label: "second" }).promise;
  await delay(20);
  assert.equal(secondStarted, false, "timed-out work must continue owning the queue");

  releaseFirst();
  await secondResponse;
  assert.equal(secondStarted, true);
});
