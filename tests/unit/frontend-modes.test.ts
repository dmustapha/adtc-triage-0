import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
// @ts-expect-error jsdom does not bundle declarations in this workspace.
import { JSDOM } from "jsdom";

const html = readFileSync(new URL("../../public/app.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../../public/assets/css/app.css", import.meta.url), "utf8");
const script = readFileSync(new URL("../../public/assets/js/triage.js", import.meta.url), "utf8");
const page = new JSDOM(html).window.document;

test("the application exposes one unified workflow without persistent modes", () => {
  assert.equal(page.querySelectorAll('[role="tablist"], .mode-tab').length, 0);
  assert.equal(page.querySelectorAll("textarea[data-unified-input]").length, 1);
  assert.equal(page.querySelectorAll("[data-unified-submit]").length, 1);
  assert.match(css, /\[hidden\]\s*\{[^}]*display:\s*none\s*!important/s, "author CSS must not override inactive tab panels");
});

test("clinical and ordinary paths share the same textarea and result region", () => {
  assert.ok(page.querySelector("textarea#case[name='case'][data-unified-input]"));
  assert.ok(page.querySelector("#result #sharedAnswer"));
  assert.ok(page.querySelector("#result #card"));
  assert.equal(page.querySelector("#ordinaryPrompt, #promptResult"), null);
  assert.match(script, /function clinicalInput\(\)\s*\{\s*return \$\("case"\)/);
});

test("clinical confirmation and safety controls are explicitly labelled", () => {
  for (const id of [
    "patientWeightKg", "allergiesReviewed", "contraindicationsReviewed", "protocolApplicability",
    "confirmAssessment", "correctAssessment", "rejectAssessment",
  ]) assert.ok(page.getElementById(id), `${id} is present`);
  assert.equal(page.querySelector("label[for='patientWeightKg']")?.textContent?.trim(), "Patient weight (kg)");
  assert.match(page.getElementById("confirmationRegion")?.getAttribute("aria-live") ?? "", /polite/);
  assert.equal(page.getElementById("confirmationStatus")?.getAttribute("role"), "status");
  assert.match(script, /confirmationRegion"\)\.setAttribute\("aria-busy",\s*"true"\)/);
  assert.match(script, /Complete the allergy, contraindication, and protocol-applicability review/);
  assert.match(script, /\[data-danger-key\][\s\S]*aria-invalid/);
  assert.match(script, /respiratoryRatePerMinute"\)\.setAttribute\("aria-invalid"/);
});

test("submitted-prompt shortcuts are absent while shared recovery regions remain", () => {
  assert.equal(page.querySelector("#promptExample1, #promptExample2, #runPrompt"), null);
  assert.ok(page.querySelector("#intentChoice[aria-live=polite]"));
  assert.ok(page.querySelector("#sharedAnswer[aria-live=polite]"));
});

test("ordinary prompt terminal events replace the in-progress status truthfully", () => {
  assert.match(script, /event === "answer"[\s\S]{0,180}"status"\)\.textContent = "Complete\."/);
  assert.match(script, /event === "rejected"[\s\S]{0,700}"status"\)\.textContent = "Answer withheld\."/);
  assert.match(script, /event === "error"[\s\S]{0,180}"status"\)\.textContent = "Local assistance unavailable\."/);
});

test("new interactive controls retain 44-pixel targets and mobile wrapping", () => {
  assert.match(css, /\.tri-state label[^}]*min-height:\s*44px/s);
  assert.match(css, /\.tri-state input[^}]*width:\s*100%[^}]*height:\s*100%/s);
  assert.match(css, /\.confirmation-actions[^}]*flex-wrap:\s*wrap/s);
  assert.match(css, /@media\s*\(max-width:\s*560px\)[\s\S]*\.danger-signs/s);
});
