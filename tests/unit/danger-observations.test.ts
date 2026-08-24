import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DANGER_OBSERVATION_KEYS,
  type DangerObservationKey,
  evaluateDangerPolicy,
  normalizePatientAge,
  summarizeDangerDecision,
} from "../../src/triage/danger-observations.js";
import { StructuredDangerRequestSchema } from "../../src/triage/schema.js";

const ABSENT = Object.fromEntries(DANGER_OBSERVATION_KEYS.map((key) => [key, "ABSENT"])) as Record<DangerObservationKey, "ABSENT">;

test("request parsing normalizes an omitted observation object and fields to NOT_ASSESSED", () => {
  const omitted = StructuredDangerRequestSchema.parse({ patientAge: { value: 9, unit: "months" } });
  assert.deepEqual(Object.values(omitted.dangerObservations), Array(7).fill("NOT_ASSESSED"));

  const partial = StructuredDangerRequestSchema.parse({ dangerObservations: { convulsions: "ABSENT" } });
  assert.equal(partial.dangerObservations.convulsions, "ABSENT");
  assert.equal(partial.dangerObservations.chestIndrawing, "NOT_ASSESSED");
});

test("ordinary request parsing accepts only three public values and rejects CONFLICT", () => {
  for (const value of ["PRESENT", "ABSENT", "NOT_ASSESSED"]) {
    assert.equal(StructuredDangerRequestSchema.parse({ dangerObservations: { stridorWhenCalm: value } }).dangerObservations.stridorWhenCalm, value);
  }
  assert.equal(StructuredDangerRequestSchema.safeParse({ dangerObservations: { stridorWhenCalm: "CONFLICT" } }).success, false);
});

test("age normalization uses exact 2-inclusive and 60-exclusive month boundaries", () => {
  assert.deepEqual(normalizePatientAge({ value: 2, unit: "months" }), { months: 2, supported: true });
  assert.deepEqual(normalizePatientAge({ value: 5, unit: "years" }), { months: 60, supported: false });
  assert.deepEqual(normalizePatientAge({ value: 1 / 6, unit: "years" }), { months: 2, supported: true });
  assert.deepEqual(normalizePatientAge({ value: 59, unit: "months" }), { months: 59, supported: true });
});

test("age parsing rejects nonfinite, negative, nonnumeric, and invalid-unit values", () => {
  for (const patientAge of [
    { value: Number.NaN, unit: "months" },
    { value: Number.POSITIVE_INFINITY, unit: "years" },
    { value: -1, unit: "months" },
    { value: "2", unit: "months" },
    { value: 2, unit: "weeks" },
  ]) assert.equal(StructuredDangerRequestSchema.safeParse({ patientAge }).success, false);
});

test("known emergency PRESENT outranks missing age and incomplete or conflicting fields", () => {
  const decision = evaluateDangerPolicy(undefined, {
    cannotDrinkOrBreastfeed: "PRESENT",
    convulsions: "CONFLICT",
  });
  assert.equal(decision.route, "DETERMINISTIC_EMERGENCY");
  assert.deepEqual(decision.presentEmergencyKeys, ["cannotDrinkOrBreastfeed"]);
});

test("missing or unsupported age and NOT_ASSESSED or CONFLICT fail closed", () => {
  assert.equal(evaluateDangerPolicy(undefined, ABSENT).route, "ASSESSMENT_REQUIRED");
  assert.equal(evaluateDangerPolicy({ value: 60, unit: "months" }, ABSENT).route, "ASSESSMENT_REQUIRED");
  assert.equal(evaluateDangerPolicy({ value: 9, unit: "months" }, { ...ABSENT, convulsions: "NOT_ASSESSED" }).route, "ASSESSMENT_REQUIRED");
  assert.equal(evaluateDangerPolicy({ value: 9, unit: "months" }, { ...ABSENT, convulsions: "CONFLICT" }).route, "ASSESSMENT_REQUIRED");
});

test("isolated chest indrawing is age-scoped non-emergency pneumonia", () => {
  const decision = evaluateDangerPolicy({ value: 2, unit: "months" }, { ...ABSENT, chestIndrawing: "PRESENT" });
  assert.equal(decision.route, "NON_EMERGENCY_PNEUMONIA");
  assert.equal(decision.severity, "URGENT");
  assert.equal(decision.modelInvoked, false);
});

test("supported all-absent assessment reaches QVAC with a deterministic summary", () => {
  const decision = evaluateDangerPolicy({ value: 59, unit: "months" }, ABSENT);
  assert.equal(decision.route, "QVAC");
  assert.equal(decision.modelInvoked, true);
  assert.equal(summarizeDangerDecision(decision), "All seven structured danger observations are absent; proceed to QVAC.");
});
