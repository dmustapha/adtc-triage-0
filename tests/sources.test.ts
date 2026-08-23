import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access } from "node:fs/promises";

function run(script: string, args: string[] = []) {
  return spawnSync(process.execPath, ["--import", "tsx", script, ...args], { cwd: process.cwd(), encoding: "utf8" });
}

test("verification fails closed on the first unreviewed source without writing passing evidence", async () => {
  const result = run("scripts/verify-sources.ts");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /source review incomplete: WHO-IMCI-RESP-2022/);
  await assert.rejects(access("evidence/source-verification.json"));
  await assert.rejects(access("evidence/source-verification.sig"));
});

test("attestation requires named reviewers and both explicit review flags", () => {
  const result = run("scripts/attest-source.ts", ["WHO-IMCI-RESP-2022", "rights-reviewer"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /usage: npm run attest-source/);
});
