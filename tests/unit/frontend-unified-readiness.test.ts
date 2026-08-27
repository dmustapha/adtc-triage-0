import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
// @ts-expect-error jsdom does not bundle declarations in this workspace.
import { JSDOM } from "jsdom";

const root = new URL("../../", import.meta.url);
const html = readFileSync(new URL("public/app.html", root), "utf8");
const css = readFileSync(new URL("public/assets/css/app.css", root), "utf8");
const source = readFileSync(new URL("public/assets/js/triage.js", root), "utf8");
const dom = new JSDOM(html, { url: "http://localhost:3010/app" });
const page = dom.window.document;
const globals = globalThis as Record<string, unknown>;
globals.window = dom.window;
globals.document = page;
const triageRequests: Array<{ url: string; init?: RequestInit }> = [];
globals.fetch = async (url: string, init?: RequestInit) => {
  if (url === "/health") return {
    json: async () => ({ ready: true, chunks: 994, residentModels: ["medpsy"], medpsy: "1.7b", egress: { armed: true, strict: true, violations: 0 } }),
    headers: { get: () => null },
  };
  triageRequests.push({ url, init });
  return new Response("event: done\ndata: {}\n\n", { status: 200 });
};
(dom.window as any).matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
(dom.window as any).HTMLElement.prototype.scrollIntoView = function () {};
const require = createRequire(import.meta.url);
(dom.window as any).TriageUnifiedInput = require("../../public/assets/js/unified-input.js");
const frontend = require("../../public/assets/js/triage.js") as {
  updateUnifiedReadiness(): Record<string, unknown>;
  runUnified(): Promise<void>;
  handleUnifiedInput(): void;
  unifiedState: { candidate: Record<string, any> | null; revision: number; reviewedRevision: number | null };
  focusMissingField(field: string): void;
  clinicalState: { confirmationToken: string | null; continuationToken: string | null };
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

test("tri-state labels, Space, and Arrow keys operate the semantic radios", () => {
  const group = page.querySelector('[data-danger-key="cannotDrinkOrBreastfeed"]')!;
  const present = group.querySelector('input[value="PRESENT"]') as HTMLInputElement;
  const absent = group.querySelector('input[value="ABSENT"]') as HTMLInputElement;
  let changes = 0;
  group.addEventListener("change", () => { changes += 1; });
  (present.closest("label") as HTMLLabelElement).click();
  assert.equal(present.checked, true);
  assert.equal(changes, 1);
  present.focus();
  present.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  assert.equal(absent.checked, true);
  absent.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: " ", bubbles: true }));
  assert.equal(absent.checked, true);
  assert.ok(changes >= 2);
});

test("every structured authority edit invalidates stale result and review tokens", () => {
  const result = page.getElementById("result")!;
  const card = page.getElementById("card")!;
  for (const [id, event] of [["patientAgeValue", "input"], ["patientWeightKg", "input"], ["respiratoryRatePerMinute", "input"], ["rateCountQuality", "change"]]) {
    result.classList.remove("hidden");
    card.textContent = "stale";
    page.getElementById("confirmationPlan")!.textContent = "stale dose plan";
    frontend.clinicalState.confirmationToken = "confirm-token";
    frontend.clinicalState.continuationToken = "continue-token";
    page.getElementById(id)!.dispatchEvent(new dom.window.Event(event, { bubbles: true }));
    assert.equal(result.classList.contains("hidden"), true, `${id} hides stale result`);
    assert.equal(frontend.clinicalState.confirmationToken, null, `${id} clears confirmation`);
    assert.equal(frontend.clinicalState.continuationToken, null, `${id} clears continuation`);
    assert.equal(page.getElementById("confirmationPlan")!.textContent, "", `${id} clears dose plan`);
  }
  result.classList.remove("hidden");
  card.textContent = "stale";
  page.querySelector('input[name="danger-vomitsEverything"][value="ABSENT"]')!
    .dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  assert.equal(result.classList.contains("hidden"), true);
});

test("assessment completion restores the unified handler and dotted conflicts focus their radio", () => {
  assert.match(source, /finally\s*\{[\s\S]*?\$\("assess"\)\.onclick\s*=\s*runUnified/);
  frontend.focusMissingField("dangerObservations.chestIndrawing");
  assert.equal(page.activeElement?.getAttribute("name"), "danger-chestIndrawing");
});

test("only an explicitly reviewed current candidate enters triage through the schema adapter", async () => {
  triageRequests.length = 0;
  input().value = "Two year old child with cough. Breathing 40 per minute for one minute while calm. All seven danger and breathing observations were recorded absent.";
  frontend.handleUnifiedInput();

  await frontend.runUnified();
  assert.equal(triageRequests.filter(({ url }) => url === "/triage").length, 0);
  assert.notEqual(frontend.unifiedState.reviewedRevision, frontend.unifiedState.revision);
  assert.equal((page.getElementById("dangerDisclosure") as HTMLDetailsElement).open, true);

  await frontend.runUnified();
  const request = triageRequests.find(({ url }) => url === "/triage");
  assert.ok(request);
  const body = JSON.parse(String(request.init?.body));
  assert.deepEqual(body.patientAge, { value: 2, unit: "years" });
  assert.deepEqual(body.dangerObservations, {
    cannotDrinkOrBreastfeed: "ABSENT", vomitsEverything: "ABSENT", convulsions: "ABSENT",
    lethargicOrUnconscious: "ABSENT", chestIndrawing: "ABSENT", stridorWhenCalm: "ABSENT",
    lowOxygenOrCentralCyanosis: "ABSENT",
  });
  assert.deepEqual(body.respiratoryAssessment, {
    coughOrDifficultBreathing: "PRESENT",
    respiratoryRatePerMinute: 40,
    rateCountQuality: "ONE_MINUTE_WHILE_CALM",
  });
  assert.deepEqual(body.medicationSafety, {
    allergiesReviewed: "NOT_ASSESSED", contraindicationsReviewed: "NOT_ASSESSED",
    allergyDetails: [], contraindicationDetails: [],
  });
  assert.deepEqual(body.protocolApplicability, { status: "NOT_ASSESSED", details: [] });
  assert.equal("candidate" in body, false);
  assert.equal(frontend.unifiedState.reviewedRevision, frontend.unifiedState.revision);
});

test("reviewed emergency serialization preserves every unobserved sign as NOT_ASSESSED", async () => {
  triageRequests.length = 0;
  input().value = "Two year old child cannot drink or breastfeed.";
  frontend.handleUnifiedInput();

  await frontend.runUnified();
  assert.equal(triageRequests.filter(({ url }) => url === "/triage").length, 0);
  await frontend.runUnified();

  const request = triageRequests.find(({ url }) => url === "/triage");
  assert.ok(request);
  const body = JSON.parse(String(request.init?.body));
  assert.equal(body.dangerObservations.cannotDrinkOrBreastfeed, "PRESENT");
  assert.deepEqual(Object.values(body.dangerObservations).filter((value) => value === "NOT_ASSESSED").length, 6);
  assert.equal(body.respiratoryAssessment, undefined);
});
