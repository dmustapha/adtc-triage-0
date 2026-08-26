import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const tsx = resolve(root, "node_modules/tsx/dist/loader.mjs");
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const run = (script: string, args: string[]) =>
  spawnSync(process.execPath, ["--import", tsx, resolve(root, script), ...args], { cwd: root, encoding: "utf8" });

const EXPECTED_TEST_PROMPTS = [
  {
    prompt_id: "tp_001",
    prompt:
      "Summarize, in plain English, the recorded facts in this supervised pediatric respiratory case: a two-year-old has cough for three days; all seven structured danger and breathing observations were recorded absent. Separate observed facts from uncertainty. Do not diagnose, prescribe, or invent missing findings.",
  },
  {
    prompt_id: "tp_002",
    prompt:
      "Explain, in plain English for a supervised community health worker, why an incomplete pediatric respiratory danger-sign checklist must be completed before model-assisted assessment review. State that recorded danger observations and deterministic policy, not model output, control escalation. Do not diagnose or prescribe.",
  },
] as const;

const EXPECTED_PAIRING_DESCRIPTION =
  "Community health education is load-bearing: the English-only offline prototype helps supervised workers record a structured pediatric respiratory assessment, while deterministic policy, not model output, owns escalation.";

function rawFixture(overrides: Record<string, unknown> = {}) {
  const rawStdout = '  {"classification":"routine"}  [end of text]\n';
  const normalizedPayload = '{"classification":"routine"}';
  return {
    schemaVersion: 2,
    namespace: "medpsy-raw-profiler-v2",
    evidenceTier: "remote-ci-official-llama.cpp-raw-profiler",
    manifestSha256: "d".repeat(64),
    candidate: {
      candidateId: "medpsy-1.7b-q4",
      repository: "qvac/MedPsy-1.7B-GGUF",
      revision: "fd4cecc90c2de8dce4b112795456a54be9c59363",
      filename: "medpsy-1.7b-q4_k_m-imat.gguf",
      bytes: 1282439360,
      sha256: "41ee947d9cce72ec657577219fd1798fabeabf0d832217fe23c9d6d3d18d5880",
    },
    runtime: { name: "llama.cpp", revision: "c8ade30036139e32108fee53d8b7164dbfda4bee" },
    rows: [{ caseId: "RAW-001", rawStdout, normalizedPayload, rawSha256: sha256(rawStdout), normalizedSha256: sha256(normalizedPayload) }],
    artifacts: ["producer-manifest.json", "raw/responses.jsonl", "raw-evaluation.json", "submission.json"],
    ...overrides,
  };
}

async function evaluate(input: unknown) {
  const directory = await mkdtemp(join(tmpdir(), "medpsy-raw-v2-"));
  const inputPath = join(directory, "input.json");
  const outputPath = join(directory, "output.json");
  await writeFile(inputPath, JSON.stringify(input));
  return { result: run("scripts/medpsy-raw-profiler-v2/evaluate.ts", [inputPath, outputPath]), outputPath };
}

test("raw contract has a distinct namespace, tier, runtime, and exact model identity", async () => {
  const contract = JSON.parse(await readFile("config/medpsy-raw-profiler-v2/contract.json", "utf8"));
  assert.equal(contract.namespace, "medpsy-raw-profiler-v2");
  assert.equal(contract.evidenceTier, "remote-ci-official-llama.cpp-raw-profiler");
  assert.equal(contract.runtime.name, "llama.cpp");
  assert.equal(contract.runtime.revision, "c8ade30036139e32108fee53d8b7164dbfda4bee");
  assert.equal(contract.candidate.sha256, "41ee947d9cce72ec657577219fd1798fabeabf0d832217fe23c9d6d3d18d5880");
  assert.deepEqual(contract.thresholds, { dualHashRequiredRate: 1, exactOneJsonRequiredRate: 1, maximumWeightArtifacts: 0 });
});

test("metadata freezes two bounded healthcare prompts for the raw profiler", async () => {
  const metadata = JSON.parse(await readFile("metadata.json", "utf8"));
  const policy = JSON.parse(await readFile("config/profiler-prompt-policy.json", "utf8"));
  assert.deepEqual(metadata.test_prompts, EXPECTED_TEST_PROMPTS);
  assert.deepEqual(policy.prompts, EXPECTED_TEST_PROMPTS);
  assert.equal(metadata.cross_disciplinary_pairing.description, EXPECTED_PAIRING_DESCRIPTION);

  const promptText = metadata.test_prompts.map(({ prompt }: { prompt: string }) => prompt).join("\n");
  assert.doesNotMatch(promptText, /\bPython\b|\bCSV\b|\blist\b|\btuple\b/i);
  assert.match(promptText, /pediatric respiratory/i);
  assert.match(promptText, /supervised community health worker/i);
});

test("raw contract requires original and normalized payload hashes without product claims", async () => {
  const contract = JSON.parse(await readFile("config/medpsy-raw-profiler-v2/contract.json", "utf8"));
  assert.deepEqual(contract.requiredRowHashes, ["rawSha256", "normalizedSha256"]);
  assert.equal(contract.claims.productSafety, false);
  assert.equal(contract.claims.dangerOwnership, false);
  assert.equal(contract.claims.qvacProductBehavior, false);
  assert.equal(contract.claims.officialRuntimeCompatibility, true);
});

test("raw evaluator validates dual hashes and exact-one-JSON framing", async () => {
  const { result, outputPath } = await evaluate(rawFixture());
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(await readFile(outputPath, "utf8"));
  assert.equal(output.status, "pass");
  assert.equal(output.manifestSha256, "d".repeat(64));
  assert.equal(output.gates.dualHashIntegrity.status, "pass");
  assert.equal(output.gates.exactOneJson.status, "pass");
});

test("raw evaluator fails when either preserved hash is wrong", async () => {
  const fixture = rawFixture();
  const bad = { ...fixture, rows: [{ ...fixture.rows[0], normalizedSha256: "0".repeat(64) }] };
  const { result, outputPath } = await evaluate(bad);
  assert.equal(result.status, 2, result.stderr);
  const output = JSON.parse(await readFile(outputPath, "utf8"));
  assert.equal(output.gates.dualHashIntegrity.status, "fail");
});

test("raw evaluator never scores danger ownership or product safety", async () => {
  const fixture = rawFixture();
  const input = { ...fixture, rows: [{ ...fixture.rows[0], dangerOwnership: "fail", productSafety: "fail" }] };
  const { result, outputPath } = await evaluate(input);
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(await readFile(outputPath, "utf8"));
  assert.deepEqual(Object.keys(output.gates).sort(), ["artifactNoWeights", "dualHashIntegrity", "exactOneJson", "runtimeIdentity"]);
  assert.deepEqual(output.notEvaluated, ["dangerOwnership", "productSafety", "qvacProductBehavior"]);
});

test("raw evaluator rejects weight-bearing artifacts", async () => {
  const { result, outputPath } = await evaluate(rawFixture({ artifacts: ["raw/responses.jsonl", "model/medpsy.gguf"] }));
  assert.equal(result.status, 2, result.stderr);
  const output = JSON.parse(await readFile(outputPath, "utf8"));
  assert.equal(output.gates.artifactNoWeights.status, "fail");
});

test("raw contract freezes commands, schemas, source hashes, and no-weight rules deterministically", async () => {
  const directory = await mkdtemp(join(tmpdir(), "medpsy-raw-manifest-"));
  const first = join(directory, "a.json");
  const second = join(directory, "b.json");
  assert.equal(run("scripts/medpsy-raw-profiler-v2/freeze-manifest.ts", [first]).status, 0);
  assert.equal(run("scripts/medpsy-raw-profiler-v2/freeze-manifest.ts", [second]).status, 0);
  const firstBytes = await readFile(first);
  const secondBytes = await readFile(second);
  assert.equal(sha256(firstBytes), sha256(secondBytes));
  const manifest = JSON.parse(firstBytes.toString("utf8"));
  assert.equal(manifest.namespace, "medpsy-raw-profiler-v2");
  assert.ok(manifest.commands.freeze.includes("freeze-manifest.ts"));
  assert.ok(manifest.commands.evaluate.includes("evaluate.ts"));
  assert.ok(Object.values(manifest.schemas).every((value) => typeof value === "object"));
  assert.ok(Object.values(manifest.sourceHashes).every((value) => /^[a-f0-9]{64}$/.test(String(value))));
  assert.deepEqual(manifest.forbiddenArtifactSuffixes, [".gguf", ".partial", ".part"]);
  assert.deepEqual(manifest.thresholds, { dualHashRequiredRate: 1, exactOneJsonRequiredRate: 1, maximumWeightArtifacts: 0 });
});

test("raw and product evidence labels cannot be confused", async () => {
  const raw = JSON.parse(await readFile("config/medpsy-raw-profiler-v2/contract.json", "utf8"));
  const product = JSON.parse(await readFile("config/medpsy-product-v2/contract.json", "utf8"));
  assert.notEqual(raw.namespace, product.namespace);
  assert.notEqual(raw.evidenceTier, product.evidenceTier);
  const { result } = await evaluate(rawFixture({ namespace: product.namespace, evidenceTier: product.evidenceTier }));
  assert.equal(result.status, 2);
});

test("raw v2 producer invokes pinned official llama.cpp and preserves dual hashes", async () => {
  const source = await readFile("scripts/medpsy-raw-profiler-v2/run-raw.ts", "utf8");
  assert.match(source, /normalizeJsonStdout/);
  assert.match(source, /(?:execFile|run)\(\s*"llama-cli"/);
  for (const token of ["-t", "4", "-ngl", "0", "-c", "2048", "-n", "128", "--temp", "0", "--jinja", "--single-turn"]) {
    assert.ok(source.includes(JSON.stringify(token)), `pinned llama argument ${token}`);
  }
  assert.match(source, /rawSha256/);
  assert.match(source, /normalizedSha256/);
  assert.match(source, /contract\.candidate\.bytes/);
  assert.match(source, /contract\.candidate\.sha256/);
});

test("evidence v2 workflow is raw-only Ubuntu evidence with strict cleanup and artifact allowlist", async () => {
  const workflow = await readFile(".github/workflows/medpsy-evidence-v2.yml", "utf8");
  for (const frozen of [
    "qvac/MedPsy-1.7B-GGUF",
    "fd4cecc90c2de8dce4b112795456a54be9c59363",
    "medpsy-1.7b-q4_k_m-imat.gguf",
    "1282439360",
    "41ee947d9cce72ec657577219fd1798fabeabf0d832217fe23c9d6d3d18d5880",
    "c8ade30036139e32108fee53d8b7164dbfda4bee",
  ]) assert.ok(workflow.includes(frozen), `workflow freezes ${frozen}`);
  assert.match(workflow, /runs-on:\s*ubuntu-24\.04/);
  assert.doesNotMatch(workflow, /self-hosted|larger-runner|runs-on:\s*\[[^\]]/);
  assert.match(workflow, /run-raw\.ts/);
  assert.doesNotMatch(workflow, /run-qvac\.ts|supported-platform-qvac-product/);
  assert.match(workflow, /if:\s*success\(\)/);

  const cleanup = workflow.indexOf("Remove model bytes, partials, and caches before upload");
  const upload = workflow.indexOf("Upload strict raw evidence allowlist");
  assert.ok(cleanup >= 0 && upload > cleanup, "cleanup precedes upload");
  assert.match(workflow, /rm -rf .*model.*\.qvac/);
  assert.match(workflow, /path:\s*\|\s*\n(?:\s+[^\n]+\n)+/);
  assert.doesNotMatch(workflow.slice(upload), /^\s+evidence\/\*\*/m);
  assert.doesNotMatch(workflow.slice(upload), /\.gguf|\.partial|\.part/);
});
