// tests/unit/frontend-render.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// @ts-expect-error - jsdom ships no bundled types; matches the existing frontend test harness.
import { JSDOM } from "jsdom";

function load() {
  const js = readFileSync(new URL("../../public/assets/js/triage.js", import.meta.url), "utf8");
  const html = readFileSync(new URL("../../public/app.html", import.meta.url), "utf8");
  const dom = new JSDOM(html, { runScripts: "outside-only" });
  const module = { exports: {} as any };
  // Stub fetch before the IIFE runs so the top-level /health call's .catch() swallows the rejection.
  dom.window.fetch = () => Promise.reject(new Error("no fetch in test"));
  new Function("window", "document", "module", js)(dom.window, dom.window.document, module);
  return { dom, api: module.exports };
}

test("renderCard shows severity, classification and action", () => {
  const { dom, api } = load();
  api.renderCard({ severity: "URGENT", action: "Give oral Amoxicillin", reasoning: "fast breathing", red_flags: [] }, "PNEUMONIA");
  const card = dom.window.document.getElementById("card").textContent;
  assert.match(card, /URGENT/);
  assert.match(card, /PNEUMONIA/);
  assert.match(card, /Amoxicillin/);
});

test("renderPlan shows a weight-band dose table and a citation", () => {
  const { dom, api } = load();
  // renderCard first so #planWrap exists
  api.renderCard({ severity: "URGENT", action: "x", reasoning: "y", red_flags: [] }, "PNEUMONIA");
  api.renderPlan({ medicines: [{ name: "Amoxicillin", bands: [{ band: "10 - <14 kg (12 months up to 3 years)", dose: "2 tablets" }], citation: { doc: "WHO IMCI Chart Booklet (2014)", page: 6 } }],
    supportive: [], home_care: [], return_now: [], follow_up: null, referral: null });
  const plan = dom.window.document.getElementById("card").textContent;
  assert.match(plan, /Amoxicillin/);
  assert.match(plan, /2 tablets/);
  assert.match(plan, /p\.6/);
});
