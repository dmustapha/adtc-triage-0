import assert from "node:assert/strict";
import test from "node:test";

import { PROTOCOL_TABLE, docFor } from "../../src/triage/protocol-table.js";
import {
  projectReferenceActions,
  type ReferenceEligibility,
} from "../../src/triage/reference-actions.js";

const confirmed: ReferenceEligibility = {
  confirmationState: "CONFIRMED",
  patientAgeMonths: 24,
  patientWeightKg: 12,
  allergiesReviewed: "CONFIRMED_NONE",
  contraindicationsReviewed: "CONFIRMED_NONE",
  protocolApplicability: "CONFIRMED_APPLICABLE",
};

function project(classification: string, overrides: Partial<ReferenceEligibility> = {}) {
  const entry = PROTOCOL_TABLE[classification];
  assert.ok(entry, `${classification} must be encoded`);
  return projectReferenceActions(classification, entry.severity, { ...confirmed, ...overrides });
}

function publicText(value: unknown): string {
  return JSON.stringify(value);
}

test("every encoded classification projects only its frozen protocol entry with page citations", () => {
  for (const [classification, entry] of Object.entries(PROTOCOL_TABLE)) {
    const result = project(classification);
    const actions = result.referenceActions;
    assert.ok(actions, `${classification} must expose actions after confirmation`);
    const expectedDoc = docFor(entry.protocol);

    assert.deepEqual(actions.supportive.map((line) => line.item), entry.supportive.map((line) => line.text));
    assert.deepEqual(actions.home_care.map((line) => line.advice), entry.home_care.map((line) => line.text));
    assert.deepEqual(actions.return_now.map((line) => line.sign), entry.return_now.map((line) => line.text));
    assert.equal(actions.follow_up?.when ?? null, entry.follow_up?.text ?? null);
    assert.equal(actions.referral?.criterion ?? null, entry.referral?.text ?? null);

    const citations = [
      ...actions.medicines.map((line) => line.citation),
      ...actions.supportive.map((line) => line.citation),
      ...actions.home_care.map((line) => line.citation),
      ...actions.return_now.map((line) => line.citation),
      ...(actions.follow_up ? [actions.follow_up.citation] : []),
      ...(actions.referral ? [actions.referral.citation] : []),
    ];
    for (const citation of citations) {
      assert.equal(citation.doc, expectedDoc, `${classification} action cites its protocol document`);
      assert.ok(Number.isInteger(citation.page) && Number(citation.page) > 0, `${classification} action cites a page`);
    }
  }
});

test("model or retrieval draft text can never cross into reference actions", () => {
  const injected = "MODEL-DRAFT: prescribe invented medicine 999 mg";
  const eligibility = { ...confirmed, modelDraft: injected, retrievedText: injected } as ReferenceEligibility;
  const result = projectReferenceActions("PNEUMONIA", "URGENT", eligibility);

  assert.ok(result.referenceActions);
  assert.doesNotMatch(publicText(result), /MODEL-DRAFT|invented medicine|999 mg/i);
});

test("an emergency severity always receives the deterministic protocol referral", () => {
  const result = projectReferenceActions("PNEUMONIA", "EMERGENCY", confirmed);
  assert.ok(result.referenceActions?.referral);
  assert.equal(result.referenceActions.referral.criterion, "Refer URGENTLY to hospital");
  assert.equal(result.referenceActions.referral.citation.doc, "WHO IMCI Chart Booklet (2014)");
  assert.equal(result.referenceActions.referral.citation.page, 6);
});

test("unconfirmed, rejected, expired, and replayed decisions expose no actions", () => {
  for (const confirmationState of ["UNCONFIRMED", "REJECTED", "EXPIRED", "REPLAYED"] as const) {
    const result = project("PNEUMONIA", { confirmationState });
    assert.equal(result.referenceActions, null, `${confirmationState} must expose no reference actions`);
    assert.equal(result.doseState.status, "LOCKED_SAFETY_REVIEW");
  }
});

test("medicine bands require complete age and weight inputs", () => {
  const missingAge = project("PNEUMONIA", { patientAgeMonths: undefined });
  assert.equal(missingAge.doseState.status, "LOCKED_MISSING_INPUTS");
  assert.deepEqual(missingAge.doseState.missingFields, ["patientAge"]);
  assert.deepEqual(missingAge.referenceActions?.medicines, []);

  const missingWeight = project("PNEUMONIA", { patientWeightKg: undefined });
  assert.equal(missingWeight.doseState.status, "LOCKED_MISSING_INPUTS");
  assert.deepEqual(missingWeight.doseState.missingFields, ["patientWeightKg"]);
  assert.deepEqual(missingWeight.referenceActions?.medicines, []);
});

test("allergy, contraindication, and applicability gates keep medicine bands locked", () => {
  for (const overrides of [
    { allergiesReviewed: "PRESENT" as const },
    { contraindicationsReviewed: "PRESENT" as const },
    { allergiesReviewed: "NOT_ASSESSED" as const },
    { contraindicationsReviewed: "NOT_ASSESSED" as const },
    { protocolApplicability: "NOT_ASSESSED" as const },
    { protocolApplicability: "NOT_APPLICABLE" as const },
  ]) {
    const result = project("PNEUMONIA", overrides);
    assert.equal(result.doseState.status, "LOCKED_SAFETY_REVIEW");
    assert.deepEqual(result.referenceActions?.medicines, []);
  }
});

test("amoxicillin age and weight boundaries select exactly one source row without gaps or overlap", () => {
  const cases = [
    { patientAgeMonths: 11.999, patientWeightKg: 9.999, band: "2 months up to 12 months (4 - <10 kg)" },
    { patientAgeMonths: 12, patientWeightKg: 10, band: "12 months up to 3 years (10 - <14 kg)" },
    { patientAgeMonths: 35.999, patientWeightKg: 13.999, band: "12 months up to 3 years (10 - <14 kg)" },
    { patientAgeMonths: 36, patientWeightKg: 14, band: "3 years up to 5 years (14-19 kg)" },
    { patientAgeMonths: 59.999, patientWeightKg: 19, band: "3 years up to 5 years (14-19 kg)" },
  ];

  for (const { patientAgeMonths, patientWeightKg, band } of cases) {
    const result = project("PNEUMONIA", { patientAgeMonths, patientWeightKg });
    assert.equal(result.doseState.status, "AVAILABLE_REFERENCE_BAND");
    assert.deepEqual(result.referenceActions?.medicines[0]?.bands?.map((row) => row.band), [band]);
  }
});

test("every encoded dose table selects exact boundary rows and rejects conflicting age-weight bands", () => {
  const cases = [
    ["DYSENTERY", 5.999, 5, "Less than 6 months"],
    ["DYSENTERY", 6, 6, "6 months up to 5 years"],
    ["NO DEHYDRATION", 5.999, 5, "2 months up to 6 months"],
    ["NO DEHYDRATION", 6, 6, "6 months or more"],
    ["MALARIA", 11.999, 9.999, "5 - <10 kg (2 months up to 12 months)"],
    ["MALARIA", 12, 10, "10 - <14 kg (12 months up to 3 years)"],
    ["MALARIA", 36, 14, "14 - <19 kg (3 years up to 5 years)"],
    ["ANAEMIA", 3.999, 5.999, "2 months up to 4 months (4 - <6 kg)"],
    ["ANAEMIA", 4, 6, "4 months up to 12 months (6 - <10 kg)"],
    ["ANAEMIA", 12, 10, "12 months up to 3 years (10 - <14 kg)"],
    ["ANAEMIA", 36, 14, "3 years up to 5 years (14 - 19 kg)"],
  ] as const;
  for (const [classification, patientAgeMonths, patientWeightKg, band] of cases) {
    const result = project(classification, { patientAgeMonths, patientWeightKg });
    assert.equal(result.doseState.status, "AVAILABLE_REFERENCE_BAND", `${classification}: ${band}`);
    assert.equal(result.referenceActions?.medicines[0]?.bands?.[0]?.band, band);
  }

  const conflicting = project("PNEUMONIA", { patientAgeMonths: 12, patientWeightKg: 9.999 });
  assert.equal(conflicting.doseState.status, "LOCKED_SAFETY_REVIEW");
  assert.deepEqual(conflicting.referenceActions?.medicines, []);
});

test("multi-medicine tables select one source row per medicine", () => {
  const cases = [
    [3.999, 5.999, "< 6 kg (up to 4 months)", "2 months up to 6 months"],
    [4, 6, "6 - <10 kg (4 months up to 12 months)", "2 months up to 6 months"],
    [6, 6, "6 - <10 kg (4 months up to 12 months)", "6 months or more"],
    [12, 10, "10 - <12 kg (12 months up to 2 years)", "6 months or more"],
    [24, 12, "12 - 19 kg (2 years up to 5 years)", "6 months or more"],
  ] as const;
  for (const [patientAgeMonths, patientWeightKg, orsBand, zincBand] of cases) {
    const result = project("SOME DEHYDRATION", { patientAgeMonths, patientWeightKg });
    assert.equal(result.doseState.status, "AVAILABLE_REFERENCE_BAND");
    assert.deepEqual(result.referenceActions?.medicines.map((medicine) => medicine.bands?.[0]?.band), [orsBand, zincBand]);
  }
});

test("classes without a source dose band remain explicitly not applicable", () => {
  const result = project("COUGH OR COLD");
  assert.equal(result.doseState.status, "NOT_APPLICABLE");
  assert.deepEqual(result.doseState.missingFields, []);
});

test("reference output never adds an individualized dose or prescription sentence", () => {
  const result = project("PNEUMONIA");
  assert.equal(result.doseState.status, "AVAILABLE_REFERENCE_BAND");
  assert.doesNotMatch(publicText(result), /computedDose|prescription|you should (take|give)|administer to (the|this) patient/i);
  for (const medicine of result.referenceActions?.medicines ?? []) {
    assert.equal(Object.hasOwn(medicine, "computedDose"), false);
    assert.equal(medicine.bands?.length, 1, "only the applicable frozen source row is shown");
  }
});
