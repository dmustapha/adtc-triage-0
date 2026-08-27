import assert from "node:assert/strict";
import test from "node:test";

import { createRestoredApp } from "../src/http/create-app.js";
import { InferenceQueue } from "../src/qvac/inference-queue.js";
import { ConfirmationStore } from "../src/triage/confirmation.js";
import { hasEmergencySign } from "../src/triage/severity.js";
import { createSupervisedWorkflow } from "../src/triage/supervised-workflow.js";

const binding = {
  recordHash: "record-hash",
  classification: "PNEUMONIA",
  protocol: "IMCI" as const,
  citationKeys: ["WHO IMCI Chart Booklet (2014):6:PNEUMONIA"],
  policyVersion: "restored-workflow-v1",
  owner: "local-owner",
  fixedSeverity: "URGENT" as const,
};

for (const [boundary, text] of [
  ["period", "No stridor. The child is unconscious."],
  ["question mark", "No stridor? The child is unconscious."],
  ["exclamation mark", "No stridor! The child is unconscious."],
  ["newline", "No stridor\nThe child is unconscious."],
] as const) {
  test(`S1: ${boundary} ends negation scope before a real emergency`, () => {
    assert.equal(hasEmergencySign(text), true);
  });
}

test("S2: failed confirmation projection leaves the token available for retry", async (t) => {
  let tokenSequence = 0;
  let projectionAttempts = 0;
  const store = new ConfirmationStore({ randomToken: () => `confirm-${++tokenSequence}` });
  const grant = store.issue(binding, { eligibility: { confirmationState: "UNCONFIRMED" } });
  const app = createRestoredApp({
    supervisedWorkflow: { assess: async () => ({ reviewState: "UNAVAILABLE" }) },
    promptRunner: { run: async () => ({ status: "UNAVAILABLE", answer: null }) },
    confirmationStore: store,
    projectReferenceActions: () => {
      projectionAttempts += 1;
      if (projectionAttempts === 1) return {};
      return {
        referenceActions: {
          medicines: [], supportive: [], home_care: [], return_now: [], follow_up: null, referral: null,
        },
        doseState: { status: "NOT_APPLICABLE", missingFields: [] },
      };
    },
    inferenceQueue: new InferenceQueue(),
    sessionOwner: () => binding.owner,
  } as any);
  const server = await new Promise<any>((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  t.after(() => server.close());
  const post = () => fetch(`http://127.0.0.1:${server.address().port}/triage/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: grant.token, decision: "CONFIRM" }),
  });

  assert.equal((await post()).status, 500);
  assert.equal((await post()).status, 200, "projection failure must not burn the one-use grant");
});

test("S3: terminal confirmation decisions immediately reclaim bounded capacity", () => {
  let tokenSequence = 0;
  const store = new ConfirmationStore({ capacity: 1, randomToken: () => `capacity-${++tokenSequence}` });
  const first = store.issue(binding);
  assert.equal(store.consume(first.token, binding.owner, "REJECT").ok, true);
  assert.doesNotThrow(() => store.issue({ ...binding, recordHash: "next-record" }));
  assert.equal(store.size, 1);
});

test("S5: public assistance identity comes from the injected verified runtime identity", async () => {
  const hit = {
    id: "IMCI|p6|c1",
    text: "PNEUMONIA Give oral Amoxicillin for 5 days",
    score: 0.91,
    mode: "semantic" as const,
    source_ref: "IMCI p.6",
    protocol: "IMCI",
    citation: { protocol: "IMCI", title: "WHO IMCI Chart Booklet (2014)", page: 6, section: "PNEUMONIA" },
  };
  const expectedIdentity = { runtime: "QVAC SDK test-version", model: "verified/model-revision" };
  const workflow = createSupervisedWorkflow({
    getContext: async () => ({ medpsyId: "runtime-model-id", embedId: "embed-id" }),
    routeCase: async () => ({ shortlist: [{ cls: "PNEUMONIA", score: 0.9 }], best: 0.9, offDomain: false }),
    retrieveGrounding: async () => ({ groundedHits: [hit], topHits: [hit], retrieval: "semantic" as const }),
    triageFromHits: async () => ({
      classification: "PNEUMONIA",
      attempts: 1,
      retrieval: "semantic" as const,
      citationChunk: hit,
      card: {
        severity: "URGENT" as const,
        action: "private draft",
        protocol_citation: { doc: "private", page: 1, section: "private" },
        reasoning: "private",
        red_flags: [],
        confidence: "medium" as const,
      },
    }),
    confirmationStore: { issue: () => ({ token: "token", expiresAt: "2026-08-27T00:00:00.000Z" }) },
    policyVersion: "restored-workflow-v1",
    publicAssistanceIdentity: expectedIdentity,
  } as any);
  const result = await workflow.assess({
    caseText: "Thirty year old with persistent cough.",
    patientAge: { value: 30, unit: "years" },
    dangerObservations: {
      cannotDrinkOrBreastfeed: "NOT_ASSESSED", vomitsEverything: "NOT_ASSESSED",
      convulsions: "NOT_ASSESSED", lethargicOrUnconscious: "NOT_ASSESSED",
      chestIndrawing: "NOT_ASSESSED", stridorWhenCalm: "NOT_ASSESSED",
      lowOxygenOrCentralCyanosis: "NOT_ASSESSED",
    },
    medicationSafety: {
      allergiesReviewed: "NOT_ASSESSED", contraindicationsReviewed: "NOT_ASSESSED",
      allergyDetails: [], contraindicationDetails: [],
    },
    protocolApplicability: { status: "NOT_ASSESSED", details: [] },
  }, { owner: binding.owner });

  assert.deepEqual(result.assistance, { ...expectedIdentity, status: "COMPLETED", retrievalMode: "semantic" });
});

test("N4: an admitted continuation failure releases its reservation for retry", async (t) => {
  let commits = 0;
  let releases = 0;
  const app = createRestoredApp({
    supervisedWorkflow: {
      assess: async () => ({ reviewState: "UNAVAILABLE" }),
      claimContinuation: () => ({ ok: true, token: "retryable" }),
      continueClaim: async () => { throw new Error("native inference failed"); },
      commitContinuation: () => { commits += 1; return true; },
      releaseContinuation: () => { releases += 1; return true; },
    },
    promptRunner: { run: async () => ({ status: "UNAVAILABLE", answer: null }) },
    confirmationStore: { consume: () => ({ ok: false, reason: "NOT_FOUND" }) },
    projectReferenceActions: () => ({}),
    inferenceQueue: new InferenceQueue(),
    sessionOwner: () => "local-owner",
  } as any);
  const server = await new Promise<any>((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  t.after(() => server.close());
  const response = await fetch(`http://127.0.0.1:${server.address().port}/triage/continue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "retryable" }),
  });
  await response.text();

  assert.equal(commits, 0, "failed work must not consume the continuation");
  assert.equal(releases, 1, "failed work must make the continuation retryable");
});
