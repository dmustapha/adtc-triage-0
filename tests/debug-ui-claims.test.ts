import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error - jsdom ships no bundled types; this matches the existing frontend test harness.
import { JSDOM } from "jsdom";

test("pre-run performance panel does not claim an assessment or network proof", () => {
  const html = readFileSync(new URL("../public/app.html", import.meta.url), "utf8");
  const page = new JSDOM(html).window.document;
  const lead = page.querySelector(".perf-lead")?.textContent?.replace(/\s+/g, " ").trim() ?? "";
  const footer = page.querySelector(".perf-foot span")?.textContent?.replace(/\s+/g, " ").trim() ?? "";

  assert.doesNotMatch(lead, /this ran on the device/i);
  assert.doesNotMatch(lead, /no network was used/i);
  assert.match(lead, /run an assessment/i);
  assert.doesNotMatch(footer, /nothing leaves this computer/i);
  assert.match(footer, /egress guard is armed/i);
});

test("connectivity badge distinguishes browser reachability from app egress proof", () => {
  const html = readFileSync(new URL("../public/app.html", import.meta.url), "utf8");
  const netScript = readFileSync(new URL("../public/assets/js/net.js", import.meta.url), "utf8");
  const triageScript = readFileSync(new URL("../public/assets/js/triage.js", import.meta.url), "utf8");
  const page = new JSDOM(html).window.document;

  assert.equal(page.querySelector("#net .badge-txt")?.textContent, "Network status");
  assert.match(netScript, /Browser offline/);
  assert.match(netScript, /Browser online/);
  assert.match(triageScript, /eg\.armed/);
  assert.match(triageScript, /textContent = "On-device"/);
});

test("configured model identity does not render as resident-model proof", async () => {
  // The restored one-flow design: the odProof element only reveals itself when the
  // egress guard is armed AND medpsy is known — neither config detail alone is enough
  // to prove the inference ran on-device without network egress.
  const html = readFileSync(new URL("../public/app.html", import.meta.url), "utf8");
  const triageScript = readFileSync(new URL("../public/assets/js/triage.js", import.meta.url), "utf8");
  const browser = new JSDOM(html, { url: "http://127.0.0.1/app", runScripts: "outside-only" }).window;
  (browser as unknown as { fetch: () => Promise<unknown> }).fetch = async () => ({
    json: async () => ({
      chunks: 0,
      ragLive: null,
      medpsy: "medpsy-1.7b-q4",
      residentModels: [],
      egress: { armed: false, strict: false, violations: 0 },
    }),
  });

  browser.eval(triageScript);
  await new Promise((resolve) => setTimeout(resolve, 0));

  // When egress guard is NOT armed, no on-device proof chips are shown regardless of
  // whether a medpsy model name is present in the /health response.
  const proof = browser.document.querySelector("#odProof") as HTMLElement;
  assert.equal(proof.hidden, true, "odProof must be hidden when egress guard is not armed");
  assert.doesNotMatch(proof.textContent ?? "", /MedPsy|runs on this Mac/i);
});

test("runtime banner appears when WHO guideline store is empty or ragLive is false", async (t) => {
  // The restored one-flow design shows a setup banner when chunks === 0 or ragLive === false.
  // Every case will abstain until the WHO corpus is ingested.
  const html = readFileSync(new URL("../public/app.html", import.meta.url), "utf8");
  const triageScript = readFileSync(new URL("../public/assets/js/triage.js", import.meta.url), "utf8");
  const browser = new JSDOM(html, { url: "http://127.0.0.1/app", runScripts: "outside-only" }).window;
  t.after(() => browser.close());
  (browser as unknown as { fetch: () => Promise<unknown> }).fetch = async () => ({
    json: async () => ({ ready: false, chunks: 0, ragLive: false, residentModels: [], egress: {} }),
  });

  browser.eval(triageScript);
  await new Promise((resolve) => setTimeout(resolve, 0));

  const banner = browser.document.querySelector("#setupBanner")?.textContent?.replace(/\s+/g, " ").trim() ?? "";
  // The banner must be non-empty and reference the ingestion step.
  assert.ok(banner.length > 0, "setup banner must be non-empty when store is empty");
  assert.match(banner, /npm run ingest/i, "banner must reference the ingest command");
  // The banner must not be hidden.
  const bannerEl = browser.document.querySelector("#setupBanner") as HTMLElement;
  assert.equal(bannerEl?.classList.contains("hidden"), false, "setup banner must be visible when store is empty");
});

test("landing page stays inside the claim-limited English text and evidence boundary", () => {
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  const text = new JSDOM(html).window.document.body.textContent?.replace(/\s+/g, " ").trim() ?? "";

  assert.doesNotMatch(text, /speak|voice|read aloud|listen and act/i);
  assert.doesNotMatch(text, /nothing leaves|no network,? ever|works in airplane mode|with the network off/i);
  assert.doesNotMatch(text, /1\.6|38\.4|\bGPU\b|\b994\b|62\.62|51\.20/i);
  assert.doesNotMatch(text, /\b(?:we|triage-0) (?:diagnos(?:es|is)|prescribes?)\b|\bprescription\b|model-authored (?:plan|action)|treat now/i);
  if (/reference actions?|management plan/i.test(text)) {
    assert.match(text, /after (?:human )?confirm|confirmed/i);
  }
  assert.match(text, /English text workflow/i);
  assert.match(text, /evidence appears only after a verified local run/i);
  assert.match(text, /not diagnosis or treatment/i);
});

test("assessment never claims diagnosis or model-authored treatment and renders card and plan in one stream", () => {
  // The restored one-flow design: card+plan arrive in a single POST /triage stream.
  // No provisional gate, no confirmation step — the frontend renders severity and action
  // directly from the card event.
  const html = readFileSync(new URL("../public/app.html", import.meta.url), "utf8");
  const script = readFileSync(new URL("../public/assets/js/triage.js", import.meta.url), "utf8");
  const text = new JSDOM(html).window.document.body.textContent?.replace(/\s+/g, " ").trim() ?? "";

  // Safety: no diagnosis or prescription claim.
  assert.doesNotMatch(
    text,
    /\b(?:we|triage-0) (?:diagnos(?:es|is)|prescribes?)\b|\bprescription\b|model-authored (?:plan|action)|guidelines? (?:stored|found|loaded) on this device|clinically (?:validated|reviewed)/i,
  );
  // The script does not expose internal model reasoning as a visible event.
  assert.doesNotMatch(script, /(?:ev\s*===|case)\s*["']reasoning["']/i);
  // One-flow: card and plan handlers are both present without a provisional gate.
  assert.match(script, /ev === "card"/);
  assert.match(script, /ev === "plan"/);
  assert.doesNotMatch(script, /ev === "provisional"/);
  // No confirmation token or continuation token wiring in the restored frontend.
  assert.doesNotMatch(script, /confirmationToken/);
  assert.doesNotMatch(script, /continuationToken/);
  assert.doesNotMatch(script, /\/triage\/confirm/);
  assert.doesNotMatch(script, /\/triage\/continue/);
});

test("active unified UI uses one Get guidance action without legacy assessment-mode copy", () => {
  // The restored one-flow design: a single [data-unified-submit] button labeled "Get guidance".
  // No "Run assessment" mode-switch, no tab list, no separate ordinary-prompt mode.
  const html = readFileSync(new URL("../public/app.html", import.meta.url), "utf8");
  const script = readFileSync(new URL("../public/assets/js/triage.js", import.meta.url), "utf8");
  const page = new JSDOM(html).window.document;
  const actions = page.querySelectorAll("[data-unified-submit]");

  // Exactly one unified submit action.
  assert.equal(actions.length, 1);
  assert.equal(actions[0]?.textContent?.trim(), "Get guidance");
  // No legacy "Run assessment" button.
  assert.equal(
    [...page.querySelectorAll("button")].some((button) => button.textContent?.trim() === "Run assessment"),
    false,
  );
  // No tab list or mode-switch in the restored design.
  assert.equal(page.querySelectorAll('[role="tablist"], .mode-tab').length, 0);
  // No provisional event handler, no confirmation/continuation wiring.
  assert.doesNotMatch(script, /ev === "provisional"/);
  assert.doesNotMatch(script, /confirmationToken/);
  assert.doesNotMatch(script, /\/triage\/confirm/);
  // One-flow card and plan handlers are present.
  assert.match(script, /ev === "card"/);
  assert.match(script, /ev === "plan"/);
  // Empty-field guard is present (user feedback).
  assert.match(script, /Describe or record a case first\./);
});
