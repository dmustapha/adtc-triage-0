import assert from "node:assert/strict";
import test from "node:test";

import { canonicalClinicalRecord, clinicalRecordHash } from "../../src/triage/clinical-record.js";
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

function request(overrides: Record<string, unknown> = {}): any {
  return {
    caseText: "Two year old with cough and difficult breathing for three days.",
    patientAge: { value: 24, unit: "months" as const },
    patientWeightKg: 12,
    dangerObservations: { ...ABSENT },
    respiratoryAssessment: {
      coughOrDifficultBreathing: "PRESENT" as const,
      respiratoryRatePerMinute: 32,
      rateCountQuality: "ONE_MINUTE_WHILE_CALM" as const,
    },
    medicationSafety: {
      allergiesReviewed: "NOT_ASSESSED" as const,
      contraindicationsReviewed: "NOT_ASSESSED" as const,
      allergyDetails: [],
      contraindicationDetails: [],
    },
    protocolApplicability: { status: "NOT_ASSESSED" as const, details: [] },
    ...overrides,
  };
}

function broadRequest(overrides: Record<string, unknown> = {}): any {
  return request({
    caseText: "Thirty year old with persistent low mood and loss of interest for three weeks.",
    patientAge: { value: 30, unit: "years" },
    dangerObservations: Object.fromEntries(Object.keys(ABSENT).map((key) => [key, "NOT_ASSESSED"])),
    respiratoryAssessment: undefined,
    ...overrides,
  });
}

const hit = {
  id: "IMCI|p6|c1",
  text: "PNEUMONIA Give oral Amoxicillin for 5 days",
  score: 0.91,
  mode: "semantic",
  source_ref: "IMCI p.6",
  protocol: "IMCI",
  citation: { protocol: "IMCI", title: "WHO IMCI Chart Booklet (2014)", page: 6, section: "PNEUMONIA" },
} as const;

function harness(options: { offDomain?: boolean; triageError?: Error; triageClassification?: string; continuationIssueError?: Error } = {}) {
  const calls: string[] = [];
  const issued: unknown[] = [];
  const triageOptions: unknown[] = [];
  const continuationIssues: unknown[] = [];
  let storedContinuation: any = null;
  const workflow = createSupervisedWorkflow({
    getContext: async () => {
      calls.push("context");
      return { medpsyId: "fake-medpsy", embedId: "fake-embed" };
    },
    routeCase: async () => {
      calls.push("route");
      return { shortlist: [{ cls: "PNEUMONIA", score: 0.9 }], best: 0.9, offDomain: options.offDomain ?? false };
    },
    retrieveGrounding: async () => {
      calls.push("retrieval");
      return { groundedHits: [hit], topHits: [hit], retrieval: "semantic" as const };
    },
    triageFromHits: async (_text: string, _hits: any[], _ctx: any, opts: any) => {
      calls.push("reason");
      calls.push("extraction");
      calls.push("validation");
      triageOptions.push(opts);
      if (options.triageError) throw options.triageError;
      return {
        classification: options.triageClassification ?? "PNEUMONIA",
        attempts: 1,
        retrieval: "semantic" as const,
        citationChunk: hit,
        card: {
          severity: "URGENT" as const,
          action: "MODEL DRAFT MUST STAY PRIVATE",
          protocol_citation: { doc: "MODEL CITATION MUST STAY PRIVATE", page: 999, section: "MODEL SECTION" },
          reasoning: "PRIVATE MODEL REASONING",
          red_flags: ["invented model danger"],
          confidence: "medium" as const,
        },
      };
    },
    confirmationStore: {
      issue(binding: unknown) {
        calls.push("token");
        issued.push(binding);
        return { token: "opaque-token", expiresAt: "2026-08-25T16:05:00.000Z" };
      },
    },
    continuationStore: {
      issue(binding: unknown, snapshot: unknown) {
        if (options.continuationIssueError) throw options.continuationIssueError;
        continuationIssues.push({ binding, snapshot });
        storedContinuation = { binding, snapshot };
        return { token: "continue-token", expiresAt: "2026-08-25T16:05:00.000Z" };
      },
      consume(token: string, owner: string) {
        if (token !== "continue-token") return { ok: false, reason: "NOT_FOUND" as const };
        if (storedContinuation?.binding.owner !== owner) return { ok: false, reason: "OWNER_MISMATCH" as const };
        return { ok: true, binding: storedContinuation.binding, snapshot: storedContinuation.snapshot };
      },
    },
    policyVersion: "restored-workflow-v1",
  });
  return { workflow, calls, issued, triageOptions, continuationIssues };
}

async function assess(
  input: ReturnType<typeof request>,
  options: { offDomain?: boolean; triageError?: Error } = {},
) {
  const testHarness = harness(options);
  const result = await testHarness.workflow.assess(input, { owner: "browser-session-a" });
  return { ...testHarness, result };
}

test("recorded emergency wins before missing fields and invokes no workflow dependency", async () => {
  const h = harness();
  const result = await h.workflow.assess(request({
    patientAge: undefined,
    dangerObservations: { ...ABSENT, convulsions: "PRESENT", chestIndrawing: "NOT_ASSESSED" },
    respiratoryAssessment: undefined,
  }), { owner: "browser-session-a" });

  assert.equal(result.reviewState, "DETERMINISTIC");
  assert.equal(result.outcome, "EMERGENCY");
  assert.deepEqual(h.calls, []);
  assert.equal(result.referenceActions, undefined);
});

test("incomplete, outside-scope, fast-rate, and chest routes preserve zero-QVAC behavior", async () => {
  const cases = [
    { input: request({ patientAge: undefined }), outcome: "ASSESSMENT_REQUIRED", eligible: false },
    { input: request({
      caseText: "Two year old. Cough or difficult breathing absent. All seven observations absent.",
      respiratoryAssessment: { coughOrDifficultBreathing: "ABSENT", rateCountQuality: "NOT_CONFIRMED" },
    }), outcome: "OUTSIDE_SUPPORTED_SCOPE", eligible: false },
    { input: request({ respiratoryAssessment: { coughOrDifficultBreathing: "PRESENT", respiratoryRatePerMinute: 40, rateCountQuality: "ONE_MINUTE_WHILE_CALM" } }), outcome: "PROMPT_SUPERVISED_REVIEW", eligible: true },
    { input: request({ dangerObservations: { ...ABSENT, chestIndrawing: "PRESENT" } }), outcome: "PROMPT_SUPERVISED_REVIEW", eligible: true },
  ];

  for (const expected of cases) {
    const h = harness();
    const result = await h.workflow.assess(expected.input, { owner: "browser-session-a" });
    assert.equal(result.reviewState, "DETERMINISTIC");
    assert.equal(result.outcome, expected.outcome);
    assert.deepEqual(h.calls, [], `${expected.outcome} must not allocate route, retrieval, or model work`);
    assert.equal(Boolean(result.continuation?.eligible), expected.eligible);
  }
});

test("complete below-threshold respiratory records are model-free until explicit continuation", async () => {
  const h = harness();
  const initial = await h.workflow.assess(request(), { owner: "browser-session-a" });
  assert.deepEqual(h.calls, []);
  assert.equal(initial.reviewState, "DETERMINISTIC");
  assert.equal(initial.continuation?.token, "continue-token");
  assert.equal(h.continuationIssues.length, 1);
});

test("explicit respiratory continuation runs the proven pipeline and reconciles the deterministic class", async () => {
  for (const [input, expectedClass] of [
    [request(), "COUGH OR COLD"],
    [request({ respiratoryAssessment: { coughOrDifficultBreathing: "PRESENT", respiratoryRatePerMinute: 40, rateCountQuality: "ONE_MINUTE_WHILE_CALM" } }), "PNEUMONIA"],
    [request({ dangerObservations: { ...ABSENT, chestIndrawing: "PRESENT" } }), "PNEUMONIA"],
  ] as const) {
    const h = harness({ triageClassification: expectedClass });
    const initial = await h.workflow.assess(input, { owner: "browser-session-a" });
    assert.deepEqual(h.calls, []);
    const claim = h.workflow.claimContinuation(initial.continuation!.token!, "browser-session-a");
    assert.equal(claim.ok, true);
    if (!claim.ok) continue;
    const result = await h.workflow.continueClaim(claim, { owner: "browser-session-a" });
    assert.equal(result.reviewState, "PROVISIONAL");
    assert.equal(result.classification, expectedClass);
    assert.equal(result.outcome, initial.outcome);
    assert.deepEqual(h.calls, ["context", "route", "retrieval", "reason", "extraction", "validation", "token"]);
    assert.equal((h.triageOptions.at(-1) as any).requiredClassification, expectedClass);
  }
});

test("contradictory respiratory extraction fails closed instead of being overwritten into success", async () => {
  const h = harness({ triageClassification: "COUGH OR COLD" });
  const input = request({ respiratoryAssessment: {
    coughOrDifficultBreathing: "PRESENT", respiratoryRatePerMinute: 40,
    rateCountQuality: "ONE_MINUTE_WHILE_CALM",
  } });
  const initial = await h.workflow.assess(input, { owner: "browser-session-a" });
  const claim = h.workflow.claimContinuation(initial.continuation!.token!, "browser-session-a");
  assert.equal(claim.ok, true);
  if (!claim.ok) return;
  const result = await h.workflow.continueClaim(claim, { owner: "browser-session-a" });
  assert.notEqual(result.reviewState, "PROVISIONAL");
  assert.equal(result.classification, undefined);
  assert.equal(result.outcome, "PROMPT_SUPERVISED_REVIEW");
  assert.match(result.uncertainty, /unavailable|did not match|contradict/i);
  assert.deepEqual(h.issued, []);
});

test("continuation capacity failure never suppresses the deterministic respiratory result", async () => {
  const h = harness({ continuationIssueError: new Error("Continuation store capacity reached.") });
  const result = await h.workflow.assess(request(), { owner: "browser-session-a" });
  assert.equal(result.reviewState, "DETERMINISTIC");
  assert.equal(result.outcome, "NO_ESCALATION_CRITERION_RECORDED");
  assert.equal(result.continuation?.eligible, false);
  assert.match(String(result.continuation?.reason), /capacity|unavailable/i);
  assert.deepEqual(h.calls, []);
});

test("structured emergency wins before contradictory narrative text", async () => {
  const h = harness();
  const result = await h.workflow.assess(request({
    caseText: "No convulsions and alert.",
    dangerObservations: { ...ABSENT, convulsions: "PRESENT" },
  }), { owner: "browser-session-a" });
  assert.equal(result.reviewState, "DETERMINISTIC");
  assert.equal(result.outcome, "EMERGENCY");
  assert.deepEqual(h.calls, []);
});

test("eligible narrative runs route, retrieval, reason, extraction, validation, and token issuance in order", async () => {
  const { result, calls } = await assess(broadRequest());
  assert.deepEqual(calls, ["context", "route", "retrieval", "reason", "extraction", "validation", "token"]);
  assert.equal(result.reviewState, "PROVISIONAL");
  assert.equal(result.classification, "PNEUMONIA");
});

test("adult mhGAP-style records do not require the pediatric respiratory checklist", async () => {
  const h = harness();
  const result = await h.workflow.assess(broadRequest(), { owner: "browser-session-a" });

  assert.equal(result.reviewState, "PROVISIONAL");
  assert.deepEqual(h.calls, ["context", "route", "retrieval", "reason", "extraction", "validation", "token"]);
});

test("the proven budgets and three-attempt extraction cap reach the triage engine", async () => {
  const { triageOptions } = await assess(broadRequest());
  assert.equal(triageOptions.length, 1);
  assert.partialDeepStrictEqual(triageOptions[0], {
    reasonPredict: 1024,
    extractPredict: 512,
    maxExtractAttempts: 3,
  });
});

test("off-domain broad review fails closed without a provisional class", async () => {
  const { result, calls, issued } = await assess(broadRequest(), { offDomain: true });
  assert.equal(result.reviewState, "UNAVAILABLE");
  assert.equal(result.classification, undefined);
  assert.match(result.uncertainty, /no matching|off.domain|abstain/i);
  assert.deepEqual(calls, ["context", "route"]);
  assert.deepEqual(issued, []);
});

test("malformed or exhausted extraction becomes unavailable without leaking its draft", async () => {
  const { result, calls, issued } = await assess(broadRequest(), {
    triageError: new Error("Triage extract failed after 3 attempts: MODEL SECRET DRAFT"),
  });
  assert.equal(result.reviewState, "UNAVAILABLE");
  assert.equal(result.confirmation?.eligible, false);
  assert.doesNotMatch(JSON.stringify(result), /MODEL SECRET DRAFT/i);
  assert.deepEqual(issued, []);
  assert.deepEqual(calls, ["context", "route", "retrieval", "reason", "extraction", "validation"]);
});

test("structured respiratory facts remain authoritative before explicit model continuation", async () => {
  const { result, triageOptions, calls } = await assess(request());
  assert.deepEqual(result.emergencyObservations ?? [], []);
  assert.doesNotMatch(JSON.stringify(result.recorded), /invented model danger/i);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE MODEL REASONING|MODEL DRAFT MUST STAY PRIVATE/i);
  assert.deepEqual(triageOptions, []);
  assert.deepEqual(calls, []);
});

test("deterministic respiratory finding and threshold remain the public supporting-evidence basis", async () => {
  const { result } = await assess(request());
  assert.match(String(result.finding), /no emergency observation.*fast-breathing criterion/i);
  assert.match(String(result.basis), /32\/min.*below.*40\/min.*one minute.*calm/i);
  assert.match(String(result.uncertainty), /does not rule out illness/i);
  assert.doesNotMatch(String(result.uncertainty), /provisional WHO protocol classification/i);
  assert.doesNotMatch(String(result.basis), /reconciled class/i);
});

test("a complete below-threshold respiratory record keeps model classification private until continuation", async () => {
  const { result, calls, issued } = await assess(request());
  assert.deepEqual(calls, []);
  assert.equal(result.outcome, "NO_ESCALATION_CRITERION_RECORDED");
  assert.equal(result.reviewState, "DETERMINISTIC");
  assert.equal(result.classification, undefined);
  assert.equal(result.protocol, undefined);
  assert.equal(result.confirmation, undefined);
  assert.deepEqual(issued, []);
  assert.equal(result.continuation?.eligible, true);
  assert.doesNotMatch(JSON.stringify(result), /PNEUMONIA|provisional WHO protocol classification/i);
});

test("the reconciled engine class, not draft prose, owns the provisional classification", async () => {
  const { result } = await assess(broadRequest());
  assert.equal(result.classification, "PNEUMONIA");
  assert.equal(result.protocol, "IMCI");
  assert.notEqual(result.classification, "MODEL DRAFT MUST STAY PRIVATE");
});

test("provisional output has citations, uncertainty, and an opaque token but no reference actions", async () => {
  const { result } = await assess(broadRequest());
  assert.ok(result.citations);
  assert.ok(result.confirmation);
  assert.ok(result.citations.length >= 1);
  assert.match(result.uncertainty, /provisional|not a diagnosis|clinical judgment/i);
  assert.equal(result.confirmation.eligible, true);
  assert.equal(result.confirmation.token, "opaque-token");
  assert.equal(result.referenceActions, undefined);
  assert.equal(result.plan, undefined);
});

test("confirmation binds the canonical record hash, reconciled class, source, policy, and owner", async () => {
  const input = broadRequest();
  const { issued } = await assess(input);
  assert.equal(issued.length, 1);
  assert.deepEqual(issued[0], {
    recordHash: clinicalRecordHash(canonicalClinicalRecord(input)),
    classification: "PNEUMONIA",
    protocol: "IMCI",
    citationKeys: ["WHO IMCI Chart Booklet (2014):6:PNEUMONIA"],
    policyVersion: "restored-workflow-v1",
    owner: "browser-session-a",
    fixedSeverity: "URGENT",
    sourceAction: {
      text: "Give oral Amoxicillin for 5 days",
      doc: "WHO IMCI Chart Booklet (2014)",
      page: 6,
    },
  });
});
