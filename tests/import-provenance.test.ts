import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

import {
  PINNED_COMMIT,
  SOURCE_REPOSITORY,
  buildImportManifest,
  completeImportManifest,
} from "../scripts/build-import-manifest.js";
import { verifyImportManifest } from "../scripts/verify-import-manifest.js";

const TRIAGE_REPOSITORY = "/Users/MAC/triage-0";
const EXPECTED_SOURCE_FILES = [
  "LICENSE",
  "data/protocols/README.md",
  "data/rag/dose-tables.txt",
  "package-lock.json",
  "package.json",
  "public/app.html",
  "public/apple-touch-icon.png",
  "public/assets/css/app.css",
  "public/assets/css/base.css",
  "public/assets/css/fonts.css",
  "public/assets/css/landing.css",
  "public/assets/css/tokens.css",
  "public/assets/fonts/bricolagegrotesque-704ed999.woff2",
  "public/assets/fonts/bricolagegrotesque-a24a0e4a.woff2",
  "public/assets/fonts/bricolagegrotesque-b2c054fd.woff2",
  "public/assets/fonts/hankengrotesk-2f1d024a.woff2",
  "public/assets/fonts/hankengrotesk-5cebb0b5.woff2",
  "public/assets/fonts/hankengrotesk-8ad2d398.woff2",
  "public/assets/fonts/hankengrotesk-b0a9ff2a.woff2",
  "public/assets/img/apple-touch-icon.png",
  "public/assets/img/favicon-32.png",
  "public/assets/img/favicon.ico",
  "public/assets/img/favicon.svg",
  "public/assets/img/logo.svg",
  "public/assets/js/net.js",
  "public/assets/js/triage.js",
  "public/favicon-16.png",
  "public/favicon-32.png",
  "public/favicon-48.png",
  "public/favicon.ico",
  "public/favicon.svg",
  "public/index.html",
  "public/logo.png",
  "public/logo.svg",
  "scripts/audit-cases.ts",
  "scripts/clinical-audit.ts",
  "scripts/ingest-protocols.ts",
  "scripts/patch-sdk-zod.mjs",
  "src/config.ts",
  "src/qvac/egress-guard.ts",
  "src/qvac/engine.ts",
  "src/qvac/orchestrator.ts",
  "src/qvac/perf-logger.ts",
  "src/qvac/sdk.ts",
  "src/rag/ingest.ts",
  "src/rag/store.ts",
  "src/server.ts",
  "src/triage/class-router.ts",
  "src/triage/protocol-table.ts",
  "src/triage/schema.ts",
  "src/triage/severity.ts",
  "src/triage/triage.ts",
  "tests/integration/citation-integrity.test.ts",
  "tests/integration/grounding.test.ts",
  "tests/integration/http-validation.test.ts",
  "tests/integration/injection.test.ts",
  "tests/integration/offline-egress.test.ts",
  "tests/integration/server.test.ts",
  "tests/integration/sse-contract.test.ts",
  "tests/integration/triage.test.ts",
  "tests/quality/results-after-failure.json",
  "tests/quality/results-after-textbook.json",
  "tests/quality/results-baseline-failure.json",
  "tests/quality/results.json",
  "tests/unit/class-router.test.ts",
  "tests/unit/config.test.ts",
  "tests/unit/egress-host.test.ts",
  "tests/unit/frontend.test.ts",
  "tests/unit/perf-csv.test.ts",
  "tests/unit/perf-logger.test.ts",
  "tests/unit/protocol-table.test.ts",
  "tests/unit/severity.test.ts",
  "tests/unit/store-save.test.ts",
  "tests/unit/store.test.ts",
  "tests/unit/text-quality.test.ts",
  "tsconfig.json",
] as const;

function git(...args: string[]): Buffer {
  return execFileSync("git", ["-C", TRIAGE_REPOSITORY, ...args]);
}

test("planned manifest freezes the exact source and complete English text scope", () => {
  const manifest = buildImportManifest(TRIAGE_REPOSITORY);

  assert.equal(manifest.source.repository, SOURCE_REPOSITORY);
  assert.equal(manifest.source.commit, PINNED_COMMIT);
  assert.equal(manifest.applicationImported, false);
  assert.deepEqual(
    manifest.imports.map((entry) => entry.sourcePath).sort(),
    [...EXPECTED_SOURCE_FILES].sort(),
  );
  assert.equal(new Set(manifest.imports.map((entry) => entry.destinationPath)).size, manifest.imports.length);
  assert.ok(manifest.imports.every((entry) => entry.destinationPath && entry.originalCreatedAt));
  assert.ok(manifest.imports.every((entry) => ["reused", "modified-for-adtc"].includes(entry.classification)));
  assert.ok(!manifest.imports.some((entry) => /(^|\/)(audio|translation|voice|speech)[^/]*|^screenshots\/|^submission\/perf-log/.test(entry.sourcePath)));
  assert.equal(
    manifest.imports.find((entry) => entry.sourcePath === "LICENSE")?.destinationPath,
    "docs/licenses/TRIAGE-0-APACHE-2.0.txt",
  );
});

test("each planned hash is computed from the pinned Git blob", () => {
  const manifest = buildImportManifest(TRIAGE_REPOSITORY);

  for (const entry of manifest.imports) {
    const bytes = git("show", `${PINNED_COMMIT}:${entry.sourcePath}`);
    const expectedSha256 = createHash("sha256").update(bytes).digest("hex");
    const expectedObject = git("rev-parse", `${PINNED_COMMIT}:${entry.sourcePath}`).toString().trim();
    assert.equal(entry.sourceSha256, expectedSha256, entry.sourcePath);
    assert.equal(entry.sourceGitObject, expectedObject, entry.sourcePath);
  }
});

test("English text baseline has no runtime dependency on excluded modalities", () => {
  const runtimeFiles = [
    "src/qvac/engine.ts",
    "src/server.ts",
    "src/triage/triage.ts",
  ];

  for (const path of runtimeFiles) {
    const source = readFileSync(path, "utf8");
    assert.doesNotMatch(source, /(?:audio|translation)\.js/, path);
  }

  const server = readFileSync("src/server.ts", "utf8");
  assert.doesNotMatch(server, /app\.post\("\/(?:transcribe|tts)"/, "excluded routes must not be registered");
});

test("completed import ledger proves destination parity or records ADTC modification", () => {
  const manifest = JSON.parse(readFileSync("config/import-manifest.json", "utf8"));
  const regenerated = completeImportManifest(TRIAGE_REPOSITORY);

  assert.equal(manifest.applicationImported, true, "application import must be recorded complete");
  for (const entry of manifest.imports) {
    if (entry.destinationStatus === "removed") {
      assert.equal(existsSync(entry.destinationPath), false, entry.destinationPath);
      assert.equal(entry.destinationSha256, undefined, entry.destinationPath);
      assert.equal(entry.classification, "modified-for-adtc", entry.destinationPath);
      assert.equal(entry.modification?.status, "removed", entry.destinationPath);
      assert.ok(entry.modification?.reason, entry.destinationPath);
      continue;
    }
    assert.equal(entry.destinationStatus, "present", entry.destinationPath);
    const destinationBytes = readFileSync(entry.destinationPath);
    const destinationSha256 = createHash("sha256").update(destinationBytes).digest("hex");

    assert.equal(entry.destinationSha256, destinationSha256, entry.destinationPath);
    if (entry.classification === "reused") {
      assert.equal(destinationSha256, entry.sourceSha256, entry.destinationPath);
      continue;
    }

    assert.ok(entry.modification?.reason, `${entry.destinationPath} requires a modification reason`);
    assert.ok(
      ["pending-adaptation", "modified"].includes(entry.modification?.status),
      `${entry.destinationPath} requires a valid modification status`,
    );
  }

  for (const candidate of [manifest, regenerated]) {
    const reasons = new Map(candidate.imports.map((entry: { destinationPath: string; modification?: { reason?: string } }) => [entry.destinationPath, entry.modification?.reason]));
    const ledgerPurpose = candidate.adtcNewFiles.find((entry: { path: string }) => entry.path === "config/import-manifest.json")?.purpose;

    assert.match(reasons.get("public/app.html") ?? "", /one unified textarea.*one Get guidance action.*one shared result region/i);
    assert.match(reasons.get("public/app.html") ?? "", /no visible modes|removed visible.*modes/i);
    assert.match(reasons.get("public/app.html") ?? "", /manual(?:ly)? past(?:e|ed).*Gate 1 prompts/i);
    assert.doesNotMatch(reasons.get("public/app.html") ?? "", /submitted prompts available as unchanged examples/i);
    assert.match(reasons.get("public/assets/js/triage.js") ?? "", /semantic internal routing/i);
    assert.match(reasons.get("tests/unit/frontend.test.ts") ?? "", /one-input.*no-visible-mode/i);
    assert.equal(ledgerPurpose, "Completed current import ledger");
  }
});

test("verifier rejects a path absent from the pinned source tree", () => {
  const manifest = buildImportManifest(TRIAGE_REPOSITORY);
  manifest.imports[0] = {
    ...manifest.imports[0]!,
    sourcePath: "src/not-present-at-pinned-commit.ts",
  };

  assert.throws(
    () => verifyImportManifest(manifest, TRIAGE_REPOSITORY),
    /absent from pinned source tree/,
  );
});

test("verifier rejects empty and placeholder provenance", () => {
  const manifest = buildImportManifest(TRIAGE_REPOSITORY);
  assert.throws(
    () => verifyImportManifest({ ...manifest, imports: [] }, TRIAGE_REPOSITORY),
    /must contain planned imports/,
  );
  assert.throws(
    () => verifyImportManifest({ ...manifest, reviewedBy: "pending-review" }, TRIAGE_REPOSITORY),
    /placeholder/,
  );
});

test("verifier rejects an incomplete planned import set", () => {
  const manifest = buildImportManifest(TRIAGE_REPOSITORY);
  manifest.imports.pop();

  assert.throws(
    () => verifyImportManifest(manifest, TRIAGE_REPOSITORY),
    /planned import set mismatch/,
  );
});

test("disclosures preserve Apache-2.0 notice, prior submission, and unresolved reviews", () => {
  const provenance = JSON.parse(readFileSync("PROVENANCE.json", "utf8"));
  const licenseDecision = JSON.parse(readFileSync("config/model-license-decision.json", "utf8"));
  const schema = JSON.parse(readFileSync("config/import-manifest.schema.json", "utf8"));
  const disclosure = readFileSync("PROVENANCE.md", "utf8");

  assert.equal(provenance.applicationImported, true);
  assert.equal(provenance.status, "application-imported");
  assert.match(provenance.priorWorkDisclosure, /QVAC hackathon/i);
  assert.match(provenance.apacheNotice, /Apache License, Version 2\.0/);
  assert.match(disclosure, /QVAC hackathon/i);
  assert.match(disclosure, /Apache License, Version 2\.0/);
  assert.match(disclosure, /not legal advice|no legal certainty/i);
  assert.equal(provenance.reviews.clinical.completed, false);
  assert.equal(provenance.reviews.sourceRights.completed, false);

  assert.equal(licenseDecision.model.declaredWeightLicense, "Apache-2.0");
  assert.equal(licenseDecision.artifactAccess.publicAnonymous, true);
  assert.equal(licenseDecision.trainingProvenance.exhaustive, false);
  assert.equal(licenseDecision.scope.supervisedEarlyProofOfConcept, true);
  assert.equal(licenseDecision.riskPosture.userAuthorizedDisclosedRisk, true);
  assert.equal(licenseDecision.assurances.legalCertainty, false);
  assert.equal(licenseDecision.assurances.organizerEligibilityCertainty, false);
  assert.match(licenseDecision.upstreamDataCaveats.genesisIAndII, /CC-BY-NC/i);
  assert.match(licenseDecision.modelCardUseWording, /research|educational/i);
  assert.deepEqual(schema.properties.kind.enum, ["pre-import-plan", "completed-import"]);
  assert.equal(schema.properties.applicationImported.type, "boolean");
});

test("complete manifest verifies against the immutable source", () => {
  const manifest = buildImportManifest(TRIAGE_REPOSITORY);
  assert.doesNotThrow(() => verifyImportManifest(manifest, TRIAGE_REPOSITORY));
});
