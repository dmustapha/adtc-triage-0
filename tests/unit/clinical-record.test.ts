import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const modulePath = "src/triage/clinical-record.ts";
const require = createRequire(import.meta.url);

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

test("backend narrative authority matches coordinated absence and explicit polarity", async () => {
  const { parseClinicalRequest, canonicalClinicalRecord, findNarrativeConflicts } = await import("../../src/triage/clinical-record.js");
  const shared = parseClinicalRequest({
    ...completeRequest(),
    caseText: "Two year old. Cough or difficult breathing absent. Cannot drink or breastfeed, vomits everything, convulsions, lethargic or unconscious, chest indrawing, stridor when calm, and low oxygen or central cyanosis were absent.",
    respiratoryAssessment: { coughOrDifficultBreathing: "ABSENT", rateCountQuality: "NOT_CONFIRMED" },
  });
  assert.equal(shared.success, true);
  if (shared.success) assert.deepEqual(findNarrativeConflicts(canonicalClinicalRecord(shared.data)), []);

  const fields = [
    ["cannotDrinkOrBreastfeed", "The child cannot drink or breastfeed.", "Cannot drink or breastfeed was absent."],
    ["vomitsEverything", "The child vomits everything.", "Vomits everything was absent."],
    ["convulsions", "The child has convulsions.", "Convulsions were absent."],
    ["lethargicOrUnconscious", "The child is lethargic.", "Lethargic or unconscious was absent."],
    ["chestIndrawing", "Chest indrawing is present.", "Chest indrawing was absent."],
    ["stridorWhenCalm", "Stridor when calm was observed.", "Stridor when calm was absent."],
    ["lowOxygenOrCentralCyanosis", "Low oxygen was recorded as present.", "Low oxygen or central cyanosis was absent."],
  ] as const;
  for (const [key, positive, negative] of fields) {
    for (const [narrative, structured] of [[positive, "ABSENT"], [negative, "PRESENT"]] as const) {
      const parsed = parseClinicalRequest({
        ...completeRequest(), caseText: `Two year old. ${narrative}`,
        dangerObservations: { ...completeRequest().dangerObservations, [key]: structured },
      });
      assert.equal(parsed.success, true, narrative);
      if (parsed.success) assert.deepEqual(findNarrativeConflicts(canonicalClinicalRecord(parsed.data)), [`dangerObservations.${key}`], narrative);
    }
  }
  for (const [narrative, structured] of [
    ["Cough is present.", "ABSENT"],
    ["Cough or difficult breathing was absent.", "PRESENT"],
  ] as const) {
    const parsed = parseClinicalRequest({
      ...completeRequest(), caseText: `Two year old. ${narrative}`,
      respiratoryAssessment: { coughOrDifficultBreathing: structured, rateCountQuality: "NOT_CONFIRMED" },
    });
    assert.equal(parsed.success, true, narrative);
    if (parsed.success) assert.deepEqual(findNarrativeConflicts(canonicalClinicalRecord(parsed.data)), ["respiratoryAssessment.coughOrDifficultBreathing"], narrative);
  }
});

test("backend narrative authority ignores non-assertions and reports internal conflicts", async () => {
  const { parseClinicalRequest, canonicalClinicalRecord, findNarrativeConflicts } = await import("../../src/triage/clinical-record.js");
  for (const narrative of [
    "Two year old. Possible convulsions.",
    "Two year old. Example patient has chest indrawing.",
    "Two year old. The phrase 'stridor when calm was present' appears here.",
    "Two year old. Cough may be present.",
  ]) {
    const parsed = parseClinicalRequest({ ...completeRequest(), caseText: narrative });
    assert.equal(parsed.success, true, narrative);
    if (parsed.success) assert.deepEqual(findNarrativeConflicts(canonicalClinicalRecord(parsed.data)), [], narrative);
  }
  for (const [narrative, field] of [
    ["Two year old. Convulsions are present. Convulsions are absent.", "dangerObservations.convulsions"],
    ["Two year old. Cough absent but difficult breathing present.", "respiratoryAssessment.coughOrDifficultBreathing"],
  ]) {
    const parsed = parseClinicalRequest({ ...completeRequest(), caseText: narrative });
    assert.equal(parsed.success, true, narrative);
    if (parsed.success) assert.deepEqual(findNarrativeConflicts(canonicalClinicalRecord(parsed.data)), [field], narrative);
  }
});

test("client and server narrative authority agree across the bounded 20-row corpus", async () => {
  const client = require("../../public/assets/js/unified-input.js") as { extractClinicalCandidate(text: string): any };
  const { extractNarrativeAuthority } = await import("../../src/triage/narrative-authority.js");
  const fields = [
    ["cannotDrinkOrBreastfeed", "Cannot drink or breastfeed"],
    ["vomitsEverything", "Vomits everything"],
    ["convulsions", "Convulsions"],
    ["lethargicOrUnconscious", "Lethargic or unconscious"],
    ["chestIndrawing", "Chest indrawing"],
    ["stridorWhenCalm", "Stridor when calm"],
    ["lowOxygenOrCentralCyanosis", "Low oxygen or central cyanosis"],
    ["respiratoryConcern", "Cough or difficult breathing"],
  ] as const;
  const rows: Array<[string, string, string]> = fields.flatMap(([field, label]) => [
    [field, `Worker documented ${label} as absent.`, "ABSENT"],
    [field, `Worker recorded ${label} as present.`, "PRESENT"],
  ]);
  rows.push(
    ["cannotDrinkOrBreastfeed", "All seven observations absent.", "ABSENT"],
    ["convulsions", "All seven observations absent. Convulsions are present.", "CONFLICT"],
    ["chestIndrawing", "Possible chest indrawing.", "NOT_ASSESSED"],
    ["respiratoryConcern", "Cough absent but difficult breathing present.", "CONFLICT"],
  );
  assert.equal(rows.length, 20);

  for (const [field, narrative, expected] of rows) {
    const clientDraft = client.extractClinicalCandidate(narrative);
    const clientConflict = clientDraft.conflicts.includes(field === "respiratoryConcern" ? field : `dangerObservations.${field}`);
    const clientValue = clientConflict ? "CONFLICT" : field === "respiratoryConcern"
      ? clientDraft.respiratoryConcern : clientDraft.dangerObservations[field];
    const serverDraft = extractNarrativeAuthority(narrative);
    const serverValue = field === "respiratoryConcern"
      ? serverDraft.respiratoryConcern : serverDraft.dangerObservations[field as keyof typeof serverDraft.dangerObservations];
    assert.equal(clientValue, expected, `client: ${narrative}`);
    assert.equal(serverValue, expected, `server: ${narrative}`);
  }
});

test("explicit narrative authority conflicts with reviewed not-assessed structure", async () => {
  const { parseClinicalRequest, canonicalClinicalRecord, findNarrativeConflicts } = await import("../../src/triage/clinical-record.js");
  const parsed = parseClinicalRequest({
    ...completeRequest(),
    caseText: "Two year old. Convulsions were absent. Cough is present.",
    dangerObservations: { ...completeRequest().dangerObservations, convulsions: "NOT_ASSESSED" },
    respiratoryAssessment: { coughOrDifficultBreathing: "NOT_ASSESSED", rateCountQuality: "NOT_CONFIRMED" },
  });
  assert.equal(parsed.success, true);
  if (parsed.success) assert.deepEqual(findNarrativeConflicts(canonicalClinicalRecord(parsed.data)), [
    "dangerObservations.convulsions",
    "respiratoryAssessment.coughOrDifficultBreathing",
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
