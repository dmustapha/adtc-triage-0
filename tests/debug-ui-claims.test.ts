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

  const proof = browser.document.querySelector("#odProof") as HTMLElement;
  assert.equal(proof.hidden, true);
  assert.doesNotMatch(proof.textContent ?? "", /MedPsy|runs on this Mac/i);
});

test("runtime banner blocks model-assisted assessment until WHO and MedPsy are ready", async (t) => {
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
  assert.match(banner, /WHO reference store not ready/i);
  assert.match(banner, /npm run ingest/i);
  assert.match(banner, /restart the supported app server/i);
  assert.doesNotMatch(banner, /every case will abstain/i);
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

test("assessment surfaces gate provisional classification and never claim diagnosis or model-authored treatment", () => {
  const html = readFileSync(new URL("../public/app.html", import.meta.url), "utf8");
  const script = readFileSync(new URL("../public/assets/js/triage.js", import.meta.url), "utf8");
  const text = new JSDOM(html).window.document.body.textContent?.replace(/\s+/g, " ").trim() ?? "";
  const surface = `${html}\n${script}`;

  assert.doesNotMatch(
    text,
    /\b(?:we|triage-0) (?:diagnos(?:es|is)|prescribes?)\b|\bprescription\b|model-authored (?:plan|action)|guidelines? (?:stored|found|loaded) on this device|clinically (?:validated|reviewed)/i,
  );
  assert.doesNotMatch(script, /(?:ev\s*===|case)\s*["']reasoning["']/i);
  assert.match(surface, /assessment outcome/i);
  assert.match(surface, /supporting reference/i);
  assert.match(surface, /supervised/i);
  if (/classification/i.test(surface)) {
    assert.match(surface, /provisional/i);
    assert.match(surface, /confirm/i);
  }
});

test("active assessment UI uses assessment language instead of guideline-first guidance copy", () => {
  const html = readFileSync(new URL("../public/app.html", import.meta.url), "utf8");
  const script = readFileSync(new URL("../public/assets/js/triage.js", import.meta.url), "utf8");
  const surface = `${html}\n${script}`;

  assert.match(html, />Run assessment</);
  assert.match(script, /Ready for respiratory assessment/);
  assert.match(script, /WHO reference engine/);
  assert.doesNotMatch(surface, /Get guidance|Ready for guidance|Could not get guidance|guidance did not finish|WHO guideline store/i);
});
