import assert from "node:assert/strict";
import test from "node:test";

import { PROTOCOL_TABLE, docFor } from "../../src/triage/protocol-table.js";
import { projectReferenceActions } from "../../src/triage/reference-actions.js";

const eligibility = {
  confirmationState: "CONFIRMED" as const,
  patientAgeMonths: 24,
  patientWeightKg: 12,
  allergiesReviewed: "CONFIRMED_NONE" as const,
  contraindicationsReviewed: "CONFIRMED_NONE" as const,
  protocolApplicability: "CONFIRMED_APPLICABLE" as const,
};

test("every confirmed projection preserves the complete frozen plan and citations", () => {
  for (const [classification, entry] of Object.entries(PROTOCOL_TABLE)) {
    const projected = projectReferenceActions(classification, entry.severity, eligibility);
    const plan = projected.referenceActions;
    assert.ok(plan, classification);
    const doc = docFor(entry.protocol);
    assert.equal(plan.immediateAction?.text, entry.action.text, `${classification} immediate action`);
    assert.deepEqual(plan.immediateAction?.citation, { doc, page: entry.action.page });
    assert.deepEqual(plan.medicines.map((medicine) => ({
      name: medicine.name,
      strength: medicine.strength,
      dose: medicine.dose,
      frequency: medicine.frequency,
      bands: medicine.bands?.map((band) => ({ band: band.band, dose: band.dose })),
    })), entry.medicines.map((medicine) => ({
      name: medicine.name,
      strength: medicine.strength,
      dose: medicine.dose,
      frequency: medicine.frequency,
      bands: medicine.bands,
    })));
    for (const medicine of plan.medicines) {
      assert.equal(medicine.citation.doc, doc);
      assert.ok(Number(medicine.citation.page) > 0);
      if (medicine.bands?.length) {
        assert.ok(medicine.selectedBand, `${classification}/${medicine.name} must identify one selected row`);
        assert.ok(medicine.bands.some((row) => row.band === medicine.selectedBand?.band));
      }
    }
    assert.deepEqual(plan.supportive.map((line) => ({ text: line.item, page: line.citation.page })),
      entry.supportive.map((line) => ({ text: line.text, page: line.page })), `${classification} supportive`);
    assert.deepEqual(plan.home_care.map((line) => ({ text: line.advice, page: line.citation.page })),
      entry.home_care.map((line) => ({ text: line.text, page: line.page })), `${classification} home care`);
    assert.deepEqual(plan.return_now.map((line) => ({ text: line.sign, page: line.citation.page })),
      entry.return_now.map((line) => ({ text: line.text, page: line.page })), `${classification} return signs`);
    assert.deepEqual(plan.follow_up && { text: plan.follow_up.when, page: plan.follow_up.citation.page },
      entry.follow_up && { text: entry.follow_up.text, page: entry.follow_up.page }, `${classification} follow-up`);
    assert.deepEqual(plan.referral && { text: plan.referral.criterion, page: plan.referral.citation.page },
      entry.referral && { text: entry.referral.text, page: entry.referral.page }, `${classification} referral`);
    for (const line of [...plan.supportive, ...plan.home_care, ...plan.return_now]) assert.equal(line.citation.doc, doc);
    if (plan.follow_up) assert.equal(plan.follow_up.citation.doc, doc);
    if (plan.referral) assert.equal(plan.referral.citation.doc, doc);
    if (entry.follow_up_detail) {
      assert.deepEqual(plan.follow_up?.detailCitation, { doc, page: entry.follow_up_detail.page });
    }
  }
});

test("locked medicine safety preserves cited non-medicine actions and reveals no dose table", () => {
  const projected = projectReferenceActions("PNEUMONIA", "URGENT", {
    ...eligibility,
    allergiesReviewed: "NOT_ASSESSED",
  });
  assert.deepEqual(projected.referenceActions?.medicines, []);
  assert.equal(projected.referenceActions?.immediateAction, undefined);
  assert.ok(projected.referenceActions?.home_care.length);
  assert.ok(projected.referenceActions?.return_now.length);
  assert.ok(projected.referenceActions?.follow_up);
});
