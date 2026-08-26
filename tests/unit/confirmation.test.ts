import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

const modulePath = "src/triage/confirmation.ts";

const binding = {
  recordHash: "record-hash-v1",
  classification: "PNEUMONIA",
  protocol: "IMCI" as const,
  citationKeys: ["imci:6:fast-breathing"],
  policyVersion: "restored-workflow-v1",
  owner: "browser-session-a",
};

test("issues an opaque, expiring token bound to every authority input", async () => {
  assert.equal(existsSync(modulePath), true, `${modulePath} must exist`);
  if (!existsSync(modulePath)) return;
  const { ConfirmationStore } = await import("../../src/triage/confirmation.js");
  const store = new ConfirmationStore({ now: () => 1_000, randomToken: () => "opaque-token", ttlMs: 500 });
  const grant = store.issue(binding);
  assert.deepEqual(grant, { token: "opaque-token", expiresAt: "1970-01-01T00:00:01.500Z" });
  assert.equal(grant.token.includes(binding.recordHash), false);
  assert.equal(grant.token.includes(binding.classification), false);

  const result = store.consume(grant.token, binding.owner, "CONFIRM", binding);
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.binding, binding);
});

test("confirmation and rejection are terminal one-use decisions", async () => {
  assert.equal(existsSync(modulePath), true, `${modulePath} must exist`);
  if (!existsSync(modulePath)) return;
  const { ConfirmationStore } = await import("../../src/triage/confirmation.js");
  let sequence = 0;
  const store = new ConfirmationStore({ randomToken: () => `token-${++sequence}` });

  for (const decision of ["CONFIRM", "REJECT"] as const) {
    const grant = store.issue(binding);
    assert.equal(store.consume(grant.token, binding.owner, decision, binding).ok, true);
    const replay = store.consume(grant.token, binding.owner, decision, binding);
    assert.deepEqual(replay, { ok: false, reason: "USED" });
    const opposite = decision === "CONFIRM" ? "REJECT" : "CONFIRM";
    assert.deepEqual(store.consume(grant.token, binding.owner, opposite, binding), { ok: false, reason: "USED" });
  }
});

test("token-only confirmation returns a private copied server-held payload", async () => {
  const { ConfirmationStore } = await import("../../src/triage/confirmation.js");
  const store = new ConfirmationStore({ randomToken: () => "payload-token" });
  const payload = { eligibility: { patientWeightKg: 12, confirmationState: "UNCONFIRMED" } };
  const grant = store.issue(binding, payload);
  (payload.eligibility as { patientWeightKg: number }).patientWeightKg = 99;
  const result = store.consume(grant.token, binding.owner, "CONFIRM");
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.payload, { eligibility: { patientWeightKg: 12, confirmationState: "UNCONFIRMED" } });
});

test("fails closed for expiry, wrong owner, tampering, and every binding mismatch", async () => {
  assert.equal(existsSync(modulePath), true, `${modulePath} must exist`);
  if (!existsSync(modulePath)) return;
  const { ConfirmationStore } = await import("../../src/triage/confirmation.js");
  let now = 1_000;
  let sequence = 0;
  const store = new ConfirmationStore({ now: () => now, randomToken: () => `opaque-${++sequence}`, ttlMs: 100 });

  assert.deepEqual(store.consume("tampered", binding.owner, "CONFIRM", binding), { ok: false, reason: "NOT_FOUND" });
  const wrongOwner = store.issue(binding);
  assert.deepEqual(store.consume(wrongOwner.token, "browser-session-b", "CONFIRM", binding), { ok: false, reason: "OWNER_MISMATCH" });

  const variants = [
    { ...binding, recordHash: "record-hash-v2" },
    { ...binding, classification: "SEVERE PNEUMONIA" },
    { ...binding, protocol: "mhGAP" as const },
    { ...binding, citationKeys: ["imci:7:other"] },
    { ...binding, policyVersion: "restored-workflow-v2" },
  ];
  for (const variant of variants) {
    const grant = store.issue(binding);
    assert.deepEqual(store.consume(grant.token, binding.owner, "CONFIRM", variant), { ok: false, reason: "BINDING_MISMATCH" });
  }

  const expired = store.issue(binding);
  now = 1_101;
  assert.deepEqual(store.consume(expired.token, binding.owner, "CONFIRM", binding), { ok: false, reason: "EXPIRED" });
});

test("capacity is bounded, expired entries are pruned, and a new store invalidates grants", async () => {
  assert.equal(existsSync(modulePath), true, `${modulePath} must exist`);
  if (!existsSync(modulePath)) return;
  const { ConfirmationStore } = await import("../../src/triage/confirmation.js");
  let now = 1_000;
  let sequence = 0;
  const options = { now: () => now, randomToken: () => `token-${++sequence}`, ttlMs: 100, capacity: 2 };
  const store = new ConfirmationStore(options);
  const first = store.issue(binding);
  store.issue({ ...binding, owner: "browser-session-b" });
  assert.throws(() => store.issue({ ...binding, owner: "browser-session-c" }), /capacity/i);
  now = 1_101;
  const replacement = store.issue({ ...binding, owner: "browser-session-c" });
  assert.equal(store.size, 1);
  store.invalidate(replacement.token);
  assert.equal(store.size, 0);
  store.issue(binding);
  store.clear();
  assert.equal(store.size, 0);

  const restarted = new ConfirmationStore(options);
  assert.deepEqual(restarted.consume(first.token, binding.owner, "CONFIRM", binding), { ok: false, reason: "NOT_FOUND" });
});

test("the published expiry instant is the first invalid instant", async () => {
  const { ConfirmationStore } = await import("../../src/triage/confirmation.js");
  let now = 1_000;
  const store = new ConfirmationStore({ now: () => now, ttlMs: 100, randomToken: () => "boundary" });
  store.issue(binding);
  now = 1_100;
  assert.deepEqual(store.consume("boundary", binding.owner, "CONFIRM", binding), { ok: false, reason: "EXPIRED" });
});
