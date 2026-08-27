import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
// @ts-expect-error jsdom does not bundle declarations in this workspace.
import { JSDOM } from "jsdom";

const root = new URL("../../", import.meta.url);
const html = readFileSync(new URL("public/app.html", root), "utf8");
const css = readFileSync(new URL("public/assets/css/app.css", root), "utf8");
const dom = new JSDOM(html, { url: "http://localhost:3010/app" });
const page = dom.window.document;
const globals = globalThis as Record<string, unknown>;
globals.window = dom.window;
globals.document = page;
globals.fetch = async () => ({
  json: async () => ({ ready: true, chunks: 994, residentModels: ["medpsy"], medpsy: "1.7b", egress: { armed: true, strict: true, violations: 0 } }),
  headers: { get: () => null },
});
(dom.window as any).matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
(dom.window as any).HTMLElement.prototype.scrollIntoView = function () {};
const require = createRequire(import.meta.url);
(dom.window as any).TriageUnifiedInput = require("../../public/assets/js/unified-input.js");
const frontend = require("../../public/assets/js/triage.js") as {
  updateUnifiedReadiness(): Record<string, unknown>;
  runUnified(): Promise<void>;
  handleUnifiedInput(): void;
  unifiedState: { candidate: Record<string, any> | null; revision: number };
};

function input(): HTMLTextAreaElement {
  return page.getElementById("case") as HTMLTextAreaElement;
}

test("only empty text disables the unified primary action", () => {
  const assess = page.getElementById("assess") as HTMLButtonElement;
  input().value = "";
  frontend.updateUnifiedReadiness();
  assert.equal(assess.disabled, true);
  input().value = "Two year old with cough.";
  frontend.updateUnifiedReadiness();
  assert.equal(assess.disabled, false);
});

test("explicit narrative facts populate candidates without inventing missing values", () => {
  input().value = "Two year old with cough.";
  frontend.handleUnifiedInput();
  assert.deepEqual(frontend.unifiedState.candidate?.patientAge, { value: 2, unit: "years" });
  assert.equal((page.getElementById("patientAgeValue") as HTMLInputElement).value, "2");
  assert.equal((page.getElementById("patientAgeUnit") as HTMLSelectElement).value, "years");
  assert.ok(Object.values(frontend.unifiedState.candidate?.dangerObservations ?? {}).every((value) => value === "NOT_ASSESSED"));
});

test("an incomplete clinical click reveals exact missing fields and focuses the first control", async () => {
  input().value = "Two year old with cough.";
  frontend.handleUnifiedInput();
  await frontend.runUnified();
  const review = page.getElementById("dangerDisclosure") as HTMLDetailsElement;
  const missing = page.getElementById("missingReview")!;
  assert.equal(review.hidden, false);
  assert.equal(review.open, true);
  assert.match(missing.textContent ?? "", /cannot drink or breastfeed/i);
  assert.equal(page.activeElement?.getAttribute("name"), "danger-cannotDrinkOrBreastfeed");
  assert.equal((page.getElementById("assess") as HTMLButtonElement).disabled, false);
});

test("editing the narrative invalidates prior candidates and stale results", () => {
  const result = page.getElementById("result")!;
  const priorRevision = frontend.unifiedState.revision;
  result.classList.remove("hidden");
  input().value = "Three year old with no cough.";
  frontend.handleUnifiedInput();
  assert.ok(frontend.unifiedState.revision > priorRevision);
  assert.deepEqual(frontend.unifiedState.candidate?.patientAge, { value: 3, unit: "years" });
  assert.equal(result.classList.contains("hidden"), true);
});

test("tri-state radios fill their effective 44-pixel semantic labels", () => {
  assert.match(css, /\.tri-state label[^}]*min-height:\s*44px/s);
  assert.match(css, /\.tri-state input[^}]*inset:\s*0[^}]*width:\s*100%[^}]*height:\s*100%/s);
  assert.doesNotMatch(css, /\.tri-state input[^}]*width:\s*1px[^}]*height:\s*1px/s);
  assert.doesNotMatch(css, /\.tri-state input[^}]*clip:\s*rect/s);
});
