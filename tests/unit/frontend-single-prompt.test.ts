// tests/unit/frontend-single-prompt.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const html = readFileSync(new URL("../../public/app.html", import.meta.url), "utf8");
const doc = new JSDOM(html).window.document;

test("single-prompt UI: textarea + Get guidance + result region present", () => {
  assert.ok(doc.getElementById("case"), "#case textarea");
  assert.ok(doc.getElementById("assess"), "#assess button");
  assert.ok(doc.getElementById("plSteps"), "#plSteps pipeline readout");
  assert.ok(doc.getElementById("card"), "#card");
});

test("no checklist / gate / tab surfaces remain", () => {
  for (const id of ["dangerChecklist", "dangerDisclosure", "respiratoryAssessment", "continuationRegion",
    "confirmationRegion", "intentChoice", "patientWeightKg", "patientAgeValue", "assessmentFocus"]) {
    assert.equal(doc.getElementById(id), null, `#${id} must be removed`);
  }
  assert.equal(doc.querySelector('[name^="danger-"]'), null, "no danger-sign radios");
});
