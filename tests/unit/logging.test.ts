import assert from "node:assert/strict";
import test from "node:test";

import { recordDiagnostic, runtimeDiagnostics, safeErrorName } from "../../src/logging.js";

test("safeErrorName exposes only an allowlisted error class", () => {
  assert.equal(safeErrorName(new TypeError("HF_TOKEN=secret /Users/MAC/model.gguf")), "TypeError");
  const hostile = new Error("safe message");
  hostile.name = "Bearer secret-token";
  assert.equal(safeErrorName(hostile), "Error");
  assert.equal(safeErrorName("postgres://user:password@example.test/db"), "UnknownError");
});

test("runtime diagnostics retain only bounded codes, names, and counts", () => {
  const before = runtimeDiagnostics().TEST_FAILURE?.count ?? 0;
  recordDiagnostic("TEST_FAILURE", new Error("Authorization: Bearer secret"));
  const diagnostic = runtimeDiagnostics().TEST_FAILURE;
  assert.equal(diagnostic.count, before + 1);
  assert.equal(diagnostic.error, "Error");
  assert.doesNotMatch(JSON.stringify(diagnostic), /Bearer|secret|Authorization/i);
});
