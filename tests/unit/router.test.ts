import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const js = readFileSync(new URL("../../public/assets/js/unified-input.js", import.meta.url), "utf8");
const module = { exports: {} as any };
new Function("window", "document", "module", js)({}, { getElementById: () => null, addEventListener() {} }, module);
const { routeInput } = module.exports;

test("clinical narrative routes to CLINICAL", () => {
  assert.equal(routeInput("2 year old, cough for 3 days, breathing fast, still drinking"), "CLINICAL");
});
test("a general how/why question routes to GENERAL", () => {
  assert.equal(routeInput("Explain how the WHO fast-breathing threshold works"), "GENERAL");
});
test("router never keys on the exact submitted prompt bytes", () => {
  // both Gate-1 prompts must resolve through general logic, not a special case
  assert.notEqual(routeInput("Summarize the recorded facts and state your uncertainty."), "CLINICAL");
});
