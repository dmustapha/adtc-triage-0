import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const tsx = resolve(root, "node_modules/tsx/dist/loader.mjs");
const run = (script: string, args: string[] = []) =>
  spawnSync(process.execPath, ["--import", tsx, resolve(root, script), ...args], { cwd: root, encoding: "utf8" });

test("MedPsy evidence workflow freezes identity and uploads evidence only", async () => {
  const workflow = await readFile(".github/workflows/medpsy-shared-runtime-evidence.yml", "utf8");
  assert.match(workflow, /CANDIDATE_ID: medpsy-1\.7b-q4/);
  assert.match(workflow, /MODEL_SHA256: 41ee947d9cce72ec657577219fd1798fabeabf0d832217fe23c9d6d3d18d5880/);
  assert.match(workflow, /LLAMA_REVISION: c8ade30036139e32108fee53d8b7164dbfda4bee/);
  assert.match(workflow, /runs-on: ubuntu-24\.04/);
  assert.match(workflow, /evidence[_-]tier.*remote-ci-direct-llama\.cpp/i);
  assert.match(workflow, /--jinja/);
  assert.match(workflow, /--single-turn/);
  assert.match(workflow, /Remove model bytes and partials before upload/);
  assert.match(workflow, /rm -f .*\.gguf.*\.partial/);
  assert.ok(workflow.indexOf("Remove model bytes and partials before upload") < workflow.indexOf("Upload MedPsy evidence only"));
  assert.match(workflow, /!evidence\/medpsy-shared-runtime-v1\/\*\*\/\*\.gguf/);
  assert.match(workflow, /!evidence\/medpsy-shared-runtime-v1\/\*\*\/\*\.partial/);
});

test("fatal gates retain holdout and safety requirements without an unpublished lineage kill gate", async () => {
  const gates = JSON.parse(await readFile("config/medpsy-shared-runtime/fatal-gates.json", "utf8"));
  assert.equal(gates.candidateId, "medpsy-1.7b-q4");
  assert.equal(gates.applicableFatalGates.untouchedHoldouts.corpusSha256, "6fd2a1351bf2bcb9ef7927aacf55ecf0aff65f7505d82243a00ece83df4a5f50");
  assert.equal(gates.applicableFatalGates.visibleReasoningAbsence.maximumViolations, 0);
  assert.equal(gates.applicableFatalGates.completeValid.requiredRate, 1);
  assert.equal("trainingLineage" in gates.applicableFatalGates, false);
  assert.equal(gates.disclosedNonFatalRisks.includes("incomplete-itemized-training-lineage"), true);
});

test("manifest producer freezes separated calibration/holdouts and every producer input", async () => {
  const output = join(await mkdtemp(join(tmpdir(), "medpsy-manifest-")), "manifest.json");
  const result = run("scripts/medpsy-shared-runtime/freeze-manifest.ts", [output]);
  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(await readFile(output, "utf8"));
  assert.equal(manifest.candidate.candidateId, "medpsy-1.7b-q4");
  assert.equal(manifest.candidate.sha256, "41ee947d9cce72ec657577219fd1798fabeabf0d832217fe23c9d6d3d18d5880");
  assert.equal(manifest.llamaRevision, "c8ade30036139e32108fee53d8b7164dbfda4bee");
  assert.deepEqual(manifest.chatTemplate, { source: "embedded-gguf", jinja: true, override: null });
  assert.equal(manifest.calibration.cases, 12);
  assert.equal(manifest.evaluation.pediatricCases, 50);
  assert.equal(manifest.evaluation.generalMedicalCases, 50);
  assert.equal(manifest.calibrationEvaluationOverlap, 0);
  assert.equal(manifest.evidenceTier, "remote-ci-direct-llama.cpp");
  assert.equal(manifest.host, "github-actions-ubuntu-24.04");
  assert.ok(Object.values(manifest.inputHashes).every((hash) => /^[a-f0-9]{64}$/.test(String(hash))));
  assert.ok("licenseDecision" in manifest.inputHashes);
});

test("raw runner rejects unauthorized identity before model access", () => {
  const result = run("scripts/medpsy-shared-runtime/run-raw.ts", ["olmo-2", "config/finalist-corpus.json", "/tmp/forbidden-medpsy.jsonl"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /canonical MedPsy candidate is required/);
});

test("evaluator fails closed on absent raw evidence", () => {
  const result = run("scripts/medpsy-shared-runtime/evaluate.ts", ["/tmp/no-medpsy-raw-evidence.jsonl", "/tmp/no-medpsy-evaluation.json"]);
  assert.notEqual(result.status, 0);
});

test("review rubric requires named human review and keeps evidence tiers distinct", async () => {
  const rubric = JSON.parse(await readFile("config/medpsy-shared-runtime/review-rubric.json", "utf8"));
  assert.equal(rubric.namedHumanReviewerRequired, true);
  assert.equal(rubric.builderOrAgentSelfReviewAllowed, false);
  assert.deepEqual(rubric.evidenceTiers, ["historical-product", "remote-ci-direct-llama.cpp", "complete-product", "human-clinical", "physical-target-laptop"]);
});
