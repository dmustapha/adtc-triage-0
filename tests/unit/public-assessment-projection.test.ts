import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

test("public assistance exposes provenance but never projects raw retrieved text", () => {
  const source = [
    "../../src/triage/supervised-workflow.ts",
    "../../src/http/create-app.ts",
  ].map((path) => readFileSync(new URL(path, import.meta.url), "utf8")).join("\n");

  assert.match(source, /retrievalMode/);
  assert.doesNotMatch(source, /supportingExcerpt|boundedReferenceExcerpt|hit\.text/);
});

test("provisional projection is explicitly supervised and contains no reference actions", () => {
  const source = readFileSync(new URL("../../src/triage/supervised-workflow.ts", import.meta.url), "utf8");
  assert.match(source, /reviewState:\s*["']PROVISIONAL["']/);
  assert.match(source, /provisional WHO protocol classification, not a diagnosis/i);
  assert.match(source, /confirmation:\s*\{\s*eligible:\s*true,\s*token:/s);
  assert.doesNotMatch(source, /referenceActions:\s*(?!undefined|null)/);
  assert.doesNotMatch(source, /reasoning:\s*result\.card|action:\s*result\.card|plan:\s*result\.card/);
});

test("deterministic respiratory projection remains public result authority", () => {
  const source = readFileSync(new URL("../../src/triage/supervised-workflow.ts", import.meta.url), "utf8");
  assert.match(source, /reviewState:\s*["']DETERMINISTIC["'][\s\S]*\.\.\.result/);
  assert.match(source, /evaluateRespiratoryAssessment/);
});
