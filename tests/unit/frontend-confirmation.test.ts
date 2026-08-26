import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../../public/assets/js/triage.js", import.meta.url), "utf8");

test("clinical confirmation has explicit token-bound client state", () => {
  assert.match(source, /var clinicalState\s*=\s*\{[\s\S]*phase:\s*"RECORD"[\s\S]*confirmationToken:\s*null[\s\S]*terminal:\s*false/);
  assert.match(source, /function invalidateConfirmation/);
  assert.match(source, /function invalidateClinicalResult[\s\S]*invalidateConfirmation\(\)/);
  assert.match(source, /clinicalModePanel[\s\S]*(?:input|change)[\s\S]*invalidateClinicalResult/);
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
});
