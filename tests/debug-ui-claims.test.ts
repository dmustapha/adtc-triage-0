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
