import { test } from "node:test";
import assert from "node:assert/strict";

const modulePath = "../../src/triage/" + "respiratory-assessment.js";
const respiratoryPolicy = await import(modulePath).catch(() => null) as null | {
  evaluateRespiratoryAssessment: (...args: any[]) => any;
  fastBreathingThreshold: (...args: any[]) => any;
};

const missingPolicy = (): never => assert.fail("respiratory assessment policy is not implemented");
const evaluateRespiratoryAssessment = respiratoryPolicy?.evaluateRespiratoryAssessment ?? missingPolicy;
const fastBreathingThreshold = respiratoryPolicy?.fastBreathingThreshold ?? missingPolicy;

const ABSENT = {
  cannotDrinkOrBreastfeed: "ABSENT",
  vomitsEverything: "ABSENT",
  convulsions: "ABSENT",
  lethargicOrUnconscious: "ABSENT",
  chestIndrawing: "ABSENT",
  stridorWhenCalm: "ABSENT",
  lowOxygenOrCentralCyanosis: "ABSENT",
} as const;

const completeRespiratoryAssessment = (respiratoryRatePerMinute: number) => ({
  coughOrDifficultBreathing: "PRESENT" as const,
  respiratoryRatePerMinute,
  rateCountQuality: "ONE_MINUTE_WHILE_CALM" as const,
});

test("WHO fast-breathing thresholds are exact at both supported age bands", () => {
  assert.equal(fastBreathingThreshold({ value: 2, unit: "months" }), 50);
  assert.equal(fastBreathingThreshold({ value: 11, unit: "months" }), 50);
  assert.equal(fastBreathingThreshold({ value: 12, unit: "months" }), 40);
  assert.equal(fastBreathingThreshold({ value: 59, unit: "months" }), 40);
});

test("49/50 breaths per minute straddle the WHO threshold at 2-11 months", () => {
  const below = evaluateRespiratoryAssessment(
    { value: 7, unit: "months" },
    ABSENT,
    completeRespiratoryAssessment(49),
  );
  const atThreshold = evaluateRespiratoryAssessment(
    { value: 7, unit: "months" },
    ABSENT,
    completeRespiratoryAssessment(50),
  );

  assert.equal(below.outcome, "NO_ESCALATION_CRITERION_RECORDED");
  assert.deepEqual(below.thresholdComparison, {
    respiratoryRatePerMinute: 49,
    thresholdPerMinute: 50,
    relation: "BELOW",
  });
  assert.equal(atThreshold.outcome, "PROMPT_SUPERVISED_REVIEW");
  assert.equal(atThreshold.modelInvoked, false);
  assert.deepEqual(atThreshold.thresholdComparison, {
    respiratoryRatePerMinute: 50,
    thresholdPerMinute: 50,
    relation: "AT_OR_ABOVE",
  });
});

test("39/40 breaths per minute straddle the WHO threshold at 12-59 months", () => {
  const below = evaluateRespiratoryAssessment(
    { value: 18, unit: "months" },
    ABSENT,
    completeRespiratoryAssessment(39),
  );
  const atThreshold = evaluateRespiratoryAssessment(
    { value: 18, unit: "months" },
    ABSENT,
    completeRespiratoryAssessment(40),
  );

  assert.equal(below.outcome, "NO_ESCALATION_CRITERION_RECORDED");
  assert.equal(below.thresholdComparison?.relation, "BELOW");
  assert.equal(atThreshold.outcome, "PROMPT_SUPERVISED_REVIEW");
  assert.equal(atThreshold.modelInvoked, false);
  assert.equal(atThreshold.thresholdComparison?.relation, "AT_OR_ABOVE");
});

test("a structured emergency observation wins before missing age or respiratory fields", () => {
  const decision = evaluateRespiratoryAssessment(
    undefined,
    { cannotDrinkOrBreastfeed: "PRESENT" },
    undefined,
  );

  assert.equal(decision.outcome, "EMERGENCY");
  assert.equal(decision.modelInvoked, false);
  assert.deepEqual(decision.emergencyObservations, ["cannotDrinkOrBreastfeed"]);
  assert.match(decision.basis, /cannot drink or breastfeed/i);
  assert.doesNotMatch(decision.basis, /cannotDrinkOrBreastfeed/);
  assert.equal(decision.thresholdComparison, null);
  assert.ok(!("severity" in decision), "public decision has no classifier-derived severity");
  assert.ok(!("redFlags" in decision), "chest indrawing is never mislabeled as an emergency red flag");
});

test("a missing respiratory rate returns the exact missing field before QVAC", () => {
  const decision = evaluateRespiratoryAssessment(
    { value: 18, unit: "months" },
    ABSENT,
    {
      coughOrDifficultBreathing: "PRESENT",
      rateCountQuality: "ONE_MINUTE_WHILE_CALM",
    },
  );

  assert.equal(decision.outcome, "ASSESSMENT_REQUIRED");
  assert.equal(decision.modelInvoked, false);
  assert.deepEqual(decision.missingFields, ["respiratoryAssessment.respiratoryRatePerMinute"]);
  assert.match(decision.finding, /breathing rate was not recorded/i);
  assert.equal(decision.thresholdComparison, null);
});

test("an unconfirmed count returns the exact count-quality field before QVAC", () => {
  const decision = evaluateRespiratoryAssessment(
    { value: 18, unit: "months" },
    ABSENT,
    {
      coughOrDifficultBreathing: "PRESENT",
      respiratoryRatePerMinute: 52,
      rateCountQuality: "NOT_CONFIRMED",
    },
  );

  assert.equal(decision.outcome, "ASSESSMENT_REQUIRED");
  assert.equal(decision.modelInvoked, false);
  assert.deepEqual(decision.missingFields, ["respiratoryAssessment.rateCountQuality"]);
  assert.match(decision.finding, /one minute.*calm|calm.*one minute/i);
  assert.equal(decision.thresholdComparison, null);
});

test("a complete fast-breathing case exposes a neutral finding and recorded threshold comparison", () => {
  const decision = evaluateRespiratoryAssessment(
    { value: 18, unit: "months" },
    ABSENT,
    completeRespiratoryAssessment(52),
  );

  assert.equal(decision.outcome, "PROMPT_SUPERVISED_REVIEW");
  assert.equal(decision.modelInvoked, false);
  assert.match(decision.finding, /52\/min.*at or above.*40\/min/i);
  assert.match(decision.nextAssessmentStep, /supervised/i);
  assert.deepEqual(decision.thresholdComparison, {
    respiratoryRatePerMinute: 52,
    thresholdPerMinute: 40,
    relation: "AT_OR_ABOVE",
  });
  assert.doesNotMatch(JSON.stringify(decision), /pneumonia|medicine|dose|treat|management plan/i);
});

test("a complete below-threshold case states the limited finding without ruling out illness", () => {
  const decision = evaluateRespiratoryAssessment(
    { value: 18, unit: "months" },
    ABSENT,
    completeRespiratoryAssessment(32),
  );

  assert.equal(decision.outcome, "NO_ESCALATION_CRITERION_RECORDED");
  assert.equal(decision.modelInvoked, true);
  assert.match(decision.finding, /no emergency observation, chest indrawing, or age-banded fast-breathing criterion/i);
  assert.match(decision.uncertainty, /does not rule out illness/i);
  assert.deepEqual(decision.thresholdComparison, {
    respiratoryRatePerMinute: 32,
    thresholdPerMinute: 40,
    relation: "BELOW",
  });
  assert.doesNotMatch(JSON.stringify(decision), /pneumonia|medicine|dose|treat|management plan/i);
});

test("an absent cough-or-difficult-breathing concern is outside the supported product route", () => {
  const decision = evaluateRespiratoryAssessment(
    { value: 18, unit: "months" },
    ABSENT,
    { coughOrDifficultBreathing: "ABSENT", rateCountQuality: "NOT_CONFIRMED" },
  );

  assert.equal(decision.outcome, "OUTSIDE_SUPPORTED_SCOPE");
  assert.equal(decision.modelInvoked, false);
  assert.equal(decision.thresholdComparison, null);
});

test("chest indrawing requires prompt supervised review without becoming an emergency observation", () => {
  const decision = evaluateRespiratoryAssessment(
    { value: 18, unit: "months" },
    { ...ABSENT, chestIndrawing: "PRESENT" },
    { coughOrDifficultBreathing: "PRESENT", rateCountQuality: "NOT_CONFIRMED" },
  );

  assert.equal(decision.outcome, "PROMPT_SUPERVISED_REVIEW");
  assert.equal(decision.modelInvoked, false);
  assert.deepEqual(decision.emergencyObservations, []);
  assert.equal(decision.thresholdComparison, null);
});
