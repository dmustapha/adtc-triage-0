// tests/unit/guide-workflow.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSupervisedWorkflow } from "../../src/triage/supervised-workflow.js";

function fakeDeps(overrides = {}) {
  return {
    getContext: async () => ({ medpsyId: "m", embedId: "e" }),
    routeCase: async () => ({ offDomain: false, shortlist: [{ cls: "PNEUMONIA", score: 0.9 }] }),
    retrieveGrounding: async () => ({
      groundedHits: [{ id: "c1", text: "PNEUMONIA give oral Amoxicillin", score: 0.9, protocol: "IMCI",
        source_ref: "p.6", citation: { title: "WHO IMCI Chart Booklet (2014)", page: 6, section: "Pneumonia", text: "Pneumonia" } }],
      topHits: [], retrieval: "semantic" as const,
    }),
    triageFromHits: async () => ({
      card: { severity: "URGENT", action: "Give oral Amoxicillin", reasoning: "fast breathing",
        protocol_citation: { doc: "WHO IMCI Chart Booklet (2014)", page: 6, section: "Pneumonia" }, red_flags: [], confidence: "high" },
      citationChunk: null, attempts: 1, retrieval: "semantic", classification: "PNEUMONIA",
    }),
    confirmationStore: { issue: () => ({ token: "t", expiresAt: null }) },
    policyVersion: "test",
    ...overrides,
  };
}

test("guide streams stages and returns a card with a plan for a clinical narrative", async () => {
  const stages: string[] = [];
  let citation = null;
  const wf = createSupervisedWorkflow(fakeDeps() as any);
  const result = await wf.guide({ caseText: "2 year old, cough, breathing fast 52, alert and drinking" }, {
    owner: "o", onStage: (s: any) => stages.push(s.key), onCitation: (c: any) => { citation = c; }, onFirstToken: () => {},
  });
  assert.equal(result.classification, "PNEUMONIA");
  assert.equal(result.card.severity, "URGENT");
  assert.ok(result.card.plan, "card must carry a management plan");
  assert.ok(result.card.plan.medicines.length >= 1, "plan must include medicines from the frozen table");
  assert.ok(stages.includes("reason"), `expected a reason stage, got ${stages}`);
  assert.ok(citation, "a WHO citation must be emitted before the card");
});

test("guide returns a deterministic EMERGENCY card with no model call for an explicit emergency narrative", async () => {
  let triageCalled = false;
  const wf = createSupervisedWorkflow(fakeDeps({ triageFromHits: async () => { triageCalled = true; throw new Error("model must not run"); } }) as any);
  const result = await wf.guide({ caseText: "10 month old, lethargic and cannot drink, has convulsions" }, { owner: "o" });
  assert.equal(triageCalled, false, "the model must not be invoked for an explicit emergency");
  assert.equal(result.card.severity, "EMERGENCY");
  assert.ok(result.card.plan?.referral, "emergency plan must carry a referral line");
});
