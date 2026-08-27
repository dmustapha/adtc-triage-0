import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

type Route = "GENERAL" | "CLINICAL" | "AMBIGUOUS";
type UnifiedInputApi = {
  routeInput(text: string): Route;
  extractClinicalCandidate(text: string): Record<string, any>;
};

const root = new URL("../../", import.meta.url);
const moduleUrl = new URL("public/assets/js/unified-input.js", root);
const metadata = JSON.parse(readFileSync(new URL("metadata.json", root), "utf8")) as {
  test_prompts: Array<{ prompt_id: string; prompt: string }>;
};

function loadModule(): { api: UnifiedInputApi; source: string } {
  assert.equal(existsSync(moduleUrl), true, "unified-input.js must exist");
  const source = readFileSync(moduleUrl, "utf8");
  const context = { module: { exports: {} }, exports: {} };
  Function("module", "exports", source)(context.module, context.exports);
  return { api: context.module.exports as UnifiedInputApi, source };
}

test("routes clinical, general, and ambiguous input by general rules", () => {
  const { api } = loadModule();
  assert.equal(api.routeInput("Two year old with cough and breathing 52 per minute."), "CLINICAL");
  assert.equal(api.routeInput("Explain why a checklist must be completed."), "GENERAL");
  assert.equal(api.routeInput("Summarize this two-year-old case."), "GENERAL");
  assert.equal(api.routeInput("Help with breathing."), "AMBIGUOUS");
});

test("routes both Gate 1 prompts without prompt-specific implementation data", () => {
  const { api, source } = loadModule();
  for (const item of metadata.test_prompts) {
    assert.equal(api.routeInput(item.prompt), "GENERAL");
    assert.equal(source.includes(item.prompt), false);
    assert.equal(source.includes(item.prompt_id), false);
  }
  assert.doesNotMatch(source, /sha(?:1|256|512)|prompt[_-]?id|canned/i);
});

test("extracts only explicit age, rate, count quality, concern, and observations", () => {
  const { api } = loadModule();
  const draft = api.extractClinicalCandidate(
    "Two year old with cough, breathing counted at 52 per minute for one minute while calm; all seven observations absent.",
  );
  assert.deepEqual(draft.patientAge, { value: 2, unit: "years" });
  assert.equal(draft.respiratoryRatePerMinute, 52);
  assert.equal(draft.rateCountQuality, "ONE_MINUTE_WHILE_CALM");
  assert.equal(draft.respiratoryConcern, "PRESENT");
  assert.ok(Object.values(draft.dangerObservations).every((value) => value === "ABSENT"));
  assert.deepEqual(draft.conflicts, []);
});

test("leaves unmentioned facts not assessed and never infers medicine safety", () => {
  const { api } = loadModule();
  const draft = api.extractClinicalCandidate("A two-year-old child has a cough.");
  assert.ok(Object.values(draft.dangerObservations).every((value) => value === "NOT_ASSESSED"));
  assert.equal(draft.respiratoryRatePerMinute, null);
  assert.equal(draft.rateCountQuality, "NOT_CONFIRMED");
  assert.equal(draft.patientWeightKg, null);
  assert.deepEqual(draft.medicationSafety, {
    allergiesReviewed: "NOT_ASSESSED",
    contraindicationsReviewed: "NOT_ASSESSED",
  });
  assert.equal(draft.protocolApplicability, "NOT_ASSESSED");
});

test("keeps explicit negation absent rather than present", () => {
  const { api } = loadModule();
  const draft = api.extractClinicalCandidate("Two year old with no chest indrawing and still drinking well.");
  assert.equal(draft.dangerObservations.chestIndrawing, "ABSENT");
  assert.equal(draft.dangerObservations.cannotDrinkOrBreastfeed, "ABSENT");
  assert.deepEqual(draft.conflicts, []);
});

test("negated findings win without creating false positive conflicts", () => {
  const { api } = loadModule();
  const draft = api.extractClinicalCandidate(
    "Two year old with no cough, no stridor when calm, not lethargic, and no low oxygen.",
  );
  assert.equal(draft.respiratoryConcern, "ABSENT");
  assert.equal(draft.dangerObservations.stridorWhenCalm, "ABSENT");
  assert.equal(draft.dangerObservations.lethargicOrUnconscious, "ABSENT");
  assert.equal(draft.dangerObservations.lowOxygenOrCentralCyanosis, "ABSENT");
  assert.deepEqual(draft.conflicts, []);
});

test("field-value absent forms preserve negative polarity for every structured observation", () => {
  const { api } = loadModule();
  const fields = [
    ["cannotDrinkOrBreastfeed", "Cannot drink or breastfeed"],
    ["vomitsEverything", "Vomits everything"],
    ["convulsions", "Convulsions"],
    ["lethargicOrUnconscious", "Lethargic or unconscious"],
    ["chestIndrawing", "Chest indrawing"],
    ["stridorWhenCalm", "Stridor when calm"],
    ["lowOxygenOrCentralCyanosis", "Low oxygen or central cyanosis"],
  ];
  for (const [key, label] of fields) {
    for (const statement of [`${label} absent.`, `${label} is absent.`, `${label} was absent.`]) {
      const draft = api.extractClinicalCandidate(statement);
      assert.equal(draft.dangerObservations[key], "ABSENT", statement);
      assert.deepEqual(draft.conflicts, [], statement);
    }
  }
});

test("independent present and field-value absent statements conflict in either order", () => {
  const { api } = loadModule();
  const fields = [
    ["cannotDrinkOrBreastfeed", "Cannot drink or breastfeed.", "Cannot drink or breastfeed absent."],
    ["vomitsEverything", "Vomits everything.", "Vomits everything absent."],
    ["convulsions", "Has convulsions.", "Convulsions absent."],
    ["lethargicOrUnconscious", "The child is lethargic.", "Lethargic or unconscious absent."],
    ["chestIndrawing", "Chest indrawing is present.", "Chest indrawing absent."],
    ["stridorWhenCalm", "Stridor when calm.", "Stridor when calm absent."],
    ["lowOxygenOrCentralCyanosis", "Low oxygen is present.", "Low oxygen or central cyanosis absent."],
  ];
  for (const [key, present, absent] of fields) {
    for (const narrative of [`${present} ${absent}`, `${absent} ${present}`]) {
      const draft = api.extractClinicalCandidate(narrative);
      assert.equal(draft.dangerObservations[key], "NOT_ASSESSED", narrative);
      assert.ok(draft.conflicts.includes(`dangerObservations.${key}`), narrative);
    }
  }
});

test("true present findings remain present while unrelated observations remain unassessed", () => {
  const { api } = loadModule();
  const fields = [
    ["cannotDrinkOrBreastfeed", "Cannot drink or breastfeed."],
    ["vomitsEverything", "Vomits everything."],
    ["convulsions", "Has convulsions."],
    ["lethargicOrUnconscious", "The child is lethargic."],
    ["chestIndrawing", "Chest indrawing is present."],
    ["stridorWhenCalm", "Stridor when calm."],
    ["lowOxygenOrCentralCyanosis", "Low oxygen is present."],
  ];
  for (const [key, statement] of fields) {
    const observations = api.extractClinicalCandidate(statement).dangerObservations;
    assert.equal(observations[key], "PRESENT", statement);
    assert.ok(Object.entries(observations).every(([field, value]) => field === key || value === "NOT_ASSESSED"), statement);
  }
});

test("keeps independently stated positive and negative evidence conflicting", () => {
  const { api } = loadModule();
  const draft = api.extractClinicalCandidate("Two year old has cough but now has no cough.");
  assert.equal(draft.respiratoryConcern, "NOT_ASSESSED");
  assert.ok(draft.conflicts.includes("respiratoryConcern"));
});

test("routes explicit authority-bearing danger observations as clinical", () => {
  const { api } = loadModule();
  assert.equal(api.routeInput("Chest indrawing is present."), "CLINICAL");
  assert.equal(api.routeInput("Cannot drink or breastfeed."), "CLINICAL");
});

test("surfaces conflicting explicit age, rate, and observation facts", () => {
  const { api } = loadModule();
  const draft = api.extractClinicalCandidate(
    "Two year old, later recorded as three years old; breathing 40 per minute and breathing 52 per minute; chest indrawing present but no chest indrawing.",
  );
  assert.ok(draft.conflicts.includes("patientAge"));
  assert.ok(draft.conflicts.includes("respiratoryRatePerMinute"));
  assert.ok(draft.conflicts.includes("dangerObservations.chestIndrawing"));
  assert.equal(draft.dangerObservations.chestIndrawing, "NOT_ASSESSED");
});
