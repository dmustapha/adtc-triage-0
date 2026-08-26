import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

const modulePath = "src/triage/continuation.ts";

const snapshot = {
  caseText: "Two year old with cough; breathing 40 per minute while calm.",
  patientAge: { value: 24, unit: "months" },
  dangerObservations: {
    cannotDrinkOrBreastfeed: "ABSENT", vomitsEverything: "ABSENT", convulsions: "ABSENT",
    lethargicOrUnconscious: "ABSENT", chestIndrawing: "ABSENT", stridorWhenCalm: "ABSENT",
    lowOxygenOrCentralCyanosis: "ABSENT",
  },
  respiratoryAssessment: {
    coughOrDifficultBreathing: "PRESENT", respiratoryRatePerMinute: 40,
    rateCountQuality: "ONE_MINUTE_WHILE_CALM",
  },
};

const binding = {
  recordHash: "record-hash-v1",
  outcome: "PROMPT_SUPERVISED_REVIEW" as const,
  matchedCriteria: ["FAST_BREATHING"],
  policyVersion: "restored-workflow-v1",
  owner: "browser-a",
};

test("continuation grants are opaque, copied, expiring, owner-bound, and one-use", async () => {
  assert.equal(existsSync(modulePath), true, `${modulePath} must exist`);
  if (!existsSync(modulePath)) return;
  const { ContinuationStore } = await import("../../src/triage/continuation.js");
  let now = 1_000;
  let sequence = 0;
  const store = new ContinuationStore({ now: () => now, randomToken: () => sequence++ ? "expiring-grant" : "opaque-grant", ttlMs: 100 });
  const grant = store.issue(binding, snapshot);
  assert.deepEqual(grant, { token: "opaque-grant", expiresAt: "1970-01-01T00:00:01.100Z" });
  assert.equal(grant.token.includes(binding.recordHash), false);
  snapshot.patientAge.value = 48;

  assert.deepEqual(store.consume(grant.token, "browser-b"), { ok: false, reason: "OWNER_MISMATCH" });
  const consumed = store.consume(grant.token, "browser-a");
  assert.equal(consumed.ok, true);
  if (consumed.ok) {
    assert.deepEqual(consumed.binding, binding);
    assert.equal((consumed.snapshot as typeof snapshot).patientAge.value, 24);
  }
  assert.deepEqual(store.consume(grant.token, "browser-a"), { ok: false, reason: "USED" });

  const expiring = store.issue({ ...binding, owner: "browser-c" }, snapshot);
  now = 1_100;
  assert.deepEqual(store.consume(expiring.token, "browser-c"), { ok: false, reason: "EXPIRED" });
  assert.deepEqual(store.consume("tampered", "browser-a"), { ok: false, reason: "NOT_FOUND" });
});

test("continuation capacity is bounded and a new store invalidates old grants", async () => {
  assert.equal(existsSync(modulePath), true, `${modulePath} must exist`);
  if (!existsSync(modulePath)) return;
  const { ContinuationStore } = await import("../../src/triage/continuation.js");
  let sequence = 0;
  const options = { randomToken: () => `grant-${++sequence}`, capacity: 1 };
  const store = new ContinuationStore(options);
  const grant = store.issue(binding, snapshot);
  assert.throws(() => store.issue({ ...binding, owner: "browser-b" }, snapshot), /capacity/i);
  const restarted = new ContinuationStore(options);
  assert.deepEqual(restarted.consume(grant.token, binding.owner), { ok: false, reason: "NOT_FOUND" });
});

test("used grants retain replay protection without exhausting active capacity", async () => {
  const { ContinuationStore } = await import("../../src/triage/continuation.js");
  let sequence = 0;
  const store = new ContinuationStore({ randomToken: () => `reusable-${++sequence}`, capacity: 1 });
  const first = store.issue(binding, snapshot);
  assert.equal(store.consume(first.token, binding.owner).ok, true);
  assert.doesNotThrow(() => store.issue({ ...binding, owner: "browser-b" }, snapshot));
  assert.deepEqual(store.consume(first.token, binding.owner), { ok: false, reason: "USED" });
});

test("a reserved grant can be released after retryable admission failure", async () => {
  const { ContinuationStore } = await import("../../src/triage/continuation.js");
  const store = new ContinuationStore({ randomToken: () => "retryable-token" });
  const grant = store.issue(binding, snapshot);
  assert.equal(store.reserve(grant.token, binding.owner).ok, true);
  assert.equal(store.release(grant.token, binding.owner), true);
  assert.equal(store.reserve(grant.token, binding.owner).ok, true);
  assert.equal(store.commit(grant.token, binding.owner), true);
  assert.deepEqual(store.reserve(grant.token, binding.owner), { ok: false, reason: "USED" });
});
