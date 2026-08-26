import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
// @ts-expect-error jsdom does not bundle declarations in this workspace.
import { JSDOM } from "jsdom";

const html = readFileSync(new URL("../../public/app.html", import.meta.url), "utf8");
const source = readFileSync(new URL("../../public/assets/js/triage.js", import.meta.url), "utf8");
const page = new JSDOM(html).window.document;
const prompts = [
  "Summarize, in plain English, the recorded facts in this supervised pediatric respiratory case: a two-year-old has cough for three days; all seven structured danger and breathing observations were recorded absent. Separate observed facts from uncertainty. Do not diagnose, prescribe, or invent missing findings.",
  "Explain, in plain English for a supervised community health worker, why an incomplete pediatric respiratory danger-sign checklist must be completed before model-assisted assessment review. State that recorded danger observations and deterministic policy, not model output, control escalation. Do not diagnose or prescribe.",
];

test("submitted prompt examples preserve the exact bytes", () => {
  assert.equal(page.getElementById("promptExample1")?.getAttribute("data-prompt"), prompts[0]);
  assert.equal(page.getElementById("promptExample2")?.getAttribute("data-prompt"), prompts[1]);
});

test("ordinary prompts use the assist endpoint with independent terminal state", () => {
  assert.match(source, /var promptState\s*=\s*\{[\s\S]*jobId:\s*null[\s\S]*terminal:\s*false/);
  assert.match(source, /fetch\("\/assist"/);
  assert.match(source, /body:\s*JSON\.stringify\(\{\s*prompt:\s*prompt\s*\}\)/);
  assert.doesNotMatch(source, /fetch\("\/triage"[\s\S]{0,400}ordinaryPrompt/);
});

test("cancel and retry use job ownership, abort, and fresh state", () => {
  assert.match(source, /fetch\("\/jobs\/"\s*\+\s*encodeURIComponent\(promptState\.jobId\)[\s\S]*method:\s*"DELETE"/);
  assert.match(source, /promptState\.abortController\.abort\(\)/);
  assert.match(source, /function retryPrompt[\s\S]*promptState\.jobId\s*=\s*null[\s\S]*runPrompt\(\)/);
  assert.match(source, /response\.status\s*===\s*409[\s\S]*already finished[\s\S]*return/);
  assert.match(source, /if\s*\(!response\.ok\)[\s\S]*Cancellation could not be confirmed[\s\S]*return/);
  assert.match(source, /promptState\.cancelMessage/);
});

test("prompt result rendering accepts only terminal answer or rejection and uses textContent", () => {
  assert.match(source, /function handlePromptEvent/);
  assert.match(source, /event === "answer"[\s\S]*promptState\.terminal\s*=\s*true/);
  assert.match(source, /event === "rejected"[\s\S]*promptState\.terminal\s*=\s*true/);
  assert.match(source, /promptResult[\s\S]*textContent/);
  assert.doesNotMatch(source, /promptResult[^\n]*innerHTML\s*=/);
  assert.doesNotMatch(source, /event === "reasoning"/);
});

test("prompt failures preserve public recovery codes and disable unsafe retries", () => {
  assert.match(source, /failure\s*=\s*await response\.json\(\)/);
  assert.match(source, /failure\.error\s*\+\s*\(failure\.code/);
  assert.match(source, /promptState\.retryable\s*=\s*data\.retryable\s*!==\s*false/);
  assert.match(source, /retryPrompt"\)\.hidden\s*=\s*!promptState\.retryable/);
  assert.match(source, /data\.status\s*===\s*"UNAVAILABLE"/);
  assert.match(source, /data\.status\s*===\s*"CANCELLED"/);
  assert.match(source, /code:\s*"MALFORMED_RESPONSE"/);
  assert.match(source, /retryable:\s*false/);
});
