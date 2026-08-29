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

// S2 tested the old /triage/confirm route. In the restored one-flow design that route is
// removed. The test below replaces it: assert the restored app does not register /triage/confirm.
test("S2: restored app does not register /triage/confirm (route removed)", async (t) => {
  const app = createRestoredApp({
    supervisedWorkflow: { guide: async () => ({ card: { severity: "UNKNOWN", action: "", reasoning: "", red_flags: [] } }) },
    promptRunner: { run: async () => ({ status: "UNAVAILABLE", answer: null }) },
    confirmationStore: new ConfirmationStore({}),
    projectReferenceActions: () => ({}),
    inferenceQueue: new InferenceQueue(),
    sessionOwner: () => binding.owner,
  } as any);
  const server = await new Promise<any>((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  t.after(() => server.close());
  const res = await fetch(`http://127.0.0.1:${server.address().port}/triage/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "any", decision: "CONFIRM" }),
  });
  assert.equal(res.status, 404, "restored app must not register /triage/confirm");
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

// N4 tested the old /triage/continue route. In the restored one-flow design that route is
// removed. The test below replaces it: assert the restored app does not register /triage/continue.
test("N4: restored app does not register /triage/continue (route removed)", async (t) => {
  const app = createRestoredApp({
    supervisedWorkflow: { guide: async () => ({ card: { severity: "UNKNOWN", action: "", reasoning: "", red_flags: [] } }) },
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
  assert.equal(response.status, 404, "restored app must not register /triage/continue");
});
