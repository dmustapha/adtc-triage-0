import assert from "node:assert/strict";
import test from "node:test";

import { InferenceQueue } from "../../src/qvac/inference-queue.js";
import { createApp } from "../../src/server.js";

const binding = {
  recordHash: "record-hash", classification: "PNEUMONIA", protocol: "IMCI" as const,
  citationKeys: ["WHO IMCI Chart Booklet (2014):6:PNEUMONIA"], policyVersion: "restored-workflow-v1", owner: "local-owner",
};

async function fixture(consume: (token: string, owner: string, decision: string) => any) {
  let projections = 0;
  const app = createApp({
    supervisedWorkflow: { assess: async () => ({ reviewState: "UNAVAILABLE" }) },
    promptRunner: { run: async () => ({ status: "UNAVAILABLE", answer: null }) },
    confirmationStore: { consume },
    projectReferenceActions: () => {
      projections += 1;
      return {
        referenceActions: { medicines: [], supportive: [], home_care: [], return_now: [], follow_up: null, referral: null },
        doseState: { status: "NOT_APPLICABLE", missingFields: [] },
      };
    },
    inferenceQueue: new InferenceQueue(),
    sessionOwner: () => "local-owner",
  } as any);
  const server = await new Promise<any>((resolve) => { const listening = app.listen(0, () => resolve(listening)); });
  return { base: `http://127.0.0.1:${server.address().port}`, server, projections: () => projections };
}

const post = (base: string, token: string, decision: string, extra = {}) => fetch(`${base}/triage/confirm`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, decision, ...extra }),
});

test("confirm projects deterministic actions while reject returns no actions and neither invokes QVAC", async (t) => {
  const seen: string[] = [];
  const f = await fixture((token, owner, decision) => {
    seen.push(`${token}:${owner}:${decision}`);
    return { ok: true, decision, binding };
  });
  t.after(() => f.server.close());
  const confirmed = await post(f.base, "confirm-token", "CONFIRM");
  assert.equal(confirmed.status, 200);
  assert.equal((await confirmed.json()).reviewState, "CONFIRMED");
  assert.equal(f.projections(), 1);

  const rejected = await post(f.base, "reject-token", "REJECT");
  assert.equal(rejected.status, 200);
  const rejectedBody = await rejected.json();
  assert.equal(rejectedBody.reviewState, "REJECTED");
  assert.equal("referenceActions" in rejectedBody, false);
  assert.equal(f.projections(), 1, "reject does not project actions");
  assert.deepEqual(seen, ["confirm-token:local-owner:CONFIRM", "reject-token:local-owner:REJECT"]);
});

test("confirmation failure reasons map to exact safe HTTP statuses", async (t) => {
  let reason = "NOT_FOUND";
  const f = await fixture(() => ({ ok: false, reason }));
  t.after(() => f.server.close());
  const expected: Record<string, number> = { NOT_FOUND: 404, EXPIRED: 410, USED: 409, OWNER_MISMATCH: 403, BINDING_MISMATCH: 409 };
  for (const [failure, status] of Object.entries(expected)) {
    reason = failure;
    const response = await post(f.base, "opaque-token", "CONFIRM");
    assert.equal(response.status, status, failure);
    const payload = await response.json();
    assert.doesNotMatch(JSON.stringify(payload), /\/Users\/|@qvac|RPCError|fd-lock/i);
  }
  assert.equal(f.projections(), 0);
});

test("confirmation rejects malformed decisions and caller-supplied classifications or actions", async (t) => {
  const f = await fixture(() => ({ ok: true, decision: "CONFIRM", binding }));
  t.after(() => f.server.close());
  assert.equal((await post(f.base, "token", "MAYBE")).status, 400);
  assert.equal((await post(f.base, "token", "CONFIRM", { classification: "MALARIA" })).status, 400);
  assert.equal((await post(f.base, "token", "CONFIRM", { action: "invented" })).status, 400);
});
