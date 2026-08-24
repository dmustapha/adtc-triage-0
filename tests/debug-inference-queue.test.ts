import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import assert from "node:assert/strict";

import { withInferenceDeadline } from "../src/server.js";

test("debug: response timeout never releases the single-inference queue early", async () => {
  let releaseFirst!: () => void;
  const firstWork = new Promise<void>((resolve) => { releaseFirst = resolve; });
  const firstResponse = withInferenceDeadline(() => firstWork, 5, "first");

  await assert.rejects(firstResponse, /first timed out/);

  let secondStarted = false;
  const secondResponse = withInferenceDeadline(async () => {
    secondStarted = true;
  }, 1_000, "second");
  await delay(20);
  assert.equal(secondStarted, false, "timed-out work must continue owning the queue");

  releaseFirst();
  await secondResponse;
  assert.equal(secondStarted, true);
});
