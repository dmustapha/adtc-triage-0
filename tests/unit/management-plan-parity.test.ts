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
