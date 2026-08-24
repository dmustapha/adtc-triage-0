import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const tsx = resolve(root, "node_modules/tsx/dist/loader.mjs");
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const run = (script: string, args: string[]) =>
  spawnSync(process.execPath, ["--import", tsx, resolve(root, script), ...args], { cwd: root, encoding: "utf8" });

async function historicalAggregate(): Promise<string> {
  const base = "evidence/medpsy-shared-runtime-v1/remote-run-32742482642";
  const files: string[] = [];
  async function walk(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else files.push(path);
    }
  }
  await walk(base);
  const lines = await Promise.all(files.sort().map(async (path) => `${sha256(await readFile(path))}  ${path}\n`));
  return sha256(lines.join(""));
}

async function productFixture(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 2,
    namespace: "medpsy-product-v2",
    evidenceTier: "supported-platform-qvac-product",
    manifestSha256: "c".repeat(64),
    stage: "calibration",
    producerKind: "production-qvac-orchestration",
    candidate: {
      candidateId: "medpsy-1.7b-q4",
      repository: "qvac/MedPsy-1.7B-GGUF",
      revision: "fd4cecc90c2de8dce4b112795456a54be9c59363",
      filename: "medpsy-1.7b-q4_k_m-imat.gguf",
      bytes: 1282439360,
      sha256: "41ee947d9cce72ec657577219fd1798fabeabf0d832217fe23c9d6d3d18d5880",
    },
    runtime: { name: "QVAC SDK", version: "0.13.3", officiallySupportedPlatform: true },
    rows: [{
      caseId: "CAL-PRODUCT-001",
      evidenceKind: "real-product-execution",
      modelInvoked: true,
      stages: ["semantic-routing", "local-rag", "reason-pass", "extract-pass", "schema-validation", "bounded-retry", "deterministic-reconciliation", "source-bound-plan-assembly"],
      citationsValidated: true,
      noEgress: true,
      outputValid: true,
    }],
    artifacts: ["producer-manifest.json", "raw/product-calibration.jsonl", "calibration-evaluation.json"],
    ...overrides,
  };
}

async function evaluate(input: unknown) {
  const directory = await mkdtemp(join(tmpdir(), "medpsy-product-v2-"));
  const inputPath = join(directory, "input.json");
  const outputPath = join(directory, "output.json");
  await writeFile(inputPath, JSON.stringify(input));
  return { result: run("scripts/medpsy-product-v2/evaluate.ts", [inputPath, outputPath]), outputPath };
}

test("product contract freezes the exact MedPsy and QVAC identities in its own namespace", async () => {
  const contract = JSON.parse(await readFile("config/medpsy-product-v2/contract.json", "utf8"));
  assert.equal(contract.namespace, "medpsy-product-v2");
  assert.equal(contract.evidenceTier, "supported-platform-qvac-product");
  assert.equal(contract.candidate.repository, "qvac/MedPsy-1.7B-GGUF");
  assert.equal(contract.candidate.revision, "fd4cecc90c2de8dce4b112795456a54be9c59363");
  assert.equal(contract.candidate.filename, "medpsy-1.7b-q4_k_m-imat.gguf");
  assert.equal(contract.candidate.bytes, 1282439360);
  assert.equal(contract.candidate.sha256, "41ee947d9cce72ec657577219fd1798fabeabf0d832217fe23c9d6d3d18d5880");
  assert.deepEqual(contract.runtime, { name: "QVAC SDK", version: "0.13.3" });
});

test("product contract requires the complete production orchestration and excludes fixtures", async () => {
  const contract = JSON.parse(await readFile("config/medpsy-product-v2/contract.json", "utf8"));
  assert.deepEqual(contract.requiredProductStages, ["semantic-routing", "local-rag", "reason-pass", "extract-pass", "schema-validation", "bounded-retry", "deterministic-reconciliation", "source-bound-plan-assembly"]);
  assert.equal(contract.acceptedProducerKind, "production-qvac-orchestration");
  assert.equal(contract.unitFixturesAreFinalEvidence, false);
  assert.equal(contract.directOnePassRowsAreProductEvidence, false);
});

test("historical run remains immutable and additive v2 contracts point away from it", async () => {
  const contract = JSON.parse(await readFile("config/medpsy-product-v2/contract.json", "utf8"));
  assert.equal(contract.historicalEvidence.path, "evidence/medpsy-shared-runtime-v1/remote-run-32742482642");
  assert.equal(contract.historicalEvidence.aggregateSha256, "34a740958016b8fead9edbf16483dc41084b1619d891782756411d9ed962ca57");
  assert.equal(contract.historicalEvidence.immutable, true);
  assert.equal(await historicalAggregate(), contract.historicalEvidence.aggregateSha256);
});

test("product evaluator accepts only complete real QVAC product-path rows", async () => {
  const { result, outputPath } = await evaluate(await productFixture());
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(await readFile(outputPath, "utf8"));
  assert.equal(output.status, "pass");
  assert.equal(output.evidenceTier, "supported-platform-qvac-product");
  assert.equal(output.manifestSha256, "c".repeat(64));
  assert.equal(output.gates.productPath.status, "pass");
});

test("product evaluator rejects direct one-pass llama rows and unit fixtures", async () => {
  for (const input of [
    await productFixture({ producerKind: "direct-one-pass-llama.cpp" }),
    await productFixture({ rows: [{ ...(await productFixture()).rows[0], evidenceKind: "unit-fixture" }] }),
  ]) {
    const { result, outputPath } = await evaluate(input);
    assert.equal(result.status, 2, result.stderr);
    const output = JSON.parse(await readFile(outputPath, "utf8"));
    assert.equal(output.status, "fail");
  }
});

test("product evaluator blocks holdout before a frozen passing calibration", async () => {
  const { result, outputPath } = await evaluate(await productFixture({ stage: "holdout", prerequisites: { calibrationStatus: "absent" } }));
  assert.equal(result.status, 2, result.stderr);
  const output = JSON.parse(await readFile(outputPath, "utf8"));
  assert.equal(output.gates.calibrationBeforeHoldout.status, "fail");
});

test("product evaluator rejects a self-asserted calibration prerequisite without a bound evaluation artifact", async () => {
  const input = await productFixture({
    stage: "holdout",
    prerequisites: { calibrationStatus: "pass", calibrationManifestSha256: "a".repeat(64) },
  });
  const { result, outputPath } = await evaluate(input);
  assert.equal(result.status, 2, result.stderr);
  const output = JSON.parse(await readFile(outputPath, "utf8"));
  assert.equal(output.gates.calibrationBeforeHoldout.status, "fail");
});

test("product evaluator accepts a holdout only when bound to a passing frozen calibration evaluation", async () => {
  const calibrationRun = await evaluate(await productFixture());
  assert.equal(calibrationRun.result.status, 0, calibrationRun.result.stderr);
  const calibrationBytes = await readFile(calibrationRun.outputPath);
  const input = await productFixture({
    stage: "holdout",
    prerequisites: {
      calibrationEvaluationPath: calibrationRun.outputPath,
      calibrationEvaluationSha256: sha256(calibrationBytes),
      calibrationManifestSha256: "c".repeat(64),
    },
  });
  const { result, outputPath } = await evaluate(input);
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(await readFile(outputPath, "utf8"));
  assert.equal(output.gates.calibrationBeforeHoldout.status, "pass");
});

test("product evaluator rejects a calibration evaluation bound to a different producer manifest", async () => {
  const calibrationRun = await evaluate(await productFixture());
  assert.equal(calibrationRun.result.status, 0, calibrationRun.result.stderr);
  const calibrationBytes = await readFile(calibrationRun.outputPath);
  const input = await productFixture({
    stage: "holdout",
    prerequisites: {
      calibrationEvaluationPath: calibrationRun.outputPath,
      calibrationEvaluationSha256: sha256(calibrationBytes),
      calibrationManifestSha256: "b".repeat(64),
    },
  });
  const { result, outputPath } = await evaluate(input);
  assert.equal(result.status, 2, result.stderr);
  const output = JSON.parse(await readFile(outputPath, "utf8"));
  assert.equal(output.gates.calibrationBeforeHoldout.status, "fail");
});

test("product fatal gates freeze thresholds, tier labels, and no-weight rules", async () => {
  const gates = JSON.parse(await readFile("config/medpsy-product-v2/fatal-gates.json", "utf8"));
  assert.equal(gates.namespace, "medpsy-product-v2");
  assert.equal(gates.evidenceTier, "supported-platform-qvac-product");
  assert.equal(gates.thresholds.completeValidRate, 1);
  assert.equal(gates.thresholds.minimumModelInvokedSupportedCases, 1);
  assert.equal(gates.thresholds.maximumCitationFailures, 0);
  assert.equal(gates.thresholds.maximumEgressViolations, 0);
  assert.deepEqual(gates.forbiddenArtifactSuffixes, [".gguf", ".partial", ".part"]);
});

test("product manifest freezes commands, schemas, source hashes, and is deterministic", async () => {
  const directory = await mkdtemp(join(tmpdir(), "medpsy-product-manifest-"));
  const first = join(directory, "a.json");
  const second = join(directory, "b.json");
  assert.equal(run("scripts/medpsy-product-v2/freeze-manifest.ts", [first]).status, 0);
  assert.equal(run("scripts/medpsy-product-v2/freeze-manifest.ts", [second]).status, 0);
  const firstBytes = await readFile(first);
  const secondBytes = await readFile(second);
  assert.equal(sha256(firstBytes), sha256(secondBytes));
  const manifest = JSON.parse(firstBytes.toString("utf8"));
  assert.equal(manifest.namespace, "medpsy-product-v2");
  assert.ok(manifest.commands.freeze.includes("freeze-manifest.ts"));
  assert.ok(manifest.commands.evaluate.includes("evaluate.ts"));
  assert.ok(Object.values(manifest.schemas).every((value) => typeof value === "object"));
  assert.ok(Object.values(manifest.sourceHashes).every((value) => /^[a-f0-9]{64}$/.test(String(value))));
  assert.equal(manifest.noWeightArtifacts, true);
});
