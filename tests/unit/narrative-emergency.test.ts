import { test } from "node:test";
import assert from "node:assert/strict";
import { narrativeEmergencyKeys } from "../../src/triage/supervised-workflow.js";

test("detects an explicit emergency danger sign in the narrative", () => {
  const keys = narrativeEmergencyKeys("18 month old, lethargic and cannot drink, breathing fast");
  assert.ok(keys.includes("lethargicOrUnconscious") || keys.includes("cannotDrinkOrBreastfeed"),
    `expected an emergency key, got ${JSON.stringify(keys)}`);
});

test("a calm below-threshold cough narrative has no emergency keys", () => {
  const keys = narrativeEmergencyKeys("18 month old with cough for three days, breathing 32 per minute, alert and drinking");
  assert.deepEqual(keys, []);
});

test("chest indrawing alone is NOT an emergency key", () => {
  const keys = narrativeEmergencyKeys("2 year old with chest indrawing, alert and drinking, no danger signs");
  assert.ok(!keys.includes("chestIndrawing"));
});
