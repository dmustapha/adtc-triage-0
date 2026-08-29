import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// The restored one-flow design removed the `runUnified` / `handleUnifiedInput` dispatch
// layer, the shared-prompt revision model, and the assist-before-triage routing. The
// triage.js front end now has a single `runAssess` function that POSTs to /triage and
// streams card+plan in one response. Tests for the old dispatch layer are removed here;
// the restored behavior is covered by:
//   - tests/unit/frontend-unified-readiness.test.ts  (runAssess, handleEvent)
//   - tests/unit/frontend-confirmation.test.ts       (no confirmation tokens/routes)
//   - tests/unit/frontend-modes.test.ts              (single-workflow HTML + script)
//   - tests/unit/frontend.test.ts                    (renderCard, reason timer, Stop)

const root = new URL("../../", import.meta.url);
const metadata = JSON.parse(readFileSync(new URL("metadata.json", root), "utf8"));
const source = readFileSync(new URL("public/assets/js/triage.js", root), "utf8");

test("submitted prompts are not present in triage.js source (no prompt-specific bytes)", () => {
  const prompts: string[] = metadata.test_prompts.map((entry: { prompt: string }) => entry.prompt);
  assert.equal(prompts.length, 2);
  for (const prompt of prompts) {
    assert.equal(source.includes(prompt), false, `prompt bytes must not appear in triage.js: ${prompt.slice(0, 40)}…`);
  }
});

test("no runUnified, handleUnifiedInput, or shared-prompt revision state in triage.js", () => {
  // The restored design uses runAssess (single-prompt one-flow), not a unified dispatch.
  assert.doesNotMatch(source, /runUnified\b/);
  assert.doesNotMatch(source, /handleUnifiedInput\b/);
  assert.doesNotMatch(source, /promptState\b/);
  assert.doesNotMatch(source, /\/jobs\/.*DELETE/s);
  assert.doesNotMatch(source, /retryPrompt\b/);
  assert.doesNotMatch(source, /sharedAnswer\b/);
});

test("triage.js exports only the restored one-flow API surface", () => {
  // module.exports hook: verified exports.
  assert.match(source, /runAssess\b/);
  assert.match(source, /handleEvent\b/);
  assert.match(source, /renderCard\b/);
  assert.match(source, /renderPlan\b/);
  assert.match(source, /renderCitation\b/);
  assert.match(source, /renderStage\b/);
  assert.match(source, /startReasonTimer\b/);
  assert.match(source, /stopReasonTimer\b/);
  // Old APIs must not be present.
  assert.doesNotMatch(source, /renderProvisional\b/);
  assert.doesNotMatch(source, /sendConfirmation\b/);
  assert.doesNotMatch(source, /renderContinuation\b/);
  assert.doesNotMatch(source, /sendContinuation\b/);
  assert.doesNotMatch(source, /updateDangerChecklist\b/);
  assert.doesNotMatch(source, /invalidateClinicalResult\b/);
  assert.doesNotMatch(source, /readStructuredDanger\b/);
});
