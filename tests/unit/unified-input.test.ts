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

test("one shared absent suffix applies to every observation in its factual clause", () => {
  const { api } = loadModule();
  const shared = api.extractClinicalCandidate(
    "Cannot drink or breastfeed, vomits everything, convulsions, lethargic or unconscious, chest indrawing, stridor when calm, and low oxygen or central cyanosis were absent.",
  );
  assert.ok(Object.values(shared.dangerObservations).every((value) => value === "ABSENT"));
  assert.deepEqual(shared.conflicts, []);

  const singular = api.extractClinicalCandidate("Chest indrawing and stridor when calm was absent.");
  assert.equal(singular.dangerObservations.chestIndrawing, "ABSENT");
  assert.equal(singular.dangerObservations.stridorWhenCalm, "ABSENT");
  assert.deepEqual(singular.conflicts, []);
});

test("mixed factual clauses keep present and absent observations separate", () => {
  const { api } = loadModule();
  const draft = api.extractClinicalCandidate("Vomits everything was present, but chest indrawing was absent.");
  assert.equal(draft.dangerObservations.vomitsEverything, "PRESENT");
  assert.equal(draft.dangerObservations.chestIndrawing, "ABSENT");
  assert.deepEqual(draft.conflicts, []);
});

test("a trailing absent predicate never overrides another observation's local present predicate", () => {
  const { api } = loadModule();
  for (const separator of [" and ", ", "]) {
    const draft = api.extractClinicalCandidate(`Vomits everything present${separator}chest indrawing absent.`);
    assert.equal(draft.dangerObservations.vomitsEverything, "PRESENT", separator);
    assert.equal(draft.dangerObservations.chestIndrawing, "ABSENT", separator);
    assert.deepEqual(draft.conflicts, [], separator);
  }
});

test("repeated observation evidence accumulates conflict in either order", () => {
  const { api } = loadModule();
  const cases = [
    ["convulsions", "Has convulsions", "convulsions absent"],
    ["chestIndrawing", "Chest indrawing present", "chest indrawing absent"],
    ["lowOxygenOrCentralCyanosis", "Low oxygen present", "oxygen is normal"],
  ];
  for (const [key, present, absent] of cases) {
    for (const narrative of [`${present} and ${absent}.`, `${absent} and ${present}.`]) {
      const draft = api.extractClinicalCandidate(narrative);
      assert.equal(draft.dangerObservations[key], "NOT_ASSESSED", narrative);
      assert.ok(draft.conflicts.includes(`dangerObservations.${key}`), narrative);
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
    ["stridorWhenCalm", "Stridor when calm was observed.", "Stridor when calm absent."],
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
    ["stridorWhenCalm", "Stridor when calm was observed."],
    ["lowOxygenOrCentralCyanosis", "Low oxygen is present."],
  ];
  for (const [key, statement] of fields) {
    const observations = api.extractClinicalCandidate(statement).dangerObservations;
    assert.equal(observations[key], "PRESENT", statement);
    assert.ok(Object.entries(observations).every(([field, value]) => field === key || value === "NOT_ASSESSED"), statement);
  }
});

test("explicit structured observation predicates and value forms route clinically", () => {
  const { api } = loadModule();
  const fields = [
    ["Cannot drink or breastfeed", "Cannot drink or breastfeed"],
    ["Vomits everything", "Vomits everything"],
    ["Convulsions", "Has convulsions"],
    ["Lethargic or unconscious", "The child is lethargic"],
    ["Chest indrawing", "Chest indrawing is present"],
    ["Stridor when calm", "Stridor when calm was observed"],
    ["Low oxygen or central cyanosis", "Low oxygen is present"],
  ];
  for (const [label, positive] of fields) {
    assert.equal(api.routeInput(`${positive}.`), "CLINICAL", positive);
    assert.equal(api.routeInput(`${label} was absent.`), "CLINICAL", `${label} absent`);
  }
});

test("lexical, quoted, and hypothetical observation phrases do not become authority", () => {
  const { api } = loadModule();
  const narratives = [
    "Convulsions absent-minded.",
    "If convulsions were absent, the form would look different.",
    'The phrase "convulsions absent" appears in the training note.',
  ];
  for (const narrative of narratives) {
    const draft = api.extractClinicalCandidate(narrative);
    assert.ok(Object.values(draft.dangerObservations).every((value) => value === "NOT_ASSESSED"), narrative);
    assert.notEqual(api.routeInput(narrative), "CLINICAL", narrative);
  }
});

test("embedded non-assertions are masked without treating apostrophes as quote delimiters", () => {
  const { api } = loadModule();
  const nonAssertions = [
    "The caregiver asked whether convulsions were absent.",
    "The child has a cough, if convulsions were absent the form would change.",
    "The phrase “convulsions absent” appears in the note.",
    'The phrase "convulsions absent" appears in the note.',
  ];
  for (const narrative of nonAssertions) {
    const draft = api.extractClinicalCandidate(narrative);
    assert.equal(draft.dangerObservations.convulsions, "NOT_ASSESSED", narrative);
  }

  const asserted = api.extractClinicalCandidate(
    "The child's chest indrawing was absent. The caregiver's child can't drink or breastfeed.",
  );
  assert.equal(asserted.dangerObservations.chestIndrawing, "ABSENT");
  assert.equal(asserted.dangerObservations.cannotDrinkOrBreastfeed, "PRESENT");
});

test("local non-assessment and documentation statuses never become present authority", () => {
  const { api } = loadModule();
  const narratives = [
    "Convulsions not assessed.",
    "Convulsions unknown.",
    "Convulsions were unknown.",
    "Convulsions not recorded.",
    "Convulsions were not provided.",
    "Convulsions not established.",
    "Check for convulsions.",
    "Screen for convulsions.",
    "The note documented convulsions.",
    "The note used the word convulsions.",
    "The note used the phrase convulsions.",
  ];
  for (const narrative of narratives) {
    const draft = api.extractClinicalCandidate(narrative);
    assert.equal(draft.dangerObservations.convulsions, "NOT_ASSESSED", narrative);
    assert.notEqual(api.routeInput(narrative), "CLINICAL", narrative);
  }
});

test("explicit absence statuses remain negative while asserted positives and conflicts remain intact", () => {
  const { api } = loadModule();
  for (const narrative of [
    "Convulsions not present.",
    "Convulsions were not present.",
    "The caregiver denied convulsions.",
    "No history of convulsions.",
  ]) {
    const draft = api.extractClinicalCandidate(narrative);
    assert.equal(draft.dangerObservations.convulsions, "ABSENT", narrative);
    assert.equal(api.routeInput(narrative), "CLINICAL", narrative);
  }
  for (const narrative of ["Has convulsions.", "Convulsions present.", "Convulsions were observed."]) {
    assert.equal(api.extractClinicalCandidate(narrative).dangerObservations.convulsions, "PRESENT", narrative);
  }
  const conflict = api.extractClinicalCandidate("Has convulsions. No history of convulsions.");
  assert.equal(conflict.dangerObservations.convulsions, "NOT_ASSESSED");
  assert.ok(conflict.conflicts.includes("dangerObservations.convulsions"));
});

test("paired single quotes are non-authority while prose apostrophes preserve asserted facts", () => {
  const { api } = loadModule();
  for (const narrative of [
    "The phrase 'convulsions absent' appears in the note.",
    "The phrase ‘chest indrawing present’ appears in the note.",
  ]) {
    const draft = api.extractClinicalCandidate(narrative);
    assert.ok(Object.values(draft.dangerObservations).every((value) => value === "NOT_ASSESSED"), narrative);
    assert.notEqual(api.routeInput(narrative), "CLINICAL", narrative);
  }
  const asserted = api.extractClinicalCandidate(
    "The child's chest indrawing was absent. The caregiver's child can't drink or breastfeed.",
  );
  assert.equal(asserted.dangerObservations.chestIndrawing, "ABSENT");
  assert.equal(asserted.dangerObservations.cannotDrinkOrBreastfeed, "PRESENT");
});

test("the exact all-seven absent aggregate routes clinically with or without age", () => {
  const { api } = loadModule();
  for (const narrative of [
    "All seven observations absent.",
    "Two year old child; all seven structured danger and breathing observations were recorded absent.",
  ]) {
    assert.equal(api.routeInput(narrative), "CLINICAL", narrative);
    assert.ok(Object.values(api.extractClinicalCandidate(narrative).dangerObservations).every((value) => value === "ABSENT"));
  }
});

test("bare noun mentions and uncertain predicates remain unassessed", () => {
  const { api } = loadModule();
  const narratives = [
    "Convulsions.",
    "Chest indrawing.",
    "Stridor when calm.",
    "Low oxygen or central cyanosis.",
    "Convulsions may be present.",
    "Convulsions might occur.",
    "Possible convulsions.",
    "Suspected convulsions.",
    "Convulsions uncertain.",
    "Cannot rule out convulsions.",
  ];
  for (const narrative of narratives) {
    assert.ok(Object.values(api.extractClinicalCandidate(narrative).dangerObservations)
      .every((value) => value === "NOT_ASSESSED"), narrative);
  }
});

test("recognized positive predicates prove every observation without bare-label fallback", () => {
  const { api } = loadModule();
  const cases = [
    ["cannotDrinkOrBreastfeed", "The child cannot breastfeed."],
    ["vomitsEverything", "The child vomits everything."],
    ["convulsions", "The caregiver reported convulsions."],
    ["lethargicOrUnconscious", "The child is unconscious."],
    ["chestIndrawing", "The worker observed chest indrawing."],
    ["stridorWhenCalm", "Stridor when calm was noted."],
    ["lowOxygenOrCentralCyanosis", "Low oxygen was recorded as present."],
  ];
  for (const [key, narrative] of cases) {
    const draft = api.extractClinicalCandidate(narrative);
    assert.equal(draft.dangerObservations[key], "PRESENT", narrative);
    assert.deepEqual(draft.conflicts, [], narrative);
  }
});

test("recognized negative predicates include observation and documentation absence", () => {
  const { api } = loadModule();
  const narratives = [
    "Convulsions were not observed.",
    "Convulsions were not documented.",
    "No evidence of convulsions.",
    "No clear convulsions.",
    "No clear evidence of convulsions.",
    "The worker documented convulsions as absent.",
    "Convulsions were recorded as absent.",
  ];
  for (const narrative of narratives) {
    assert.equal(api.extractClinicalCandidate(narrative).dangerObservations.convulsions, "ABSENT", narrative);
  }
});

test("quote masking supports internal apostrophes and aggregate absence requires a declarative clause", () => {
  const { api } = loadModule();
  for (const narrative of [
    "The phrase 'the child's convulsions were absent' appears in the note.",
    'The phrase "the caregiver\'s chest indrawing was present" appears in the note.',
    "The phrase ‘the child’s stridor when calm was present’ appears in the note.",
  ]) {
    assert.ok(Object.values(api.extractClinicalCandidate(narrative).dangerObservations)
      .every((value) => value === "NOT_ASSESSED"), narrative);
  }
  for (const narrative of ["Not all seven observations absent.", "All seven observations absent?"]) {
    assert.notEqual(api.routeInput(narrative), "CLINICAL", narrative);
    assert.ok(Object.values(api.extractClinicalCandidate(narrative).dangerObservations)
      .every((value) => value === "NOT_ASSESSED"), narrative);
  }
});

test("uncertain and meta clauses suppress every observation polarity", () => {
  const { api } = loadModule();
  const narratives = [
    "Possible chest indrawing was observed.",
    "Chest indrawing is possibly present.",
    "The child may have convulsions.",
    "Low oxygen was suspected and recorded as present.",
    "Cannot rule out stridor when calm was observed.",
    "Training example: the child cannot drink or breastfeed.",
    "Example: the child vomits everything.",
    "The phrase chest indrawing is present.",
    "The word convulsions was documented as present.",
    "The note says the child is lethargic.",
  ];
  for (const narrative of narratives) {
    const draft = api.extractClinicalCandidate(narrative);
    assert.ok(Object.values(draft.dangerObservations).every((value) => value === "NOT_ASSESSED"), narrative);
    assert.notEqual(api.routeInput(narrative), "CLINICAL", narrative);
  }
});

test("recorded predicates and are copulas resolve before generic documentation status", () => {
  const { api } = loadModule();
  const cases = [
    ["Chest indrawing was documented as present.", "chestIndrawing", "PRESENT"],
    ["Chest indrawing was documented as absent.", "chestIndrawing", "ABSENT"],
    ["Convulsions are recorded present.", "convulsions", "PRESENT"],
    ["Convulsions are recorded as absent.", "convulsions", "ABSENT"],
    ["Stridor when calm is noted.", "stridorWhenCalm", "PRESENT"],
    ["Low oxygen or central cyanosis are absent.", "lowOxygenOrCentralCyanosis", "ABSENT"],
  ];
  for (const [narrative, key, expected] of cases) {
    assert.equal(api.extractClinicalCandidate(narrative).dangerObservations[key], expected, narrative);
  }
});

test("explicit without, does-not-have, and ruled-out predicates negate all seven observations", () => {
  const { api } = loadModule();
  const cases = [
    ["cannotDrinkOrBreastfeed", "Cannot drink or breastfeed was ruled out."],
    ["vomitsEverything", "The child does not vomit everything."],
    ["convulsions", "The child does not have convulsions."],
    ["lethargicOrUnconscious", "The child is without lethargy or unconsciousness."],
    ["chestIndrawing", "The child was without chest indrawing."],
    ["stridorWhenCalm", "The child is without stridor when calm."],
    ["lowOxygenOrCentralCyanosis", "Low oxygen or central cyanosis was ruled out."],
  ];
  for (const [key, narrative] of cases) {
    const draft = api.extractClinicalCandidate(narrative);
    assert.equal(draft.dangerObservations[key], "ABSENT", narrative);
    assert.ok(Object.values(draft.dangerObservations).every((value) => value !== "PRESENT"), narrative);
    assert.equal(api.routeInput(narrative), "CLINICAL", narrative);
  }
});

test("common negating introducers never become positive observation authority", () => {
  const { api } = loadModule();
  const cases = [
    ["convulsions", "The child has never had convulsions."],
    ["convulsions", "The child has not had convulsions."],
    ["convulsions", "No reported convulsions."],
    ["chestIndrawing", "No observed chest indrawing."],
    ["chestIndrawing", "The child does not show chest indrawing."],
    ["cannotDrinkOrBreastfeed", "The child has never been unable to drink or breastfeed."],
  ];
  for (const [key, narrative] of cases) {
    const draft = api.extractClinicalCandidate(narrative);
    assert.equal(draft.dangerObservations[key], "ABSENT", narrative);
    assert.ok(Object.values(draft.dangerObservations).every((value) => value !== "PRESENT"), narrative);
  }
});

test("observation-aware segments isolate uncertainty and meta context without losing independent facts", () => {
  const { api } = loadModule();
  const cases = [
    "Possible convulsions, chest indrawing is present.",
    "Possible convulsions and chest indrawing was documented as present.",
    "Hypothetical convulsions are present, chest indrawing is present.",
    "Convulsions are present for example, chest indrawing is present.",
    "This example has convulsions, chest indrawing is present.",
  ];
  for (const narrative of cases) {
    const draft = api.extractClinicalCandidate(narrative);
    assert.equal(draft.dangerObservations.convulsions, "NOT_ASSESSED", narrative);
    assert.equal(draft.dangerObservations.chestIndrawing, "PRESENT", narrative);
    assert.equal(api.routeInput(narrative), "CLINICAL", narrative);
  }
});

test("structural segmentation preserves coordinated absence and explicit opposite-polarity conflicts", () => {
  const { api } = loadModule();
  const shared = api.extractClinicalCandidate(
    "Cannot drink or breastfeed, vomits everything, convulsions, lethargic or unconscious, chest indrawing, stridor when calm, and low oxygen or central cyanosis were absent.",
  );
  assert.ok(Object.values(shared.dangerObservations).every((value) => value === "ABSENT"));
  for (const narrative of [
    "Has convulsions, convulsions were absent.",
    "Convulsions were absent and the child has convulsions.",
  ]) {
    const draft = api.extractClinicalCandidate(narrative);
    assert.equal(draft.dangerObservations.convulsions, "NOT_ASSESSED", narrative);
    assert.ok(draft.conflicts.includes("dangerObservations.convulsions"), narrative);
  }
});

test("never-had and has-or-had-not-shown negate every recognized finding label", () => {
  const { api } = loadModule();
  const findings = [
    ["cannotDrinkOrBreastfeed", "cannot drink or breastfeed"],
    ["vomitsEverything", "vomit everything"],
    ["convulsions", "convulsions"],
    ["lethargicOrUnconscious", "lethargic or unconscious"],
    ["chestIndrawing", "chest indrawing"],
    ["stridorWhenCalm", "stridor when calm"],
    ["lowOxygenOrCentralCyanosis", "low oxygen or central cyanosis"],
  ];
  for (const [key, finding] of findings) {
    for (const narrative of [
      `The child never had ${finding}.`,
      `The child has not shown ${finding}.`,
      `The child had not shown ${finding}.`,
    ]) {
      const draft = api.extractClinicalCandidate(narrative);
      assert.equal(draft.dangerObservations[key], "ABSENT", narrative);
      assert.ok(Object.values(draft.dangerObservations).every((value) => value !== "PRESENT"), narrative);
    }
  }
});

test("example-showing and example-patient clauses carry no observation authority", () => {
  const { api } = loadModule();
  for (const narrative of [
    "An example shows chest indrawing.",
    "Example patient has convulsions.",
  ]) {
    const draft = api.extractClinicalCandidate(narrative);
    assert.ok(Object.values(draft.dangerObservations).every((value) => value === "NOT_ASSESSED"), narrative);
    assert.notEqual(api.routeInput(narrative), "CLINICAL", narrative);
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
