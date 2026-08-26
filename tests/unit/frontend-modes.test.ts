import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
// @ts-expect-error jsdom does not bundle declarations in this workspace.
import { JSDOM } from "jsdom";

const html = readFileSync(new URL("../../public/app.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../../public/assets/css/app.css", import.meta.url), "utf8");
const script = readFileSync(new URL("../../public/assets/js/triage.js", import.meta.url), "utf8");
const page = new JSDOM(html).window.document;

test("the application exposes separate accessible clinical and ordinary-prompt modes", () => {
  const tabs = page.querySelector('[role="tablist"][aria-label="Workflow mode"]');
  assert.ok(tabs);
  const clinical = page.querySelector<HTMLButtonElement>('[role="tab"][data-mode="clinical"]');
  const prompt = page.querySelector<HTMLButtonElement>('[role="tab"][data-mode="prompt"]');
  assert.equal(clinical?.getAttribute("aria-selected"), "true");
  assert.equal(prompt?.getAttribute("aria-selected"), "false");
  assert.equal(clinical?.getAttribute("aria-controls"), "clinicalModePanel");
  assert.equal(prompt?.getAttribute("aria-controls"), "promptModePanel");
  assert.ok(page.querySelector("#clinicalModePanel[data-testid='clinical-mode']"));
  assert.ok(page.querySelector("#promptModePanel[data-testid='prompt-mode'][hidden]"));
  assert.match(css, /\[hidden\]\s*\{[^}]*display:\s*none\s*!important/s, "author CSS must not override inactive tab panels");
});

test("clinical and ordinary prompt text remain separate inputs", () => {
  assert.ok(page.querySelector("textarea#clinicalCase[name='clinicalCase']"));
  assert.ok(page.querySelector("textarea#ordinaryPrompt[name='ordinaryPrompt']"));
  assert.match(script, /clinicalCase/);
  assert.match(script, /ordinaryPrompt/);
  assert.doesNotMatch(script, /ordinaryPrompt[^\n]{0,120}(?:clinicalCase|caseText)\s*=|clinicalCase[^\n]{0,120}ordinaryPrompt\s*=/);
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

test("ordinary prompt mode has exact examples, run, cancel, retry, status, and result regions", () => {
  for (const id of ["promptExample1", "promptExample2", "runPrompt", "cancelPrompt", "retryPrompt", "promptStatus", "promptResult"]) {
    assert.ok(page.getElementById(id), `${id} is present`);
  }
  assert.equal(page.getElementById("promptStatus")?.getAttribute("role"), "status");
  assert.equal(page.getElementById("promptResult")?.getAttribute("aria-live"), "polite");
});

test("ordinary prompt terminal events replace the in-progress status truthfully", () => {
  assert.match(script, /event === "answer"[\s\S]{0,180}promptStatus"\)\.textContent = "Complete\."/);
  assert.match(script, /event === "rejected"[\s\S]{0,700}promptStatus"\)\.textContent = "Answer withheld\."/);
  assert.match(script, /event === "error"[\s\S]{0,180}promptStatus"\)\.textContent = "Local assistance unavailable\."/);
});

test("new interactive controls retain 44-pixel targets and mobile wrapping", () => {
  assert.match(css, /\.mode-tab[^}]*min-height:\s*44px/s);
  assert.match(css, /\.workflow-actions[^}]*flex-wrap:\s*wrap/s);
  assert.match(css, /\.confirmation-actions[^}]*flex-wrap:\s*wrap/s);
  assert.match(css, /@media\s*\(max-width:\s*560px\)[\s\S]*\.mode-switch/s);
});
