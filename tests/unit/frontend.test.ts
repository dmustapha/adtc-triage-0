// File: tests/unit/frontend.test.ts
// jsdom unit tests for the restored one-flow front-end in public/assets/js/triage.js.
// triage.js is a browser IIFE; it exposes its pure functions via module.exports.
// We stand up a minimal jsdom DOM, stub fetch + matchMedia, require the script, and
// exercise the renderers and event handlers for the card+plan one-flow contract.
import { test, mock } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error - jsdom ships no bundled types; tests/ is outside the build-gate tsconfig anyway.
import { JSDOM } from "jsdom";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

// Minimal set of element IDs the restored frontend renderer touches.
const IDS = [
  "status", "citationBox", "reasoningWrap", "reasonLabel", "reasonTimer", "plSteps",
  "card", "err", "result", "hTtft", "assess",
];
const body = `<textarea id="case"></textarea>` +
  IDS.map((id) => `<div id="${id}"></div>`).join("");

const dom = new JSDOM(`<!DOCTYPE html><body>${body}</body>`, { url: "http://localhost:3010/app" });
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
(dom.window as unknown as Record<string, unknown>).matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
(dom.window as unknown as { HTMLElement: { prototype: Record<string, unknown> } }).HTMLElement.prototype.scrollIntoView = function () {};
g.fetch = async () => ({ json: async () => ({}), headers: { get: () => null } });

const require = createRequire(import.meta.url);
const fe = require("../../public/assets/js/triage.js") as {
  esc: (s: string) => string;
  renderCard: (card: Record<string, unknown>, classification?: string) => void;
  renderPlan: (plan: Record<string, unknown>) => void;
  renderStage: (stage: Record<string, unknown>) => void;
  renderCitation: (c: Record<string, unknown>) => void;
  handleEvent: (block: string) => void;
  runAssess: () => Promise<void>;
  startReasonTimer: () => void;
  stopReasonTimer: () => void;
};
const card = () => dom.window.document.getElementById("card")!.innerHTML;
const doc = dom.window.document;
const el = (id: string) => doc.getElementById(id)!;

// ---------------------------------------------------------------------------
// esc — HTML escaping safety
// ---------------------------------------------------------------------------

test("esc escapes HTML metacharacters", () => {
  assert.equal(fe.esc('<a>&"x'), "&lt;a&gt;&amp;&quot;x");
});

// ---------------------------------------------------------------------------
// renderCard — one-flow card rendering
// ---------------------------------------------------------------------------

test("renderCard renders severity, action, and reasoning for an URGENT card", () => {
  fe.renderCard(
    {
      severity: "URGENT",
      action: "Give oral Amoxicillin for 5 days.",
      reasoning: "Fast breathing meets the IMCI threshold.",
      red_flags: [],
      confidence: "high",
      protocol_citation: { doc: "WHO IMCI Chart Booklet (2014)", page: 6, section: "PNEUMONIA" },
    },
    "PNEUMONIA",
  );
  const html = card();
  assert.match(html, /URGENT/);
  assert.match(html, /Amoxicillin/);
  assert.match(html, /Fast breathing meets the IMCI threshold/);
  assert.match(html, /PNEUMONIA/);
  // planWrap is injected to receive the plan event.
  assert.ok(doc.getElementById("planWrap"), "#planWrap must exist after renderCard");
});

test("renderCard for UNKNOWN severity shows no-guideline message and no planWrap", () => {
  fe.renderCard({
    severity: "UNKNOWN",
    action: "",
    reasoning: "",
    red_flags: [],
  });
  const html = card();
  assert.match(html, /UNKNOWN/);
  // No planWrap for abstain cards (nothing to plan).
  assert.equal(doc.getElementById("planWrap"), null, "planWrap must not exist for UNKNOWN severity");
});

test("renderCard red_flags are rendered as a list", () => {
  fe.renderCard({
    severity: "EMERGENCY",
    action: "Refer urgently.",
    reasoning: "Chest indrawing present.",
    red_flags: ["Chest indrawing", "Unable to drink"],
    confidence: "high",
    protocol_citation: { doc: "WHO IMCI Chart Booklet (2014)", page: 6, section: "EMERGENCY" },
  });
  const html = card();
  assert.match(html, /Chest indrawing/);
  assert.match(html, /Unable to drink/);
});

// ---------------------------------------------------------------------------
// handleEvent — one-flow event dispatch
// ---------------------------------------------------------------------------

test("handleEvent first_token updates reasonLabel to in-progress text", () => {
  el("reasonLabel").textContent = "Searching the guidelines";
  fe.handleEvent("event: first_token\ndata: " + JSON.stringify({ ttftMs: 1200 }));
  assert.equal(el("reasonLabel").textContent, "Reasoning through the protocol");
  assert.equal(el("hTtft").textContent, "1.2 s");
});

test("handleEvent ignores keep-alives and silently skips malformed SSE data", () => {
  // Keep-alives (comment lines) must not throw.
  assert.doesNotThrow(() => fe.handleEvent(": keep-alive"));
  // Malformed JSON data is silently ignored — the error element is not updated.
  assert.doesNotThrow(() => fe.handleEvent("event: card\ndata: {not json"));
  // The err element must remain empty (no false error message for parse failures).
  assert.equal(doc.getElementById("err")?.textContent ?? "", "");
});

// ---------------------------------------------------------------------------
// renderStage — pipeline progress
// ---------------------------------------------------------------------------

test("renderStage appends a step with the correct data-key", () => {
  fe.renderStage({ key: "retrieve", label: "Searching the guidelines", count: 12 });
  const step = doc.querySelector('[data-key="retrieve"]');
  assert.ok(step, "retrieve step must be added by renderStage");
});

// ---------------------------------------------------------------------------
// Reason timer
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// runAssess — abort / stop guard
// ---------------------------------------------------------------------------

test("H-2: Stop aborts the in-flight assessment and restores the button", async () => {
  let fetchCalled = false;
  let abortFired = false;
  g.fetch = (_url: string, opts: { signal: AbortSignal; body: string }) => {
    if (_url === "/health") return Promise.resolve({ json: async () => ({}), headers: { get: () => null } });
    fetchCalled = true;
    return new Promise((_resolve, reject) => {
      opts.signal.addEventListener("abort", () => {
        abortFired = true;
        const e = new Error("aborted");
        (e as { name: string }).name = "AbortError";
        reject(e);
      });
    });
  };
  (el("case") as unknown as { value: string }).value = "child with a cough and fast breathing, alert";
  const assess = el("assess");
  const origLabel = assess.innerHTML;

  const p = fe.runAssess();          // parks on the pending fetch — do NOT await yet
  await Promise.resolve();           // let runAssess reach the fetch await

  assert.ok(fetchCalled, "fetch must be called");
  assert.match(assess.innerHTML, /Stop/, "button enters Stop mode during the run");

  (assess as unknown as { onclick: () => void }).onclick();  // click Stop → abort
  await p;                                                   // propagates through catch + finally

  assert.ok(abortFired, "abort signal must have fired");
  assert.equal(el("status").textContent, "Stopped.", "abort shows Stopped., not an error");
  assert.equal(el("err").textContent, "", "no error text on a user Stop");
  assert.equal(assess.innerHTML, origLabel, "button label restored after Stop");
  assert.match(el("reasoningWrap").className, /hidden/, "reasoning box hidden after Stop");
});

// ---------------------------------------------------------------------------
// CSS — mobile layout checks
// ---------------------------------------------------------------------------

test("mobile controls keep compact hierarchy with comfortable targets", () => {
  const css = readFileSync(new URL("../../public/assets/css/app.css", import.meta.url), "utf8");
  assert.match(css, /\.seed\s*\{[^}]*min-height:\s*44px/s);
  assert.match(css, /\.tri-state label\s*\{[^}]*min-height:\s*44px/s);
  assert.match(css, /@media\s*\(max-width:560px\)/);
});

test("judge-facing copy describes the restored clinical and prompt workflows", () => {
  const appHtml = readFileSync(new URL("../../public/app.html", import.meta.url), "utf8");
  const landingHtml = readFileSync(new URL("../../public/index.html", import.meta.url), "utf8");
  const allText = appHtml + landingHtml;
  // "Get guidance" (or similar) should appear; no confirmation-region copy.
  assert.doesNotMatch(allText, /Confirm reviewed class/i);
  assert.doesNotMatch(allText, /Preparing the assessment summary/);
});
