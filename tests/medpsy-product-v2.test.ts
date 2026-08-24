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
      labelReviewStatus: "reviewed",
      clinicalReview: {
        reviewerName: "Test Fixture Reviewer",
        reviewerRole: "test-only fixture",
        reviewedAt: "2026-08-24T00:00:00Z",
      },
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

const canonicalHash = (value: unknown) => sha256(JSON.stringify(value));

test("v2 calibration corpus has unique revision IDs and immutable case commitments", async () => {
  const corpus = JSON.parse(await readFile("config/medpsy-product-v2/calibration-corpus.json", "utf8"));
  const ids = corpus.cases.map((item: any) => item.id);
  assert.equal(corpus.namespace, "medpsy-product-v2");
  assert.equal(corpus.split, "development-calibration");
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.length >= 27);
  assert.ok(ids.every((id: string) => /^MPCAL2-\d{3}$/.test(id)));
  for (const item of corpus.cases) {
    const { caseSha256, ...committed } = item;
    assert.match(caseSha256, /^[a-f0-9]{64}$/);
    assert.equal(caseSha256, canonicalHash(committed));
  }
});

test("every calibration case is source-backed and clinically provisional", async () => {
  const corpus = JSON.parse(await readFile("config/medpsy-product-v2/calibration-corpus.json", "utf8"));
  const sources = JSON.parse(await readFile("config/clinical-sources.json", "utf8"));
  const byId = new Map(sources.map((source: any) => [source.id, source]));
  assert.equal(corpus.clinicalLabelStatus, "provisional-pending-named-human-review");
  for (const item of corpus.cases) {
    assert.equal(item.labelReviewStatus, corpus.clinicalLabelStatus);
    assert.ok(item.citations.length > 0);
    for (const citation of item.citations) {
      const source: any = byId.get(citation.sourceId);
      assert.ok(source, `${item.id}: registered source ${citation.sourceId}`);
      assert.equal(citation.sourceSha256, source.sha256);
      assert.equal(citation.derivedContentSha256, source.derivedContentSha256);
      assert.equal(citation.locator, source.locator);
    }
  }
});

test("calibration coverage matrix is complete and the failed v1 expected-output contract is not reused", async () => {
  const corpus = JSON.parse(await readFile("config/medpsy-product-v2/calibration-corpus.json", "utf8"));
  const historical = JSON.parse(await readFile("config/phase1-contract-v1/calibration-corpus.json", "utf8"));
  const covered = new Set(corpus.cases.flatMap((item: any) => item.coverage));
  assert.deepEqual([...covered].sort(), [...corpus.requiredCoverage].sort());
  const historicalPrompts = new Set(historical.cases.map((item: any) => item.prompt));
  for (const item of corpus.cases) {
    assert.ok(!historicalPrompts.has(item.request.caseText), `${item.id}: fresh case text`);
    assert.ok(!Object.keys(item.expected).some((key) => ["scope", "cd", "ve", "cv", "lu", "ci", "cs", "ox"].includes(key)));
  }
});

test("sealed holdout manifest contains no case contents and has reproducible design hashes", async () => {
  const manifest = JSON.parse(await readFile("config/medpsy-product-v2/holdout-manifest.json", "utf8"));
  assert.equal(manifest.status, "awaiting-authorized-independent-producer");
  assert.equal(manifest.contentsInspected, false);
  assert.equal(manifest.caseContentSha256, null);
  assert.equal(manifest.corpusArtifactPath, null);
  assert.ok(!("cases" in manifest));
  assert.equal(manifest.reservedIdsSha256, canonicalHash(manifest.reservedCaseIds));
  const { manifestCoreSha256, ...core } = manifest;
  assert.equal(manifestCoreSha256, canonicalHash(core));
});

test("calibration and sealed holdout identifiers are disjoint", async () => {
  const corpus = JSON.parse(await readFile("config/medpsy-product-v2/calibration-corpus.json", "utf8"));
  const holdout = JSON.parse(await readFile("config/medpsy-product-v2/holdout-manifest.json", "utf8"));
  const calibrationIds = new Set(corpus.cases.map((item: any) => item.id));
  assert.equal(holdout.reservedCaseIds.filter((id: string) => calibrationIds.has(id)).length, 0);
});

test("review rubric names the pending human gate and provisional rows fail closed", async () => {
  const contract = JSON.parse(await readFile("config/medpsy-product-v2/contract.json", "utf8"));
  const rubricBytes = await readFile("config/medpsy-product-v2/review-rubric.json");
  const rubric = JSON.parse(rubricBytes.toString("utf8"));
  assert.equal(rubric.reviewGate.status, "provisional-pending-named-human-review");
  assert.equal(rubric.reviewGate.reviewerName, null);
  assert.equal(rubric.reviewGate.builderOrAgentSelfReviewAllowed, false);
  assert.ok(rubric.requiredRecordFields.includes("reviewerName"));
  assert.ok(contract.schemas.row.required.includes("labelReviewStatus"));
  assert.ok(contract.schemas.row.required.includes("clinicalReview"));
  const fixture = await productFixture();
  fixture.rows[0].labelReviewStatus = "provisional-pending-named-human-review";
  fixture.rows[0].clinicalReview = null as any;
  const { result, outputPath } = await evaluate(fixture);
  assert.equal(result.status, 2, result.stderr);
  const output = JSON.parse(await readFile(outputPath, "utf8"));
  assert.equal(output.gates.namedHumanClinicalReview.status, "fail");

  const missingIdentity = await productFixture();
  missingIdentity.rows[0].clinicalReview = null as any;
  const missing = await evaluate(missingIdentity);
  assert.equal(missing.result.status, 2, missing.result.stderr);
  const missingOutput = JSON.parse(await readFile(missing.outputPath, "utf8"));
  assert.equal(missingOutput.gates.namedHumanClinicalReview.status, "fail");
});

test("product manifest binds the corpus, sealed holdout design, and review rubric hashes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "medpsy-product-task7-manifest-"));
  const output = join(directory, "manifest.json");
  assert.equal(run("scripts/medpsy-product-v2/freeze-manifest.ts", [output]).status, 0);
  const manifest = JSON.parse(await readFile(output, "utf8"));
  for (const key of ["calibrationCorpus", "holdoutManifest", "reviewRubric", "corpusMethod"]) {
    assert.match(manifest.sourceHashes[key], /^[a-f0-9]{64}$/);
  }
});
