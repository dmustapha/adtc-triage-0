import assert from "node:assert/strict";
import test from "node:test";

import { docFor, lookupProtocol } from "../../src/triage/protocol-table.js";
import { createSupervisedWorkflow } from "../../src/triage/supervised-workflow.js";

const ABSENT = {
  cannotDrinkOrBreastfeed: "ABSENT",
  vomitsEverything: "ABSENT",
  convulsions: "ABSENT",
  lethargicOrUnconscious: "ABSENT",
  chestIndrawing: "ABSENT",
  stridorWhenCalm: "ABSENT",
  lowOxygenOrCentralCyanosis: "ABSENT",
} as const;

function child(overrides: Record<string, unknown> = {}): any {
  return {
    caseText: "Two year old with cough for three days, alert and drinking.",
    patientAge: { value: 24, unit: "months" },
    patientWeightKg: 12,
    dangerObservations: { ...ABSENT },
    respiratoryAssessment: {
      coughOrDifficultBreathing: "PRESENT",
      respiratoryRatePerMinute: 32,
      rateCountQuality: "ONE_MINUTE_WHILE_CALM",
    },
    medicationSafety: {
      allergiesReviewed: "NOT_ASSESSED",
      contraindicationsReviewed: "NOT_ASSESSED",
      allergyDetails: [],
      contraindicationDetails: [],
    },
    protocolApplicability: { status: "NOT_ASSESSED", details: [] },
    ...overrides,
  };
}

function broadCase(classification: string): any {
  if (lookupProtocol(classification)?.protocol === "mhGAP") {
    return child({
      caseText: "Thirty year old with episodes of elevated mood and reduced need for sleep.",
      patientAge: { value: 30, unit: "years" },
      dangerObservations: Object.fromEntries(Object.keys(ABSENT).map((key) => [key, "NOT_ASSESSED"])),
      respiratoryAssessment: undefined,
    });
  }
  return child({
    caseText: "Two year old with diarrhoea, alert and drinking.",
    respiratoryAssessment: undefined,
  });
}

function workflowHarness(classification = "PNEUMONIA") {
  const calls: string[] = [];
  const entry = lookupProtocol(classification);
  assert.ok(entry, `test classification ${classification} must have a frozen protocol entry`);
  const hit = {
    id: `${entry.protocol}|p${entry.citation.page}|matrix`,
    text: `${classification} verified source excerpt`,
    score: 0.93,
    mode: "semantic" as const,
    source_ref: `${entry.protocol} p.${entry.citation.page}`,
    protocol: entry.protocol,
    citation: {
      protocol: entry.protocol,
      title: docFor(entry.protocol),
      page: entry.citation.page,
      section: classification,
    },
  };
  const workflow = createSupervisedWorkflow({
    getContext: async () => { calls.push("context"); return { medpsyId: "fake-medpsy", embedId: "fake-embed" }; },
    routeCase: async () => { calls.push("route"); return { shortlist: [{ cls: classification, score: 0.93 }], best: 0.93, offDomain: false }; },
    retrieveGrounding: async () => { calls.push("retrieval"); return { groundedHits: [hit], topHits: [hit], retrieval: "semantic" as const }; },
    triageFromHits: async () => {
      calls.push("model");
      return {
        classification,
        attempts: 1,
        retrieval: "semantic" as const,
        citationChunk: hit,
        card: {
          severity: entry.severity,
          action: "private",
          protocol_citation: { doc: docFor(entry.protocol), page: entry.citation.page, section: classification },
          reasoning: "private",
          red_flags: [],
          confidence: "medium" as const,
        },
      };
    },
    confirmationStore: {
      issue: () => { calls.push("token"); return { token: `token-${classification}`, expiresAt: "2026-08-25T23:00:00.000Z" }; },
    },
    policyVersion: "restored-workflow-v1",
  });
  return { workflow, calls };
}

test("deterministic emergency, incomplete, outside-scope, chest, and fast-rate cases never call QVAC dependencies", async () => {
  const cases = [
    [child({ dangerObservations: { ...ABSENT, convulsions: "PRESENT" } }), "EMERGENCY"],
    [child({ patientAge: undefined }), "ASSESSMENT_REQUIRED"],
    [child({ respiratoryAssessment: { coughOrDifficultBreathing: "ABSENT", rateCountQuality: "NOT_CONFIRMED" } }), "OUTSIDE_SUPPORTED_SCOPE"],
    [child({ dangerObservations: { ...ABSENT, chestIndrawing: "PRESENT" } }), "PROMPT_SUPERVISED_REVIEW"],
    [child({ respiratoryAssessment: { coughOrDifficultBreathing: "PRESENT", respiratoryRatePerMinute: 40, rateCountQuality: "ONE_MINUTE_WHILE_CALM" } }), "PROMPT_SUPERVISED_REVIEW"],
  ] as const;

  for (const [input, outcome] of cases) {
    const harness = workflowHarness();
    const result = await harness.workflow.assess(input, { owner: "matrix-owner" });
    assert.equal(result.reviewState, "DETERMINISTIC");
    assert.equal(result.outcome, outcome);
    assert.deepEqual(harness.calls, [], `${outcome} crossed the no-QVAC boundary`);
  }
});

test("respiratory boundaries are deterministic at 50 and 40 while 49 and 39 retain a neutral authoritative result", async () => {
  for (const [age, rate, fast] of [[11, 49, false], [11, 50, true], [24, 39, false], [24, 40, true]] as const) {
    const harness = workflowHarness();
    const result = await harness.workflow.assess(child({
      patientAge: { value: age, unit: "months" },
      caseText: `${age} month old with cough; breathing ${rate} per minute, alert and drinking.`,
      respiratoryAssessment: { coughOrDifficultBreathing: "PRESENT", respiratoryRatePerMinute: rate, rateCountQuality: "ONE_MINUTE_WHILE_CALM" },
    }), { owner: "matrix-owner" });

    assert.equal(result.outcome, fast ? "PROMPT_SUPERVISED_REVIEW" : "NO_ESCALATION_CRITERION_RECORDED");
    assert.deepEqual(harness.calls, []);
    assert.equal(result.reviewState, "DETERMINISTIC");
    assert.equal(result.classification, undefined);
    assert.equal(result.assistance, undefined, "the internal deterministic result carries no model assistance");
  }
});

test("broad IMCI and mhGAP routes issue source-bound provisional results without public actions", async () => {
  for (const classification of ["NO DEHYDRATION", "BIPOLAR DISORDER"]) {
    const harness = workflowHarness(classification);
    const result = await harness.workflow.assess(broadCase(classification), { owner: "matrix-owner" });

    assert.deepEqual(harness.calls, ["context", "route", "retrieval", "model", "token"]);
    assert.equal(result.reviewState, "PROVISIONAL");
    assert.equal(result.classification, classification);
    assert.equal(result.protocol, lookupProtocol(classification)?.protocol);
    assert.ok(result.confirmation?.token);
    assert.equal(result.referenceActions, undefined);
    assert.equal(result.plan, undefined);
  }
});

test("invalid and narrative-conflicting records fail before routing, retrieval, or model access", async () => {
  for (const input of [
    { caseText: "" },
    child({ caseText: "Three year old with cough; breathing 32 per minute, alert and drinking." }),
    child({ caseText: "Two year old with chest indrawing; breathing 32 per minute." }),
  ]) {
    const harness = workflowHarness();
    const result = await harness.workflow.assess(input, { owner: "matrix-owner" });
    assert.equal(result.reviewState, "UNAVAILABLE");
    assert.deepEqual(harness.calls, []);
    assert.equal(result.confirmation?.eligible, false);
    assert.equal(result.confirmation?.token, null);
  }
});
