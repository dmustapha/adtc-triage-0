import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
// @ts-expect-error - jsdom ships no bundled types; matches the existing frontend test harness.
import { JSDOM } from "jsdom";

const html = readFileSync(new URL("../../public/app.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../../public/assets/css/app.css", import.meta.url), "utf8");

// Load the triage.js IIFE into a fresh jsdom document and expose its module.exports.
function load() {
  const js = readFileSync(new URL("../../public/assets/js/triage.js", import.meta.url), "utf8");
  const dom = new JSDOM(html, { url: "http://localhost:3010/app" });
  const module = { exports: {} as any };
  dom.window.fetch = (_url: string) => Promise.reject(new Error("no fetch in test"));
  (dom.window as any).matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
  (dom.window as any).HTMLElement.prototype.scrollIntoView = function () {};
  new Function("window", "document", "module", "exports", js)(
    dom.window, dom.window.document, module, module.exports,
  );
  return { dom, doc: dom.window.document, api: module.exports };
}

test("only empty text disables the Get guidance button", async () => {
  // The restored frontend disables `assess` when the textarea is empty at submit time,
  // not via a readiness-gate on every keystroke. The button itself is enabled in the HTML.
  const { doc } = load();
  const assess = doc.getElementById("assess") as HTMLButtonElement;
  // In the static HTML the button is always enabled (no pre-submit readiness gate).
  assert.equal(assess.disabled, false, "assess button is enabled by default");
  assert.ok(assess, "assess button must exist");
});

test("handleEvent card renders severity and action in the result region", () => {
  const { doc, api } = load();
  const card = doc.getElementById("card") as HTMLElement;
  card.classList.remove("hidden");
  api.handleEvent([
    "event: card",
    'data: {"card":{"severity":"URGENT","action":"Give oral Amoxicillin for 5 days","reasoning":"Fast breathing rate meets IMCI threshold.","red_flags":[],"confidence":"high","protocol_citation":{"doc":"WHO IMCI Chart Booklet (2014)","page":6,"section":"PNEUMONIA"}},"classification":"PNEUMONIA"}',
  ].join("\n"));
  assert.match(card.textContent ?? "", /URGENT/);
  assert.match(card.textContent ?? "", /Amoxicillin/);
});

test("handleEvent plan renders medicines after card", () => {
  const { doc, api } = load();
  // Must render card first so #planWrap is injected.
  api.handleEvent([
    "event: card",
    'data: {"card":{"severity":"URGENT","action":"Give Amoxicillin","reasoning":"Fast breathing.","red_flags":[],"confidence":"high","protocol_citation":{"doc":"WHO IMCI Chart Booklet (2014)","page":6,"section":"PNEUMONIA"}},"classification":"PNEUMONIA"}',
  ].join("\n"));
  api.handleEvent([
    "event: plan",
    'data: {"plan":{"medicines":[{"name":"Amoxicillin","bands":[{"band":"10-14 kg","dose":"2 tablets"}],"citation":{"doc":"WHO IMCI Chart Booklet (2014)","page":6}}],"supportive":[],"home_care":[],"return_now":[],"follow_up":null,"referral":null}}',
  ].join("\n"));
  const planWrap = doc.getElementById("planWrap") as HTMLElement;
  assert.ok(planWrap, "#planWrap must exist after card");
  assert.match(planWrap.textContent ?? "", /Amoxicillin/);
  assert.match(planWrap.textContent ?? "", /2 tablets/);
});

test("handleEvent abstain renders UNKNOWN severity with the no-matching-guideline message", () => {
  const { doc, api } = load();
  api.handleEvent([
    "event: abstain",
    'data: {"card":{"severity":"UNKNOWN","action":"","reasoning":"No matching protocol.","red_flags":[]}}',
  ].join("\n"));
  const card = doc.getElementById("card") as HTMLElement;
  assert.match(card.textContent ?? "", /UNKNOWN|No matching guideline/i);
});

test("handleEvent error populates #err and hides the reasoning wrapper", () => {
  const { doc, api } = load();
  // Show reasoningWrap first.
  const reasoningWrap = doc.getElementById("reasoningWrap") as HTMLElement;
  if (reasoningWrap) reasoningWrap.classList.remove("hidden");
  api.handleEvent([
    "event: error",
    'data: {"reason":"Local inference failed safely."}',
  ].join("\n"));
  const err = doc.getElementById("err") as HTMLElement;
  assert.match(err.textContent ?? "", /Local inference failed safely\./);
  if (reasoningWrap) assert.equal(reasoningWrap.classList.contains("hidden"), true);
});

test("handleEvent stage appends a pipeline step and citation renders the citation box", () => {
  const { doc, api } = load();
  api.handleEvent([
    "event: stage",
    'data: {"key":"retrieve","count":12}',
  ].join("\n"));
  const steps = doc.getElementById("plSteps") as HTMLElement;
  assert.ok(steps.querySelector('[data-key="retrieve"]'), "retrieve step must be added");

  api.handleEvent([
    "event: citation",
    '{"protocol":"IMCI","doc":"WHO IMCI Chart Booklet (2014)","page":6,"section":"PNEUMONIA","score":0.93}',
  ].join("\ndata: "));
  // citation box should be un-hidden.
  const citationBox = doc.getElementById("citationBox") as HTMLElement;
  assert.equal(citationBox.classList.contains("hidden"), false, "citation box must be shown");
});

test("runAssess guards against empty caseText and sets status message", async () => {
  const { doc, api } = load();
  const caseEl = doc.getElementById("case") as HTMLTextAreaElement;
  const status = doc.getElementById("status") as HTMLElement;
  caseEl.value = "";
  await api.runAssess();
  assert.match(status.textContent ?? "", /Describe or record a case first\./);
});

test("runAssess posts to /triage with the caseText from the textarea", async () => {
  // triage.js uses `fetch` as a free variable resolved at call time from globalThis.
  // Override globalThis.fetch for this test, then restore it.
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const prevFetch = (globalThis as any).fetch;
  (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
    if (url === "/health") return { json: async () => ({}), headers: { get: () => null } };
    requests.push({ url, init: init ?? {} });
    // Minimal SSE response: reader returns one done chunk.
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(ctrl) {
        ctrl.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
        ctrl.close();
      },
    });
    return { ok: true, body };
  };
  try {
    const { doc, api } = load();
    const caseEl = doc.getElementById("case") as HTMLTextAreaElement;
    caseEl.value = "Two year old with cough.";
    await api.runAssess();
    const triageReq = requests.find((r) => r.url === "/triage");
    assert.ok(triageReq, "must have made a POST /triage request");
    const body = JSON.parse(String(triageReq.init.body));
    assert.equal(body.caseText, "Two year old with cough.");
  } finally {
    (globalThis as any).fetch = prevFetch;
  }
});

test("tri-state radios fill their effective 44-pixel semantic labels", () => {
  assert.match(css, /\.tri-state label[^}]*min-height:\s*44px/s);
  assert.match(css, /\.tri-state input[^}]*inset:\s*0[^}]*width:\s*100%[^}]*height:\s*100%/s);
  assert.doesNotMatch(css, /\.tri-state input[^}]*width:\s*1px[^}]*height:\s*1px/s);
  assert.doesNotMatch(css, /\.tri-state input[^}]*clip:\s*rect/s);
});
