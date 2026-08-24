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

test("landing page stays inside the claim-limited English text and evidence boundary", () => {
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  const text = new JSDOM(html).window.document.body.textContent?.replace(/\s+/g, " ").trim() ?? "";

  assert.doesNotMatch(text, /speak|voice|read aloud|listen and act/i);
  assert.doesNotMatch(text, /nothing leaves|no network,? ever|works in airplane mode|with the network off/i);
  assert.doesNotMatch(text, /1\.6|38\.4|\bGPU\b|\b994\b|62\.62|51\.20/i);
  assert.doesNotMatch(text, /amoxicillin|first dose|treat now|management plan/i);
  assert.match(text, /English text workflow/i);
  assert.match(text, /evidence appears only after a verified local run/i);
  assert.match(text, /not diagnosis or treatment/i);
});
