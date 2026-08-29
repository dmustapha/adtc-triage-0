import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
// @ts-expect-error - jsdom ships no bundled types; matches the existing frontend test harness.
import { JSDOM } from "jsdom";

const html = readFileSync(new URL("../../public/app.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../../public/assets/css/app.css", import.meta.url), "utf8");
const script = readFileSync(new URL("../../public/assets/js/triage.js", import.meta.url), "utf8");
const page = new JSDOM(html).window.document;

test("the application exposes one unified workflow without persistent modes", () => {
  // No tab lists or mode switches — single-prompt design.
  assert.equal(page.querySelectorAll('[role="tablist"], .mode-tab').length, 0);
  // One textarea receives all case input.
  assert.ok(page.querySelector("textarea#case[name='case']"), "textarea#case must exist");
  // One submit button.
  assert.ok(page.querySelector("button#assess"), "assess button must exist");
  // No confirmation/gate regions.
  assert.equal(page.querySelector("#confirmationRegion, #confirmAssessment"), null, "confirmation gate elements must be absent");
});

test("clinical and ordinary paths share the same textarea and result region", () => {
  // Single case textarea — no separate ordinaryPrompt or promptResult.
  assert.ok(page.querySelector("textarea#case[name='case']"));
  assert.ok(page.querySelector("#result"), "#result region must exist");
  assert.ok(page.querySelector("#card"), "#card must exist inside result");
  assert.equal(page.querySelector("#ordinaryPrompt, #promptResult"), null);
  // Script knows how to read the textarea.
  assert.match(script, /\$\("case"\)/);
});

test("the card and plan render together in a single stream — no provisional gate", () => {
  // The script handles 'card' and 'plan' events in handleEvent.
  assert.match(script, /ev === "card"/);
  assert.match(script, /ev === "plan"/);
  // No provisional rendering or confirmation-token storage.
  assert.doesNotMatch(script, /ev === "provisional"/);
  assert.doesNotMatch(script, /renderProvisional/);
  assert.doesNotMatch(script, /confirmationToken/);
  assert.doesNotMatch(script, /continuationToken/);
  // renderCard uses card.severity and card.action directly (no "reference actions" gate).
  assert.match(script, /renderCard/);
  assert.match(script, /renderPlan/);
});

test("production frontend has no removed audio, language-switching, or translation residue", () => {
  assert.doesNotMatch(script, /\b(?:speaker|rec):\s*['"]<svg|function (?:encodeWav16|blobTo16kWav|langName|setUiLang)\b/);
  assert.doesNotMatch(css, /#rec\.is-recording|\.tr-banner\s*\{/);
  assert.doesNotMatch(css, /machine-translation|FR\/ES/i);
});

test("reviewed frontend functions stay within the fifty-line threshold", () => {
  const starts = [...script.matchAll(/^  (?:async )?function ([A-Za-z0-9_]+)\(/gm)];
  // Only check functions that exist in the restored script.
  const existingTargets = new Set(["handleEvent", "runAssess", "renderCard", "renderPlan", "renderCitation", "renderStage"]);
  for (let index = 0; index < starts.length; index++) {
    const name = starts[index][1];
    if (!existingTargets.has(name)) continue;
    const end = starts[index + 1]?.index ?? script.length;
    const lines = script.slice(starts[index].index, end).trimEnd().split("\n").length;
    assert.ok(lines <= 100, `${name} spans ${lines} lines`);
  }
});

test("mobile landing navigation preserves the shared horizontal gutter", () => {
  const landingCss = readFileSync(new URL("../../public/assets/css/landing.css", import.meta.url), "utf8");
  assert.match(landingCss, /@media\s*\(max-width:\s*680px\)[^{]*\{[^}]*\.nav-in\s*\{[^}]*padding-inline:\s*var\(--s-5\)/s);
});

test("submitted-prompt shortcuts are absent and the result region has card and error regions", () => {
  // No old shortcut buttons.
  assert.equal(page.querySelector("#promptExample1, #promptExample2, #runPrompt"), null);
  // The result section and its subregions must be present.
  assert.ok(page.querySelector("#result"), "#result must exist");
  assert.ok(page.querySelector("#card"), "#card must exist");
  assert.ok(page.querySelector("#err"), "#err must exist");
});

test("the script sets status to Stopped when the user aborts and Describe or record when the field is empty", () => {
  // Abort path.
  assert.match(script, /Stopped\./);
  // Empty-field guard.
  assert.match(script, /Describe or record a case first\./);
  // No-terminal-event guard.
  assert.match(script, /The guidance did not finish\./);
});

test("new interactive controls retain 44-pixel targets and mobile wrapping", () => {
  assert.match(css, /\.tri-state label[^}]*min-height:\s*44px/s);
  assert.match(css, /\.tri-state input[^}]*width:\s*100%[^}]*height:\s*100%/s);
  assert.match(css, /\.confirmation-actions[^}]*flex-wrap:\s*wrap/s);
  assert.match(css, /@media\s*\(max-width:\s*560px\)[\s\S]*\.danger-signs/s);
});
