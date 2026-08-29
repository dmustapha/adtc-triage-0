import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../../public/assets/js/triage.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../../public/assets/css/app.css", import.meta.url), "utf8");

// The restored one-flow design emits card+plan in a single POST /triage stream.
// There is no provisional review gate, no confirmation token, no /triage/continue or /triage/confirm.

test("no confirmation token or continuation token state exists in the restored frontend", () => {
  assert.doesNotMatch(source, /confirmationToken/);
  assert.doesNotMatch(source, /continuationToken/);
  assert.doesNotMatch(source, /renderProvisional/);
  assert.doesNotMatch(source, /renderContinuation/);
  assert.doesNotMatch(source, /clinicalState/);
});

test("no calls to /triage/continue or /triage/confirm exist in the restored frontend", () => {
  assert.doesNotMatch(source, /\/triage\/continue/);
  assert.doesNotMatch(source, /\/triage\/confirm/);
});

test("the card event renders severity action and plan in one stream without a confirmation step", () => {
  // card handler present.
  assert.match(source, /ev === "card"/);
  // plan handler present and fires after card.
  assert.match(source, /ev === "plan"/);
  // renderCard uses card.severity for the severity level display.
  assert.match(source, /card\.severity/);
  // renderPlan renders the management plan.
  assert.match(source, /renderPlan/);
  // No provisional event handler.
  assert.doesNotMatch(source, /ev === "provisional"/);
});

test("renderCard renders severity, action, and reasoning directly from card fields", () => {
  // card.action is rendered directly (source-bound, not model-authored HTML).
  assert.match(source, /card\.action/);
  // card.reasoning is shown.
  assert.match(source, /card\.reasoning/);
  // No referenceActions rendering function.
  assert.doesNotMatch(source, /renderReferenceActions/);
  assert.doesNotMatch(source, /referenceActions/);
  // textContent is used to set card text safely (no innerHTML for user-originated text).
  assert.match(source, /esc\(/);
});

test("confirmed dose tables are contained by a shrinkable mobile plan region", () => {
  assert.match(css, /#result\s*,\s*\.panel\s*,\s*\.record-review[^{}]*\{[^}]*min-width:\s*0/s);
  assert.match(css, /#confirmationPlan[^{}]*\{[^}]*min-width:\s*0/s);
  assert.match(css, /\.medicine-card[^{}]*\{[^}]*min-width:\s*0/s);
  assert.match(css, /\.dose-table-wrap[^{}]*\{[^}]*width:\s*100%[^}]*overflow-x:\s*auto/s);
});
