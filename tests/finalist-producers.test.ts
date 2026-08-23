import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
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

test("OLMo-2 7B recovery freezes the exact approved identity without rewriting historical candidates", async () => {
  const finalists = JSON.parse(await readFile("config/model-finalists.json", "utf8"));
  const shortlist = JSON.parse(await readFile("evidence/finalists/replacement-shortlist.json", "utf8"));
  const candidate = JSON.parse(await readFile("evidence/finalists/replacement/olmo-2-1124-7b-instruct-q4-k-m-candidate.json", "utf8"));
  const historicalFinalists = { ...finalists };
  delete historicalFinalists[candidate.candidateId];
  const historicalShortlist = shortlist.candidates.filter((item: any) => item.candidateId !== candidate.candidateId);
  assert.equal(createHash("sha256").update(JSON.stringify(historicalFinalists)).digest("hex"), "56c524838ca237ef86fcdff97bbbc1162b40bf5a6241b22aec14a8a9304212f6");
  assert.equal(createHash("sha256").update(JSON.stringify(historicalShortlist)).digest("hex"), "be2ee3eb1654fb2e6c928d0c0e38cd9ea0ffa063ddc63b79d491ba21215acd1a");
  assert.deepEqual(finalists[candidate.candidateId], candidate.model);
  assert.deepEqual(candidate, {
    schemaVersion: 1,
    candidateId: "olmo-2-1124-7b-instruct-q4-k-m",
    repository: "allenai/OLMo-2-1124-7B-Instruct-GGUF",
    model: {
      candidateId: "olmo-2-1124-7b-instruct-q4-k-m", name: "OLMo-2-1124-7B-Instruct-Q4_K_M",
      revision: "410e0069f64869e4b1d17d8de04810b881fd824b",
      url: "https://huggingface.co/allenai/OLMo-2-1124-7B-Instruct-GGUF/resolve/410e0069f64869e4b1d17d8de04810b881fd824b/olmo-2-1124-7B-instruct-Q4_K_M.gguf?download=true",
      filename: "olmo-2-1124-7B-instruct-Q4_K_M.gguf", outputPath: "model/triage-01.gguf", bytes: 4472020256,
      sha256: "e08112e5f84aab7c05fa6e713c58e5214cd5d8e32ed773ff3354b006eed41b95", quantization: "GGUF Q4_K_M",
      parametersEstimate: "7B", license: "Apache-2.0", runtimeArchitecture: "olmo2"
    },
    disposition: "freeze-for-raw-gate",
    reason: "Official Ai2 GGUF with a public Base-to-SFT-to-DPO-to-RLVR chain, anonymous immutable download, Apache-2.0 weights, pinned olmo2 runtime support, and materially more behavioral capacity than the rejected 1B candidate."
  });
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

test("OLMo-2 7B lineage pins the complete public training chain and upstream restrictions", async () => {
  const sources = JSON.parse(await readFile("config/replacement-lineage-sources.json", "utf8"));
  const lineage = sources["olmo-2-1124-7b-instruct-q4-k-m"];
  assert.equal(lineage.modelLicense, "Apache-2.0");
  assert.match(lineage.rightsConclusion, /non-commercial subsets/);
  assert.deepEqual(lineage.sources.map((source: any) => source.id), [
    "gguf", "instruct", "rlvr-data", "dpo", "preference-mix", "sft", "tulu-sft", "base", "olmo-mix", "dolmino-mix", "apache-license"
  ]);
  for (const source of lineage.sources) {
    assert.match(source.url, /\/[a-f0-9]{40}\//, `${source.id} must use an immutable revision`);
    assert.match(source.sha256, /^[a-f0-9]{64}$/);
  }
  const dir = await mkdtemp(join(tmpdir(), "olmo-7b-lineage-"));
  const output = join(dir, "result.json");
  const snapshot = join(dir, "sources", "instruct-model-card.md");
  const primary = lineage.sources.find((source: any) => source.id === "instruct");
  const result = run("scripts/run-lineage-gate.ts", ["olmo-2-1124-7b-instruct-q4-k-m", primary.url, primary.sha256, snapshot, output]);
  assert.equal(result.status, 0, result.stderr);
  const evidence = JSON.parse(await readFile(output, "utf8"));
  assert.equal(evidence.status, "pass");
  assert.equal(evidence.result.reviewed, true);
  assert.equal(evidence.result.sourcesVerified, 11);
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

test("OLMo-2 7B producer pins the approved evidence-only workflow and frozen semantics", async () => {
  const workflow = await readFile(".github/workflows/olmo2-7b-recovery-evidence.yml", "utf8");
  const rawProducer = await readFile("scripts/run-raw-finalist.ts", "utf8");
  assert.match(workflow, /CANDIDATE_ID: olmo-2-1124-7b-instruct-q4-k-m/);
  assert.match(workflow, /410e0069f64869e4b1d17d8de04810b881fd824b/);
  assert.match(workflow, /MODEL_BYTES: "4472020256"/);
  assert.match(workflow, /e08112e5f84aab7c05fa6e713c58e5214cd5d8e32ed773ff3354b006eed41b95/);
  assert.match(workflow, /LLAMA_REVISION: c8ade30036139e32108fee53d8b7164dbfda4bee/);
  assert.match(workflow, /--continue-at -/);
  assert.match(workflow, /sha256sum --check --strict/);
  assert.ok(workflow.indexOf("sha256sum --check --strict") < workflow.indexOf('mv "model/$CANDIDATE_ID.gguf.partial"'));
  assert.ok(workflow.indexOf("Remove model bytes before evidence upload") < workflow.indexOf("Upload raw Phase 1 evidence only"));
  assert.match(workflow, /!evidence\/finalists\/replacement\/\*\*\/\*.gguf/);
  for (const value of ['"-t", "4"', '"-ngl", "0"', '"-c", "2048"', '"-n", "128"', '"--temp", "0"', '"--jinja"', '"--single-turn"', "timeout: 120_000", 'killSignal: "SIGKILL"']) {
    assert.ok(rawProducer.includes(value), `raw producer must freeze ${value}`);
  }
  const output = join(await mkdtemp(join(tmpdir(), "olmo-7b-producer-")), "manifest.json");
  const result = spawnSync(process.execPath, ["--import", tsxImport, resolve(root, "scripts/produce-replacement-ci-evidence.ts"), "--plan-only", output], {
    cwd: root, encoding: "utf8", env: { ...process.env, CANDIDATE_ID: "olmo-2-1124-7b-instruct-q4-k-m" }
  });
  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(await readFile(output, "utf8"));
  const corrected = JSON.parse(await readFile("evidence/finalists/replacement/corrected-producer-manifest.json", "utf8"));
  assert.equal(manifest.candidateId, "olmo-2-1124-7b-instruct-q4-k-m");
  assert.deepEqual(manifest.llamaArgs, ["-t", "4", "-ngl", "0", "-c", "2048", "-n", "128", "--temp", "0", "--jinja", "--single-turn"]);
  assert.deepEqual(manifest.inputHashes.corpus, corrected.inputHashes.corpus);
  assert.deepEqual(manifest.inputHashes.rubric, corrected.inputHashes.rubric);
  assert.deepEqual(manifest.inputHashes.generationPolicy, corrected.inputHashes.generationPolicy);
  assert.deepEqual(manifest.corpus.splits, corrected.corpus.splits);
});

test("OLMo-2 7B raw runner rejects lineage evidence for a different candidate", async () => {
  const dir = await mkdtemp(join(tmpdir(), "olmo-7b-lineage-identity-"));
  const lineage = join(dir, "lineage.json");
  await writeFile(lineage, JSON.stringify({ status: "pass", result: { reviewed: true }, model: { candidateId: "olmo-2-0425-1b-instruct-q4-k-m" } }));
  const result = run("scripts/run-raw-finalist.ts", ["olmo-2-1124-7b-instruct-q4-k-m", lineage, join(dir, "raw.jsonl")]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /training-lineage candidate does not match raw finalist/);
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
