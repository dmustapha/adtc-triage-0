import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const tsxImport = resolve(root, "node_modules/tsx/dist/loader.mjs");
function run(script: string, args: string[] = []) {
  return spawnSync(process.execPath, ["--import", tsxImport, resolve(root, script), ...args], { cwd: root, encoding: "utf8" });
}

test("producer manifest freezes corpus, rubric, splits, raw paths, commands, host label, and hashes", async () => {
  const output = join(await mkdtemp(join(tmpdir(), "finalist-manifest-")), "producer-manifest.json");
  const result = run("scripts/freeze-finalist-inputs.ts", [output]);
  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(await readFile(output, "utf8"));
  assert.equal(manifest.corpus.splits.pediatricHoldout, 50);
  assert.equal(manifest.corpus.splits.generalMedicalHoldout, 50);
  assert.equal(manifest.rubric.generatedTokenLimit, 128);
  assert.match(manifest.inputHashes.rawProducer, /^[a-f0-9]{64}$/);
  assert.match(manifest.host.label, /darwin|linux|win32/);
  for (const candidate of Object.values(manifest.candidates) as any[]) {
    assert.match(candidate.rawResponsePath, /^evidence\/finalists\/raw\//);
    assert.deepEqual(candidate.rawProducer.slice(0, 4), ["node", "--import", "tsx", "scripts/run-raw-finalist.ts"]);
    assert.deepEqual(candidate.lineageProducer.slice(0, 4), ["node", "--import", "tsx", "scripts/run-lineage-gate.ts"]);
  }
  for (const value of Object.values(manifest.inputHashes) as string[]) assert.match(value, /^[a-f0-9]{64}$/);
});

test("producer manifest freezes an authorized replacement without rewriting historical finalists", async () => {
  const output = join(await mkdtemp(join(tmpdir(), "replacement-manifest-")), "producer-manifest.json");
  const result = run("scripts/freeze-finalist-inputs.ts", [output, "olmo-2-0425-1b-instruct-q4-k-m"]);
  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(await readFile(output, "utf8"));
  assert.deepEqual(Object.keys(manifest.candidates), ["olmo-2-0425-1b-instruct-q4-k-m"]);
  const replacement = manifest.candidates["olmo-2-0425-1b-instruct-q4-k-m"];
  assert.equal(replacement.modelPath, "model/olmo-2-0425-1b-instruct-q4-k-m.gguf");
  assert.equal(replacement.rawResponsePath, "evidence/finalists/replacement/raw/olmo-2-0425-1b-instruct-q4-k-m-responses.jsonl");
  assert.equal(replacement.lineageSource.sha256, "5f5b891d66a46079920172f8d5957ec386825f76cfc14ae2e79c7208d4dca4d8");
  assert.deepEqual(replacement.rawProducer.slice(0, 4), ["node", "--import", "tsx", "scripts/run-raw-finalist.ts"]);
});

test("replacement lineage producer verifies every immutable primary source", async () => {
  const dir = await mkdtemp(join(tmpdir(), "replacement-lineage-"));
  const output = join(dir, "result.json");
  const snapshot = join(dir, "sources", "instruct-model-card.md");
  const url = "https://huggingface.co/allenai/OLMo-2-0425-1B-Instruct/raw/48d788eca847d4d7548f375ad03d3c9312f6139e/README.md";
  const expected = "5f5b891d66a46079920172f8d5957ec386825f76cfc14ae2e79c7208d4dca4d8";
  const result = run("scripts/run-lineage-gate.ts", ["olmo-2-0425-1b-instruct-q4-k-m", url, expected, snapshot, output]);
  assert.equal(result.status, 0, result.stderr);
  const evidence = JSON.parse(await readFile(output, "utf8"));
  assert.equal(evidence.status, "pass");
  assert.equal(evidence.result.reviewed, true);
  assert.equal(evidence.result.sourcesVerified, 11);
  assert.match(evidence.result.rightsConclusion, /Apache-2.0 model redistribution/);
});

test("lineage producer pins real primary bytes and records an evidence-backed failure", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lineage-evidence-"));
  const output = join(dir, "result.json");
  const snapshot = join(dir, "README.md");
  const url = "https://huggingface.co/qvac/MedPsy-1.7B/raw/59335b96dd541b0061d748d7a6e9536e92274985/README.md";
  const expected = "437a67d37127fe87f310e04bb8a1258c917b92c3682c73c09da3dd4a59fd3c7e";
  const result = run("scripts/run-lineage-gate.ts", ["medpsy-1.7b-q4", url, expected, snapshot, output]);
  assert.equal(result.status, 2, result.stderr);
  const bytes = await readFile(snapshot);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), expected);
  const evidence = JSON.parse(await readFile(output, "utf8"));
  assert.equal(evidence.status, "fail");
  assert.equal(evidence.result.reviewed, false);
  assert.match(evidence.result.reason, /not yet publicly released/);
  assert.match(evidence.result.reason, /open-source medical QA prompts/);
});

test("raw runner refuses inference before a passing lineage prerequisite", async () => {
  const result = run("scripts/run-raw-finalist.ts", ["medpsy-1.7b-q4", "evidence/finalists/missing-lineage.json", "evidence/finalists/raw/1.7b.jsonl"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /training-lineage prerequisite is not a verified pass/);
});

test("status producer records both raw runs as not-run after prerequisite failure", async () => {
  const output = join(await mkdtemp(join(tmpdir(), "finalist-status-")), "status.json");
  const result = run("scripts/summarize-finalist-status.ts", ["evidence/finalists/producer-manifest.json", "evidence/finalists/1.7b-training-lineage.json", "evidence/finalists/4b-training-lineage.json", output]);
  assert.equal(result.status, 0, result.stderr);
  const status = JSON.parse(await readFile(output, "utf8"));
  assert.equal(status.status, "blocked");
  assert.equal(status.selectedCandidateId, null);
  for (const candidate of Object.values(status.candidates) as any[]) assert.equal(candidate.rawInference, "not-run-after-prerequisite-failure");
});
