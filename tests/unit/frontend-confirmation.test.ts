import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../../public/assets/js/triage.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../../public/assets/css/app.css", import.meta.url), "utf8");

test("clinical confirmation has explicit token-bound client state", () => {
  assert.match(source, /var clinicalState\s*=\s*\{[\s\S]*phase:\s*"RECORD"[\s\S]*confirmationToken:\s*null[\s\S]*terminal:\s*false/);
  assert.match(source, /function invalidateConfirmation/);
  assert.match(source, /function invalidateClinicalResult[\s\S]*invalidateConfirmation\(\)/);
  assert.match(source, /clinicalModePanel[\s\S]*(?:input|change)[\s\S]*invalidateClinicalResult/);
});

test("respiratory continuation is explicit and token-only", () => {
  assert.match(source, /continuationToken:\s*null/);
  assert.match(source, /fetch\("\/triage\/continue"/);
  assert.match(source, /JSON\.stringify\(\{\s*token:\s*token\s*\}\)/s);
  assert.match(source, /Continue to supervised WHO classification/);
  assert.doesNotMatch(source, /\/triage\/continue[\s\S]{0,700}(?:caseText|respiratoryRatePerMinute|classification):/);
});

test("confirmation sends only opaque token and decision", () => {
  assert.match(source, /fetch\("\/triage\/confirm"/);
  assert.match(source, /var token\s*=\s*clinicalState\.confirmationToken/);
  assert.match(source, /JSON\.stringify\(\{\s*token:\s*token,\s*decision:\s*decision\s*\}\)/s);
  assert.doesNotMatch(source, /\/triage\/confirm[\s\S]{0,700}classification:\s*|\/triage\/confirm[\s\S]{0,700}action:\s*/);
});

test("provisional classification is rendered as supervised and actions wait for confirmation", () => {
  assert.match(source, /function renderProvisional/);
  assert.match(source, /Provisional WHO protocol classification/);
  assert.match(source, /Human confirmation is required/);
  assert.match(source, /ev === "provisional"[\s\S]*renderProvisional\(d\)/);
  assert.match(source, /function renderProvisional[\s\S]*confirmationToken\s*=\s*data\.token/);
  assert.doesNotMatch(source, /ev === "plan"/);
});

test("confirmed source actions use text nodes instead of model-authored HTML", () => {
  assert.match(source, /function renderReferenceActions/);
  assert.match(source, /textContent/);
  assert.doesNotMatch(source, /referenceActions[\s\S]{0,500}innerHTML\s*=/);
  assert.match(source, /doseState/);
  for (const label of [
    "Immediate action", "Medicine strength", "Frequency", "Selected source band",
    "Supportive care", "Home care", "Return immediately", "Follow-up timing", "Assess at follow-up",
  ]) assert.match(source, new RegExp(label, "i"));
  assert.match(source, /detailCitation/);
});

test("confirmed dose tables are contained by a shrinkable mobile plan region", () => {
  assert.match(css, /#clinicalModePanel\s*,\s*#result\s*,\s*\.panel[^{}]*\{[^}]*min-width:\s*0/s);
  assert.match(css, /#confirmationPlan[^{}]*\{[^}]*min-width:\s*0/s);
  assert.match(css, /\.medicine-card[^{}]*\{[^}]*min-width:\s*0/s);
  assert.match(css, /\.dose-table-wrap[^{}]*\{[^}]*width:\s*100%[^}]*overflow-x:\s*auto/s);
});
