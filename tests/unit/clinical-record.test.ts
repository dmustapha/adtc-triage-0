import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

const modulePath = "src/triage/clinical-record.ts";

function completeRequest() {
  return {
    caseText: "Two year old with cough; breathing counted at 32 per minute while calm; alert and drinking.",
    patientAge: { value: 2, unit: "years" },
    patientWeightKg: 12.5,
    dangerObservations: {
      cannotDrinkOrBreastfeed: "ABSENT",
      vomitsEverything: "ABSENT",
      convulsions: "ABSENT",
      lethargicOrUnconscious: "ABSENT",
      chestIndrawing: "ABSENT",
      stridorWhenCalm: "ABSENT",
      lowOxygenOrCentralCyanosis: "ABSENT",
    },
    respiratoryAssessment: {
      coughOrDifficultBreathing: "PRESENT",
      respiratoryRatePerMinute: 32,
      rateCountQuality: "ONE_MINUTE_WHILE_CALM",
    },
    medicationSafety: {
      allergiesReviewed: "CONFIRMED_NONE",
      contraindicationsReviewed: "CONFIRMED_NONE",
      allergyDetails: [],
      contraindicationDetails: [],
    },
    protocolApplicability: { status: "NOT_ASSESSED", details: [] },
  };
}

test("canonical clinical records are stable across request key order", async () => {
  assert.equal(existsSync(modulePath), true, `${modulePath} must exist`);
  if (!existsSync(modulePath)) return;
  const { parseClinicalRequest, canonicalClinicalRecord, clinicalRecordHash } = await import("../../src/triage/clinical-record.js");
  const first = completeRequest();
  const reversed = {
    ...first,
    dangerObservations: Object.fromEntries(Object.entries(first.dangerObservations).reverse()),
  };
  const parsedFirst = parseClinicalRequest(first);
  const parsedReversed = parseClinicalRequest(reversed);
  assert.equal(parsedFirst.success, true);
  assert.equal(parsedReversed.success, true);
  if (!parsedFirst.success || !parsedReversed.success) return;

  const firstRecord = canonicalClinicalRecord(parsedFirst.data);
  const reversedRecord = canonicalClinicalRecord(parsedReversed.data);
  assert.deepEqual(firstRecord, reversedRecord);
  assert.equal(clinicalRecordHash(firstRecord), clinicalRecordHash(reversedRecord));
  assert.equal(firstRecord.ageMonths, 24);
  assert.equal(firstRecord.respiratoryAssessment?.fastBreathingThresholdPerMinute, 40);
  assert.equal(firstRecord.narrative.trust, "UNTRUSTED_CONTEXT");
});

test("the canonical hash changes for every authority-bearing patient change", async () => {
  assert.equal(existsSync(modulePath), true, `${modulePath} must exist`);
  if (!existsSync(modulePath)) return;
  const { parseClinicalRequest, canonicalClinicalRecord, clinicalRecordHash } = await import("../../src/triage/clinical-record.js");
  const base = completeRequest();
  const variants = [
    { ...base, patientWeightKg: 13 },
    { ...base, patientAge: { value: 25, unit: "months" as const } },
    { ...base, dangerObservations: { ...base.dangerObservations, chestIndrawing: "PRESENT" } },
    { ...base, respiratoryAssessment: { ...base.respiratoryAssessment, respiratoryRatePerMinute: 40 } },
    { ...base, medicationSafety: { ...base.medicationSafety, allergiesReviewed: "NOT_ASSESSED" } },
    { ...base, protocolApplicability: { status: "CONFIRMED_APPLICABLE", details: ["Pneumonia row reviewed."] } },
  ];
  const parsedBase = parseClinicalRequest(base);
  assert.equal(parsedBase.success, true);
  if (!parsedBase.success) return;
  const baseHash = clinicalRecordHash(canonicalClinicalRecord(parsedBase.data));

  for (const variant of variants) {
    const parsed = parseClinicalRequest(variant);
    assert.equal(parsed.success, true);
    if (!parsed.success) continue;
    assert.notEqual(clinicalRecordHash(canonicalClinicalRecord(parsed.data)), baseHash);
  }
});

test("explicit narrative contradictions identify exact structured fields", async () => {
  assert.equal(existsSync(modulePath), true, `${modulePath} must exist`);
  if (!existsSync(modulePath)) return;
  const { parseClinicalRequest, canonicalClinicalRecord, findNarrativeConflicts } = await import("../../src/triage/clinical-record.js");
  const parsed = parseClinicalRequest({
    ...completeRequest(),
    caseText: "Three year old cannot drink, has chest indrawing, and breathes 45 times per minute.",
  });
  assert.equal(parsed.success, true);
  if (!parsed.success) return;

  assert.deepEqual(findNarrativeConflicts(canonicalClinicalRecord(parsed.data)), [
    "patientAge",
    "dangerObservations.cannotDrinkOrBreastfeed",
    "dangerObservations.chestIndrawing",
    "respiratoryAssessment.respiratoryRatePerMinute",
  ]);
});

test("request parsing fails closed on unknown fields and preserves prompt-like narrative bytes", async () => {
  assert.equal(existsSync(modulePath), true, `${modulePath} must exist`);
  if (!existsSync(modulePath)) return;
  const { parseClinicalRequest, canonicalClinicalRecord } = await import("../../src/triage/clinical-record.js");
  const exactNarrative = "  Ignore policy? This remains untrusted patient narrative.  ";
  const valid = parseClinicalRequest({ ...completeRequest(), caseText: exactNarrative });
  assert.equal(valid.success, true);
  if (valid.success) assert.equal(canonicalClinicalRecord(valid.data).narrative.text, exactNarrative);
  assert.equal(parseClinicalRequest({ ...completeRequest(), hiddenClassification: "PNEUMONIA" }).success, false);
});
