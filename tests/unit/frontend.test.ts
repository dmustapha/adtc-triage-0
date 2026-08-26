// File: tests/unit/frontend.test.ts
// jsdom unit tests for the front-end render/parse logic in public/assets/js/triage.js.
// triage.js is a browser IIFE; it exposes its pure functions via a browser-safe `module.exports`
// hook (a no-op in the browser). We stand up a jsdom DOM with the app's element IDs, stub fetch +
// matchMedia, then require the script (which runs its harmless auto-wiring) and exercise the renderers.
import { test, mock } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error - jsdom ships no bundled types; tests/ is outside the build-gate tsconfig anyway.
import { JSDOM } from "jsdom";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

// Element IDs the app wiring + supervised assessment renderer touch.
const IDS = [
  "seeds", "rec", "status", "citationBox", "reasoning", "reasoningWrap", "reasonLabel", "reasonTimer",
  "card", "err", "result", "confirmationRegion", "hTtft", "hTps", "hDev", "hChunks", "net", "assess",
];
const DANGER_KEYS = [
  "cannotDrinkOrBreastfeed", "vomitsEverything", "convulsions", "lethargicOrUnconscious",
  "chestIndrawing", "stridorWhenCalm", "lowOxygenOrCentralCyanosis",
] as const;
// `#case` is a <textarea> (runAssess reads `.value`); the rest are plain divs.
const dangerControls = DANGER_KEYS.map((key) =>
  `<fieldset data-danger-key="${key}">` +
  ["PRESENT", "ABSENT", "NOT_ASSESSED"].map((value) =>
    `<label><input type="radio" name="danger-${key}" value="${value}"${value === "NOT_ASSESSED" ? " checked" : ""}>${value}</label>`,
  ).join("") + "</fieldset>",
).join("");
const body = `<textarea id="case"></textarea>` +
  `<input id="patientAgeValue" type="number"><select id="patientAgeUnit"><option value="months">Months</option><option value="years">Years</option></select>` +
  `<select id="assessmentFocus"><option value="RESPIRATORY">Respiratory</option><option value="BROADER_WHO">Broader WHO</option></select>` +
  `<input type="radio" name="respiratory-concern" value="PRESENT"><input type="radio" name="respiratory-concern" value="ABSENT"><input type="radio" name="respiratory-concern" value="NOT_ASSESSED" checked>` +
  `<input id="respiratoryRatePerMinute" type="number"><select id="rateCountQuality"><option value="NOT_CONFIRMED">Not confirmed</option><option value="ONE_MINUTE_WHILE_CALM">One minute while calm</option></select>` +
  `<div id="dangerStatus"></div><div id="dangerSummary"></div>${dangerControls}` +
  IDS.map((id) => `<div id="${id}"></div>`).join("");
const dom = new JSDOM(`<!DOCTYPE html><body>${body}</body>`, { url: "http://localhost:3010/app" });
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
// (navigator is getter-only on the Node global and is only read in the click handler, never at import)
(dom.window as unknown as Record<string, unknown>).matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
// jsdom does not implement scrollIntoView; runAssess calls it. No-op it so the flow does not throw.
(dom.window as unknown as { HTMLElement: { prototype: Record<string, unknown> } }).HTMLElement.prototype.scrollIntoView = function () {};
g.fetch = async () => ({ json: async () => ({ chunks: 994, residentMode: "resident", medpsy: "1.7b" }), headers: { get: () => null } });

const require = createRequire(import.meta.url);
const fe = require("../../public/assets/js/triage.js") as {
  esc: (s: string) => string;
  renderCard: (card: Record<string, unknown>) => void;
  renderReferenceActions: (result: Record<string, unknown>) => void;
  handleEvent: (block: string) => void;
  runAssess: () => Promise<void>;
  startReasonTimer: () => void;
  stopReasonTimer: () => void;
  readStructuredDanger: () => Record<string, unknown>;
  updateDangerChecklist: () => boolean;
  invalidateClinicalResult: () => void;
  renderProvisional: (data: Record<string, unknown>) => void;
  sendConfirmation: (decision: "CONFIRM" | "REJECT") => Promise<void>;
  clinicalState: { phase: string; confirmationToken: string | null };
};
const card = () => dom.window.document.getElementById("card")!.innerHTML;

test("structured checklist markup is accessible, clinically labelled, and has no CONFLICT choice", () => {
  const html = readFileSync(new URL("../../public/app.html", import.meta.url), "utf8");
  const page = new JSDOM(html).window.document;
  assert.equal(page.querySelector("#dangerChecklist legend")?.textContent?.trim(), "Danger and breathing signs checklist");
  assert.equal(page.querySelectorAll("#dangerChecklist fieldset[data-danger-key]").length, 7);
  for (const fieldset of page.querySelectorAll("#dangerChecklist fieldset[data-danger-key]")) {
    assert.equal(fieldset.querySelectorAll('input[type="radio"]').length, 3);
    assert.equal(fieldset.querySelector('input[value="NOT_ASSESSED"]')?.hasAttribute("checked"), true);
  }
  assert.ok(page.querySelector('label[for="patientAgeValue"]'));
  assert.ok(page.querySelector('label[for="patientAgeUnit"]'));
  assert.ok(page.querySelector("#dangerStatus[role=status]"));
  assert.equal(page.querySelectorAll('input[value="CONFLICT"]').length, 0);
  assert.match(page.querySelector('[data-danger-key="chestIndrawing"] legend')?.textContent || "", /breathing observation/i);
  assert.doesNotMatch(page.querySelector('[data-danger-key="chestIndrawing"] legend')?.textContent || "", /general danger sign/i);
  assert.match(html, /Cannot drink or breastfeed/);
  assert.match(html, /Vomits everything/);
  assert.match(html, /Lethargic or unconscious/);
  assert.match(html, /Stridor when calm/);
  assert.match(html, /Low oxygen or central cyanosis/);
});

test("judge-facing copy describes the restored clinical and prompt workflows", () => {
  const appHtml = readFileSync(new URL("../../public/app.html", import.meta.url), "utf8");
  const landingHtml = readFileSync(new URL("../../public/index.html", import.meta.url), "utf8");

  assert.match(appHtml, /supervised WHO assessment and local prompt review/i);
  assert.doesNotMatch(appHtml, /<title>[^<]*respiratory assessment|<h1[^>]*>[^<]*pediatric respiratory assessment/i);
  assert.match(landingHtml, /supervised WHO review/i);
  assert.match(landingHtml, /pediatric IMCI and adult mhGAP/i);
  assert.match(landingHtml, /ordinary prompt/i);
  assert.doesNotMatch(landingHtml, /Structured respiratory review|child in the supported respiratory age band/i);
});

test("breathing assessment records the WHO pathway, rate, and measurement quality", () => {
  const html = readFileSync(new URL("../../public/app.html", import.meta.url), "utf8");
  const page = new JSDOM(html).window.document;
  const group = page.querySelector("#respiratoryAssessment");

  assert.ok(group, "a structured breathing assessment is present");
  assert.match(group?.textContent || "", /cough or difficult breathing/i);
  assert.equal(group?.querySelectorAll('input[name="respiratory-concern"]').length, 3);
  assert.ok(group?.querySelector('label[for="respiratoryRatePerMinute"]'));
  assert.ok(group?.querySelector("#respiratoryRatePerMinute[type=number]"));
  assert.ok(group?.querySelector('label[for="rateCountQuality"]'));
  assert.match(group?.textContent || "", /one minute while.*calm/i);
  assert.ok(page.querySelector('label[for="assessmentFocus"]'));
  assert.match(page.querySelector("#assessmentFocus")?.textContent || "", /other WHO symptom review/i);
});

test("editing a clinical record invalidates the previously rendered result", () => {
  el("result").className = "";
  el("card").textContent = "No Escalation Criterion Recorded";
  el("citationBox").className = "";
  el("citationBox").textContent = "WHO reference";

  fe.invalidateClinicalResult();

  assert.match(el("result").className, /hidden/);
  assert.equal(el("card").textContent, "");
  assert.match(el("citationBox").className, /hidden/);
  assert.equal(el("citationBox").textContent, "");
  assert.equal(el("status").textContent, "Recorded data changed. Run the assessment again.");
});

test("a late confirmation response cannot restore actions after the record changes", async () => {
  let resolveResponse!: (value: unknown) => void;
  g.fetch = () => new Promise((resolve) => { resolveResponse = resolve; });
  fe.renderProvisional({ token: "old-record-token", classification: "COUGH OR COLD", protocol: "IMCI" });

  const pending = fe.sendConfirmation("CONFIRM");
  fe.invalidateClinicalResult();
  resolveResponse({
    ok: true,
    json: async () => ({
      reviewState: "CONFIRMED",
      referenceActions: { supportive: [{ item: "Old-record action" }] },
    }),
  });
  await pending;

  assert.equal(fe.clinicalState.phase, "RECORD");
  assert.equal(fe.clinicalState.confirmationToken, null);
  assert.match(el("confirmationRegion").className, /hidden/);
  assert.doesNotMatch(el("confirmationRegion").textContent, /Old-record action/);
});

test("structured form serializes the respiratory record without narrative inference", () => {
  (doc.querySelector('input[name="respiratory-concern"][value="PRESENT"]') as HTMLInputElement).checked = true;
  (el("respiratoryRatePerMinute") as HTMLInputElement).value = "52";
  (el("rateCountQuality") as HTMLSelectElement).value = "ONE_MINUTE_WHILE_CALM";

  const structured = fe.readStructuredDanger();
  assert.deepEqual(structured.respiratoryAssessment, {
    coughOrDifficultBreathing: "PRESENT",
    respiratoryRatePerMinute: 52,
    rateCountQuality: "ONE_MINUTE_WHILE_CALM",
  });
});

test("structured assessment preserves the pinned compact patient-panel rhythm", () => {
  const html = readFileSync(new URL("../../public/app.html", import.meta.url), "utf8");
  const css = readFileSync(new URL("../../public/assets/css/app.css", import.meta.url), "utf8");
  const page = new JSDOM(html).window.document;
  const disclosure = page.querySelector("details#dangerDisclosure");
  const patientPanel = page.querySelector("#clinicalCase")?.closest(".panel");

  assert.ok(disclosure, "required observations use native progressive disclosure");
  assert.equal(disclosure?.hasAttribute("open"), false, "assessment is compact on first view");
  assert.ok(disclosure?.querySelector("summary #dangerStatus[role=status]"));
  assert.equal(disclosure?.querySelector("#dangerChecklist")?.tagName, "FIELDSET");
  assert.equal(disclosure?.parentElement, patientPanel);
  assert.ok(
    (page.querySelector("#seeds")?.compareDocumentPosition(disclosure!) || 0) & 4,
    "the original text/example rhythm remains ahead of structured observations",
  );
  assert.ok(
    (disclosure?.compareDocumentPosition(page.querySelector(".actions")!) || 0) & 4,
    "the required assessment sits immediately before the guidance action",
  );
  assert.match(css, /\.assessment-disclosure\s*>\s*summary/);
  assert.doesNotMatch(css, /\.danger-checklist\s*\{[^}]*margin:\s*18px 0 0/s);
});

test("structured checklist serializes exact values and enables submission only when complete and age-supported", () => {
  const assess = el("assess") as HTMLButtonElement;
  (el("case") as HTMLTextAreaElement).value = "18-month-old with cough, alert and drinking.";
  (el("patientAgeValue") as HTMLInputElement).value = "18";
  (el("patientAgeUnit") as HTMLSelectElement).value = "months";
  (el("respiratoryRatePerMinute") as HTMLInputElement).value = "";
  (el("rateCountQuality") as HTMLSelectElement).value = "NOT_CONFIRMED";
  assert.equal(fe.updateDangerChecklist(), false);
  assert.equal(assess.disabled, true);
  assert.equal(el("dangerStatus").textContent, "0 of 7 signs assessed.");

  DANGER_KEYS.forEach((key, index) => {
    const value = index === 4 ? "PRESENT" : "ABSENT";
    (doc.querySelector(`input[name="danger-${key}"][value="${value}"]`) as HTMLInputElement).checked = true;
  });
  (doc.querySelector('input[name="respiratory-concern"][value="PRESENT"]') as HTMLInputElement).checked = true;
  assert.equal(fe.updateDangerChecklist(), true);
  assert.equal(assess.disabled, false);
  assert.equal(el("dangerStatus").textContent, "7 of 7 signs assessed. Ready for respiratory assessment.");
  assert.match(el("dangerSummary").textContent || "", /Chest indrawing: Present/);

  assert.deepEqual(fe.readStructuredDanger(), {
    patientAge: { value: 18, unit: "months" },
    dangerObservations: {
      cannotDrinkOrBreastfeed: "ABSENT", vomitsEverything: "ABSENT", convulsions: "ABSENT",
      lethargicOrUnconscious: "ABSENT", chestIndrawing: "PRESENT", stridorWhenCalm: "ABSENT",
      lowOxygenOrCentralCyanosis: "ABSENT",
    },
    respiratoryAssessment: {
      coughOrDifficultBreathing: "PRESENT",
      rateCountQuality: "NOT_CONFIRMED",
    },
  });

  (el("patientAgeValue") as HTMLInputElement).value = "60";
  assert.equal(fe.updateDangerChecklist(), false, "60 months is outside the supported age band");
  assert.equal(assess.disabled, true);
  assert.equal(el("dangerStatus").textContent, "7 of 7 signs assessed. Supported age required: 2 months to under 5 years, or 18 years and older.");

  (el("patientAgeValue") as HTMLInputElement).value = "18";
  (el("patientAgeUnit") as HTMLSelectElement).value = "fortnights";
  assert.equal(fe.updateDangerChecklist(), false, "an unsupported age unit cannot enable submission");
});

test("the UI makes restored non-respiratory IMCI and adult mhGAP workflows reachable", () => {
  const assess = el("assess") as HTMLButtonElement;
  (el("case") as HTMLTextAreaElement).value = "Recorded WHO assessment case.";
  (el("assessmentFocus") as HTMLSelectElement).value = "BROADER_WHO";
  (el("patientAgeValue") as HTMLInputElement).value = "48";
  (el("patientAgeUnit") as HTMLSelectElement).value = "months";
  DANGER_KEYS.forEach((key) => {
    (doc.querySelector(`input[name="danger-${key}"][value="ABSENT"]`) as HTMLInputElement).checked = true;
  });
  (doc.querySelector('input[name="respiratory-concern"][value="ABSENT"]') as HTMLInputElement).checked = true;

  assert.equal(fe.updateDangerChecklist(), true, "a complete non-respiratory child record can reach broad IMCI review");
  assert.equal(assess.disabled, false);
  assert.match(el("dangerStatus").textContent || "", /ready for broader WHO assessment/i);
  assert.equal("respiratoryAssessment" in fe.readStructuredDanger(), false, "broader review cannot accidentally activate respiratory policy");

  (el("patientAgeValue") as HTMLInputElement).value = "30";
  (el("patientAgeUnit") as HTMLSelectElement).value = "years";
  DANGER_KEYS.forEach((key) => {
    (doc.querySelector(`input[name="danger-${key}"][value="NOT_ASSESSED"]`) as HTMLInputElement).checked = true;
  });
  (doc.querySelector('input[name="respiratory-concern"][value="NOT_ASSESSED"]') as HTMLInputElement).checked = true;

  assert.equal(fe.updateDangerChecklist(), true, "an adult narrative can reach mhGAP review without a pediatric respiratory checklist");
  assert.equal(assess.disabled, false);
  assert.match(el("dangerStatus").textContent || "", /adult WHO assessment/i);
  assert.equal("respiratoryAssessment" in fe.readStructuredDanger(), false, "irrelevant adult respiratory fields are omitted");
  (el("assessmentFocus") as HTMLSelectElement).value = "RESPIRATORY";
});

test("esc escapes HTML metacharacters", () => {
  assert.equal(fe.esc('<a>&"x'), "&lt;a&gt;&amp;&quot;x");
});

test("deterministic respiratory cards expose only deterministic respiratory authority", () => {
  fe.renderCard({
    outcome: "ASSESSMENT_REQUIRED",
    finding: "The breathing rate was not recorded, so fast breathing cannot be assessed.",
    basis: "The required structured record is incomplete.",
    nextAssessmentStep: "Count breaths for one minute while the child is calm.",
    missingFields: ["respiratoryAssessment.respiratoryRatePerMinute"],
    recorded: { ageMonths: 18, coughOrDifficultBreathing: "PRESENT", respiratoryRatePerMinute: null, rateCountQuality: "NOT_CONFIRMED", observations: {} },
    thresholdComparison: null,
    sourceRule: { doc: "WHO IMCI Chart Booklet (2014)", page: 6, section: "Count breaths for one minute while calm." },
    assistance: { status: "NOT_RUN", runtime: null, model: null },
    uncertainty: "This limited assessment does not rule out illness.",
  });
  const h = card();
  assert.match(h, /Assessment Required/);
  assert.match(h, /Recorded observations/);
  assert.match(h, /Authoritative source rule/);
  assert.doesNotMatch(h, /Classification|PNEUMONIA|Medicines|Dose|Treatment|Management plan/i);
  assert.equal(dom.window.document.getElementById("planWrap"), null);
});

test("renderCard makes the case-specific finding primary and provenance secondary", () => {
  fe.renderCard({
    outcome: "PROMPT_SUPERVISED_REVIEW",
    finding: "Fast-breathing criterion recorded: 52/min is at or above the WHO threshold of 40/min for 12–59 months.",
    basis: "No emergency observation or chest indrawing was recorded.",
    nextAssessmentStep: "Arrange prompt supervised clinical assessment.",
    matchedCriteria: ["FAST_BREATHING"],
    missingFields: [],
    recorded: {
      ageMonths: 18,
      coughOrDifficultBreathing: "PRESENT",
      respiratoryRatePerMinute: 52,
      rateCountQuality: "ONE_MINUTE_WHILE_CALM",
      observations: Object.fromEntries(DANGER_KEYS.map((key) => [key, "ABSENT"])),
    },
    thresholdComparison: { thresholdPerMinute: 40, respiratoryRatePerMinute: 52, relation: "AT_OR_ABOVE" },
    emergencyObservations: [],
    sourceRule: { doc: "WHO IMCI Chart Booklet (2014)", page: 6, section: "Fast breathing", provenance: "fixed-policy" },
    assistance: { status: "COMPLETED", runtime: "QVAC SDK 0.13.3", model: "qvac/MedPsy-1.7B-GGUF", retrievalMode: "keyword" },
    uncertainty: "This limited finding does not rule out illness.",
  });

  const html = card();
  const findingAt = html.indexOf("Fast-breathing criterion recorded");
  const provenanceAt = html.indexOf("QVAC SDK 0.13.3");
  assert.ok(findingAt >= 0, "the actual finding is rendered");
  assert.match(html, /52\/min[^]*40\/min/i);
  assert.match(html, /Arrange prompt supervised clinical assessment/i);
  assert.ok(provenanceAt > findingAt, "runtime provenance follows the result");
  assert.doesNotMatch(html, /PNEUMONIA|Classification|Medicine|Dose|Treatment|Management plan/i);

  fe.handleEvent("event: provisional\ndata: " + JSON.stringify({ token: "opaque", classification: "PNEUMONIA", protocol: "IMCI" }));
  const provisionalHtml = card();
  const provisionalAt = provisionalHtml.indexOf("Provisional WHO protocol classification");
  assert.ok(provisionalAt > provisionalHtml.indexOf("Recorded observations"), "provisional class follows the recorded policy result");
  assert.ok(provisionalAt < provisionalHtml.indexOf("Model and retrieval assistance"), "provisional class precedes runtime provenance");
});

test("provisional classification is gated by supervised language and a token; plan remains hidden", () => {
  fe.handleEvent("event: card\ndata: " + JSON.stringify({
    card: {
      reviewState: "PROVISIONAL",
      classification: "PNEUMONIA",
      protocol: "IMCI",
      uncertainty: "Provisional WHO protocol classification, not a diagnosis.",
      confirmation: { eligible: true, token: "opaque-token", expiresAt: "2026-08-25T17:00:00.000Z", missingFields: [] },
    },
  }));
  const provisional = card();
  if (/PNEUMONIA/i.test(provisional)) {
    assert.match(provisional, /provisional/i);
    assert.match(provisional, /confirm/i);
  }
  fe.handleEvent("event: plan\ndata: " + JSON.stringify({ plan: { medicines: [{ name: "Amoxicillin", dose: "250 mg" }] } }));
  assert.doesNotMatch(card(), /Amoxicillin|250 mg|Management plan/i, "pre-confirmation plan events are ignored");
});

test("broad WHO cards render a complete supervised result without respiratory placeholders", () => {
  fe.renderCard({
    reviewState: "PROVISIONAL",
    classification: "DEPRESSION",
    protocol: "mhGAP",
    recordedFacts: ["patientAge: 30 years", "convulsions: ABSENT"],
    inferredFacts: [],
    basis: "The reconciled class maps to the frozen WHO mhGAP protocol entry.",
    uncertainty: "This is provisional, not a diagnosis.",
    assistance: { status: "COMPLETED", runtime: "QVAC SDK 0.13.3", model: "qvac/MedPsy-1.7B-GGUF", retrievalMode: "semantic" },
  });

  const provisional = card();
  assert.match(provisional, /Supervised Review Required/i);
  assert.match(provisional, /provisional WHO protocol classification is ready/i);
  assert.match(provisional, /patientAge: 30 years/i);
  assert.match(provisional, /Confirm, correct, or reject/i);
  assert.doesNotMatch(provisional, /undefined|Not Recorded/i);
  assert.doesNotMatch(provisional, /DEPRESSION/i, "the class stays hidden until the provisional event supplies its token");

  fe.renderCard({ reviewState: "UNAVAILABLE", uncertainty: "No matching WHO protocol route was found; supporting evidence was unavailable." });
  const unavailable = card();
  assert.match(unavailable, /Assistance Unavailable/i);
  assert.match(unavailable, /No matching WHO protocol route/i);
  assert.doesNotMatch(unavailable, /undefined|Not Recorded/i);
});

test("confirmed reference actions show dose state only when medicine rows exist", () => {
  const result: Record<string, any> = {
    reviewState: "CONFIRMED",
    referenceActions: { referral: { criterion: "CONSULT A SPECIALIST" }, supportive: [{ item: "Strengthen support" }], medicines: [] },
    doseState: { status: "LOCKED_MISSING_INPUTS", missingFields: ["patientWeightKg"] },
  };
  fe.renderReferenceActions(result);
  assert.match(el("confirmationRegion").textContent, /CONSULT A SPECIALIST|Strengthen support/i);
  assert.doesNotMatch(el("confirmationRegion").textContent, /Dose-band state/i);

  result.referenceActions.medicines = [{ name: "Source medicine row" }];
  fe.renderReferenceActions(result);
  assert.match(el("confirmationRegion").textContent, /Dose-band state: Locked Missing Inputs/i);
});

test("handleEvent dispatches supporting reference then deterministic respiratory card", () => {
  const doc = dom.window.document;
  doc.getElementById("citationBox")!.innerHTML = "";
  fe.handleEvent("event: citation\ndata: " + JSON.stringify({ protocol: "IMCI", doc: "WHO IMCI Chart Booklet (2014)", page: 7, score: 0.8, retrieval: "semantic" }));
  assert.match(doc.getElementById("citationBox")!.innerHTML, /Supporting reference/);
  assert.match(doc.getElementById("citationBox")!.innerHTML, /WHO IMCI Chart Booklet/);
  fe.handleEvent("event: card\ndata: " + JSON.stringify({ card: { outcome: "PROMPT_SUPERVISED_REVIEW", finding: "Fast-breathing criterion recorded.", basis: "52/min is at or above 40/min.", nextAssessmentStep: "Arrange prompt supervised clinical assessment.", recorded: { observations: {} }, thresholdComparison: null, assistance: { status: "COMPLETED", runtime: "QVAC SDK 0.13.3", model: "qvac/MedPsy-1.7B-GGUF", retrievalMode: "semantic" }, uncertainty: "Limited assessment." } }));
  assert.match(card(), /Prompt Supervised Review/);
  assert.doesNotMatch(card(), /severity|sev URGENT/i);
});

test("reference provenance visibly distinguishes fixed policy from retrieved WHO evidence", () => {
  const citationBox = doc.getElementById("citationBox")!;

  citationBox.innerHTML = "";
  fe.handleEvent("event: citation\ndata: " + JSON.stringify({
    protocol: "IMCI",
    doc: "WHO IMCI Chart Booklet (2014)",
    page: 6,
    score: 1,
    retrieval: "deterministic",
    provenance: "fixed-policy",
  }));
  assert.match(citationBox.textContent || "", /Fixed policy reference/i);
  assert.doesNotMatch(citationBox.textContent || "", /Retrieved WHO reference/i);

  citationBox.innerHTML = "";
  fe.handleEvent("event: citation\ndata: " + JSON.stringify({
    protocol: "IMCI",
    doc: "WHO IMCI Chart Booklet (2014)",
    page: 7,
    score: 0.82,
    retrieval: "semantic",
    provenance: "retrieved-reference",
  }));
  assert.match(citationBox.textContent || "", /Retrieved WHO reference/i);
  assert.doesNotMatch(citationBox.textContent || "", /Fixed policy reference/i);
});

test("model-assisted cards visibly expose bounded work and which inputs controlled the result", () => {
  fe.renderCard({
    outcome: "NO_ESCALATION_CRITERION_RECORDED",
    finding: "No escalation criterion was recorded.",
    basis: "32/min is below the threshold of 40/min.",
    nextAssessmentStep: "Continue supervised assessment.",
    recorded: { ageMonths: 18, coughOrDifficultBreathing: "PRESENT", respiratoryRatePerMinute: 32, rateCountQuality: "ONE_MINUTE_WHILE_CALM", observations: {} },
    thresholdComparison: { respiratoryRatePerMinute: 32, thresholdPerMinute: 40, relation: "BELOW" },
    sourceRule: { doc: "WHO IMCI Chart Booklet (2014)", page: 6, section: "Count breaths for one minute while calm." },
    assistance: { status: "COMPLETED", runtime: "QVAC SDK 0.13.3", model: "qvac/MedPsy-1.7B-GGUF", retrievalMode: "semantic", supportingExcerpt: "CLASSIFY PNEUMONIA. Give medicine. 7HPSHUDWXUH" },
    uncertainty: "This limited assessment does not rule out illness.",
  });

  const text = card();
  assert.match(text, /Model and retrieval assistance/i);
  assert.match(text, /Semantic retrieval/i);
  assert.doesNotMatch(text, /Supporting WHO excerpt|CLASSIFY|PNEUMONIA|medicine|7HPSHUDWXUH/i);
});

test("the form truthfully explains structured versus free-text authority before submission", () => {
  const html = readFileSync(new URL("../../public/app.html", import.meta.url), "utf8");
  assert.match(
    html,
    /structured age and observations control escalation[\s\S]*description is used for WHO reference lookup and model-assisted summarization/i,
  );
});

test("the example fills one coherent narrative and structured assessment", () => {
  const html = readFileSync(new URL("../../public/app.html", import.meta.url), "utf8");
  const source = readFileSync(new URL("../../public/assets/js/triage.js", import.meta.url), "utf8");
  assert.match(html, /class="seed"[^>]*data-age-value="18"[^>]*data-observations="absent"/i);
  assert.match(source, /b\.dataset\.observations === "absent"/);
  assert.match(source, /patientAgeValue/);
  assert.match(source, /value="ABSENT"/);
});

test("runtime readiness banner rechecks until supported startup is ready", () => {
  const source = readFileSync(new URL("../../public/assets/js/triage.js", import.meta.url), "utf8");
  assert.match(source, /setTimeout\(refreshHealth,\s*2000\)/);
  assert.match(source, /h\.ready === true[\s\S]*banner\.classList\.add\("hidden"\)/);
});

test("handleEvent renders deterministic assessment-required outcomes", () => {
  fe.handleEvent("event: assessment_required\ndata: " + JSON.stringify({
    card: {
      outcome: "ASSESSMENT_REQUIRED",
      finding: "One or more required observations were not recorded.",
      basis: "The structured record is incomplete.",
      nextAssessmentStep: "Complete every recorded observation before supervised review.",
      missingFields: ["dangerObservations.cannotDrinkOrBreastfeed"],
      uncertainty: "No model was called.",
      recorded: { observations: { cannotDrinkOrBreastfeed: "NOT_ASSESSED" } },
      assistance: { status: "NOT_RUN", runtime: null, model: null },
    },
  }));
  assert.match(card(), /Assessment Required/);
  assert.match(card(), /No model was called/);
});

test("mobile controls keep compact hierarchy with comfortable targets", () => {
  const css = readFileSync(new URL("../../public/assets/css/app.css", import.meta.url), "utf8");
  assert.match(css, /\.seed\s*\{[^}]*min-height:\s*44px/s);
  assert.match(css, /\.tri-state label\s*\{[^}]*min-height:\s*44px/s);
  assert.match(css, /\.tri-state\s*\{[^}]*grid-template-columns:\s*repeat\(3,minmax\(0,1fr\)\)/s);
  assert.match(css, /\.verdict \.outcome-banner\s*\{[^}]*overflow-wrap:\s*anywhere/s);
  assert.match(css, /\.perf-foot a\s*\{[^}]*min-height:\s*44px/s);
  assert.match(css, /@media\s*\(max-width:560px\)/);
});

test("handleEvent ignores keep-alives but surfaces malformed SSE", () => {
  assert.doesNotThrow(() => fe.handleEvent(": keep-alive"));
  assert.doesNotThrow(() => fe.handleEvent("event: card\ndata: {not json"));
  assert.match(document.getElementById("err")?.textContent ?? "", /response was malformed/i);
  assert.match(document.getElementById("err")?.textContent ?? "", /restart the supported app/i);
});

// ── H-1 / H-2 (Phase 5b) ─────────────────────────────────────────────────────────────
const doc = dom.window.document;
const el = (id: string) => doc.getElementById(id)!;

test("H-1: first_token advances the staged assessment label", () => {
  el("reasonLabel").textContent = "Supporting reference found";
  fe.handleEvent("event: first_token\ndata: " + JSON.stringify({ ttftMs: 1200 }));
  assert.equal(el("reasonLabel").textContent, "Preparing the assessment summary");
  assert.equal(el("hTtft").textContent, "1.2 s");
});

test("H-1: reason timer counts whole seconds up and clears on stop", () => {
  mock.timers.enable({ apis: ["setInterval", "Date"] });
  try {
    fe.startReasonTimer();
    mock.timers.tick(1000);
    assert.equal(el("reasonTimer").textContent, "· 1s");
    mock.timers.tick(2000);
    assert.equal(el("reasonTimer").textContent, "· 3s");
    fe.stopReasonTimer();
    assert.equal(el("reasonTimer").textContent, "", "timer text cleared on stop");
  } finally {
    mock.timers.reset();
  }
});

test("H-2: Stop aborts the in-flight assessment, restores the button, and is re-entrancy-guarded", async () => {
  let fetchCalls = 0;
  let requestBody = "";
  // Abort-aware fetch stub: parks until the AbortController fires, then rejects with an AbortError
  // (mirrors what the browser fetch does on signal.abort()).
  g.fetch = (_url: string, opts: { signal: AbortSignal; body: string }) => {
    fetchCalls++;
    requestBody = opts.body;
    return new Promise((_resolve, reject) => {
      opts.signal.addEventListener("abort", () => {
        const e = new Error("aborted");
        (e as { name: string }).name = "AbortError";
        reject(e);
      });
    });
  };
  (el("case") as unknown as { value: string }).value = "child with a cough and fast breathing, alert";
  (el("patientAgeValue") as HTMLInputElement).value = "18";
  (el("patientAgeUnit") as HTMLSelectElement).value = "months";
  DANGER_KEYS.forEach((key) => {
    (doc.querySelector(`input[name="danger-${key}"][value="ABSENT"]`) as HTMLInputElement).checked = true;
  });
  (doc.querySelector('input[name="respiratory-concern"][value="PRESENT"]') as HTMLInputElement).checked = true;
  (el("respiratoryRatePerMinute") as HTMLInputElement).value = "52";
  (el("rateCountQuality") as HTMLSelectElement).value = "ONE_MINUTE_WHILE_CALM";
  fe.updateDangerChecklist();
  const assess = el("assess");
  const origLabel = assess.innerHTML;

  const p = fe.runAssess();          // parks on the pending fetch (do NOT await yet)
  await Promise.resolve();           // let runAssess reach the fetch await
  await fe.runAssess();              // second call must be guarded out while the first is in flight
  assert.equal(fetchCalls, 1, "re-entrancy guard blocks the second run");
  assert.deepEqual(JSON.parse(requestBody), {
    caseText: "child with a cough and fast breathing, alert",
    patientAge: { value: 18, unit: "months" },
    dangerObservations: Object.fromEntries(DANGER_KEYS.map((key) => [key, "ABSENT"])),
    respiratoryAssessment: {
      coughOrDifficultBreathing: "PRESENT",
      respiratoryRatePerMinute: 52,
      rateCountQuality: "ONE_MINUTE_WHILE_CALM",
    },
  });
  assert.match(assess.innerHTML, /Stop/, "button is in Stop mode during the run");
  assert.match(assess.className, /is-stopping/, "neutral Stop styling applied");

  (assess as unknown as { onclick: () => void }).onclick();  // click Stop → abort
  await p;                            // abort propagates through catch + finally

  assert.equal(el("status").textContent, "Stopped.", "abort shows a calm Stopped., not an error");
  assert.equal(el("err").textContent, "", "no error text on a user Stop");
  assert.equal(assess.innerHTML, origLabel, "button label restored after Stop");
  assert.ok(!/is-stopping/.test(assess.className), "Stop styling removed after finish");
  assert.match(el("reasoningWrap").className, /hidden/, "reasoning box hidden after Stop");
});
