import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

type Route = "GENERAL" | "CLINICAL" | "AMBIGUOUS";
type UnifiedInputApi = {
  routeInput(text: string): Route;
};

const root = new URL("../../", import.meta.url);
const moduleUrl = new URL("public/assets/js/unified-input.js", root);
const metadata = JSON.parse(readFileSync(new URL("metadata.json", root), "utf8")) as {
  test_prompts: Array<{ prompt_id: string; prompt: string }>;
};

function loadModule(): { api: UnifiedInputApi; source: string } {
  assert.equal(existsSync(moduleUrl), true, "unified-input.js must exist");
  const source = readFileSync(moduleUrl, "utf8");
  const context = { module: { exports: {} }, exports: {} };
  Function("module", "exports", source)(context.module, context.exports);
  return { api: context.module.exports as UnifiedInputApi, source };
}

test("routes clinical, general, and ambiguous input by general rules", () => {
  const { api } = loadModule();
  assert.equal(api.routeInput("Two year old with cough and breathing 52 per minute."), "CLINICAL");
  assert.equal(api.routeInput("Explain why a checklist must be completed."), "GENERAL");
  assert.equal(api.routeInput("Summarize this two-year-old case."), "GENERAL");
  assert.equal(api.routeInput("Help with breathing."), "AMBIGUOUS");
});

test("routes both Gate 1 prompts without prompt-specific implementation data", () => {
  const { api, source } = loadModule();
  for (const item of metadata.test_prompts) {
    assert.equal(api.routeInput(item.prompt), "GENERAL");
    assert.equal(source.includes(item.prompt), false);
    assert.equal(source.includes(item.prompt_id), false);
  }
  assert.doesNotMatch(source, /sha(?:1|256|512)|prompt[_-]?id|canned/i);
});

test("extractClinicalCandidate is not exported from the restored unified-input module", () => {
  // The restored design does not perform structured-observation drafting in the
  // browser. Extraction was removed in Task 6; only routeInput is exported.
  const { api } = loadModule();
  assert.equal(typeof (api as any).extractClinicalCandidate, "undefined", "extractClinicalCandidate must not be exported");
});
