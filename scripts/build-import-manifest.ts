import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const SOURCE_REPOSITORY = "https://github.com/dmustapha/triage-0";
export const PINNED_COMMIT = "74424721bc75f564808eacce42d7f7f42676ae0f";
export const DEFAULT_SOURCE_REPOSITORY_PATH = "/Users/MAC/triage-0";

export const PLANNED_SOURCE_PATHS = [
  "LICENSE",
  "data/protocols/README.md", "data/rag/dose-tables.txt", "package-lock.json", "package.json",
  "public/app.html", "public/apple-touch-icon.png", "public/assets/css/app.css",
  "public/assets/css/base.css", "public/assets/css/fonts.css", "public/assets/css/landing.css",
  "public/assets/css/tokens.css", "public/assets/fonts/bricolagegrotesque-704ed999.woff2",
  "public/assets/fonts/bricolagegrotesque-a24a0e4a.woff2",
  "public/assets/fonts/bricolagegrotesque-b2c054fd.woff2",
  "public/assets/fonts/hankengrotesk-2f1d024a.woff2",
  "public/assets/fonts/hankengrotesk-5cebb0b5.woff2",
  "public/assets/fonts/hankengrotesk-8ad2d398.woff2",
  "public/assets/fonts/hankengrotesk-b0a9ff2a.woff2", "public/assets/img/apple-touch-icon.png",
  "public/assets/img/favicon-32.png", "public/assets/img/favicon.ico", "public/assets/img/favicon.svg",
  "public/assets/img/logo.svg", "public/assets/js/net.js", "public/assets/js/triage.js",
  "public/favicon-16.png", "public/favicon-32.png", "public/favicon-48.png", "public/favicon.ico",
  "public/favicon.svg", "public/index.html", "public/logo.png", "public/logo.svg",
  "scripts/audit-cases.ts", "scripts/clinical-audit.ts", "scripts/ingest-protocols.ts",
  "scripts/patch-sdk-zod.mjs", "src/config.ts", "src/qvac/egress-guard.ts", "src/qvac/engine.ts",
  "src/qvac/orchestrator.ts", "src/qvac/perf-logger.ts", "src/qvac/sdk.ts", "src/rag/ingest.ts",
  "src/rag/store.ts", "src/server.ts", "src/triage/class-router.ts", "src/triage/protocol-table.ts",
  "src/triage/schema.ts", "src/triage/severity.ts", "src/triage/triage.ts",
  "tests/integration/citation-integrity.test.ts", "tests/integration/grounding.test.ts",
  "tests/integration/http-validation.test.ts", "tests/integration/injection.test.ts",
  "tests/integration/offline-egress.test.ts", "tests/integration/server.test.ts",
  "tests/integration/sse-contract.test.ts", "tests/integration/triage.test.ts",
  "tests/quality/results-after-failure.json", "tests/quality/results-after-textbook.json",
  "tests/quality/results-baseline-failure.json", "tests/quality/results.json",
  "tests/unit/class-router.test.ts", "tests/unit/config.test.ts", "tests/unit/egress-host.test.ts",
  "tests/unit/frontend.test.ts", "tests/unit/perf-csv.test.ts", "tests/unit/perf-logger.test.ts",
  "tests/unit/protocol-table.test.ts", "tests/unit/severity.test.ts", "tests/unit/store-save.test.ts",
  "tests/unit/store.test.ts", "tests/unit/text-quality.test.ts", "tsconfig.json",
] as const;

const MODIFIED_FOR_ADTC = new Set<string>([
  "package-lock.json", "package.json", "public/app.html", "public/assets/css/app.css", "public/assets/js/triage.js",
  "src/config.ts", "src/qvac/engine.ts", "src/server.ts",
  "src/triage/schema.ts", "src/triage/severity.ts", "src/triage/triage.ts",
  "tests/integration/http-validation.test.ts",
  "tests/integration/server.test.ts", "tests/integration/sse-contract.test.ts",
  "tests/integration/triage.test.ts", "tests/unit/config.test.ts", "tests/unit/frontend.test.ts",
  "tests/unit/severity.test.ts", "tsconfig.json",
]);

const MODIFICATION_REASONS: Record<string, string> = {
  "package-lock.json": "Reconciled one lockfile for the merged ADTC evidence and Triage-0 application dependency contract.",
  "package.json": "Preserved ADTC evidence commands while adding the pinned Triage-0 runtime, application, and test package contract.",
  "public/app.html": "Removed excluded speech and multilingual controls and added the accessible structured patient-age and seven-sign checklist for the English text workflow.",
  "public/assets/css/app.css": "Added compact responsive checklist, native-control focus, age input, completion, and recorded-summary styling within the existing clinical visual system.",
  "public/assets/js/triage.js": "Removed excluded audio and translation behavior, required a complete supported-age structured checklist, serialized its seven authoritative observations, and suppressed model-authored red-flag display.",
  "src/config.ts": "Bound the QVAC MedPsy role to the verified canonical local GGUF and removed alternate remote model selection.",
  "src/qvac/engine.ts": "Removed STT, TTS, and translation engine functions whose modules are excluded from the Task 3 baseline.",
  "src/server.ts": "Preserved English text triage while parsing structured age and danger observations before QVAC context, semantic routing, retrieval, or MedPsy; deterministic emergency, assessment-required, and age-scoped chest-indrawing branches now short-circuit before runtime work.",
  "src/triage/schema.ts": "Added strict structured patient-age and seven-field danger-observation request schemas with missing observations normalized to NOT_ASSESSED and request-level CONFLICT rejected.",
  "src/triage/severity.ts": "Added authoritative structured danger state to severity entry points so free text and model red_flags cannot control the seven frozen atoms while non-respiratory and self-harm safeguards remain deterministic.",
  "src/triage/triage.ts": "Preserved English QVAC routing and grounding while adding deterministic structured-danger cards, observable runtime boundaries, authoritative structured severity input, and structured-only visible red_flags.",
  "tests/integration/http-validation.test.ts": "Retained excluded-audio assertions and added invalid structured-age/value rejection proving requests reach neither triageContext nor runtime/download boundaries.",
  "tests/integration/server.test.ts": "Kept model-free health coverage active and asserted canonical path, hash, and distinct QVAC/llama.cpp runtime identities.",
  "tests/integration/sse-contract.test.ts": "Added model-free SSE coverage for omitted, partial, emergency, and chest-indrawing assessments with zero observed QVAC, semantic-routing, retrieval, or MedPsy calls; grounded model cases now send supported all-absent structured state.",
  "tests/integration/triage.test.ts": "Replaced the model-dependent danger case with deterministic fixed-citation and citation-integrity coverage, and required supported all-absent grounded QVAC cases to observe a MedPsy call.",
  "tests/unit/config.test.ts": "Asserted the single canonical local MedPsy path, fail-closed missing bytes, and rejection of alternate model selection.",
  "tests/unit/frontend.test.ts": "Added DOM, accessibility, clinical-label, safe-default, age-boundary, completion, request-serialization, and recorded-summary regressions for the structured checklist.",
  "tests/unit/severity.test.ts": "Added regressions proving authoritative structured state controls respiratory emergency and chest-indrawing decisions while model prose/red_flags cannot override all-absent state and non-respiratory safeguards remain intact.",
  "tsconfig.json": "Merged the imported DOM and interoperability requirements with the strict ADTC NodeNext compiler contract.",
};

export type ImportClassification = "reused" | "modified-for-adtc";

export interface ImportEntry {
  sourcePath: string;
  destinationPath: string;
  sourceGitObject: string;
  sourceSha256: string;
  originalCreatedAt: string;
  classification: ImportClassification;
  purpose: string;
  destinationSha256?: string;
  modification?: { status: "pending-adaptation" | "modified"; reason: string };
}

export interface ImportManifest {
  schemaVersion: 1;
  kind: "pre-import-plan";
  applicationImported: false;
  preparedAt: string;
  reviewedBy: string;
  source: { repository: string; localObjectStore: string; commit: string; license: string };
  scope: { included: string[]; excluded: string[] };
  notices: { apache20: string; priorHackathon: string };
  reviews: { sourceRights: { completed: false; required: true }; clinical: { completed: false; required: true } };
  imports: ImportEntry[];
  adtcNewFiles: Array<{ path: string; classification: "adtc-new"; purpose: string }>;
  thirdPartyDependencies: Array<{ name: string; classification: "third-party"; basis: string; unresolvedRisk: string }>;
}

export interface CompletedImportManifest extends Omit<ImportManifest, "kind" | "applicationImported" | "imports"> {
  kind: "completed-import";
  applicationImported: true;
  imports: ImportEntry[];
}

export type ImportManifestDocument = ImportManifest | CompletedImportManifest;

export function completeImportManifest(repositoryPath = DEFAULT_SOURCE_REPOSITORY_PATH): CompletedImportManifest {
  const manifest = buildImportManifest(repositoryPath);
  const imports = manifest.imports.map((entry) => {
    const destinationSha256 = createHash("sha256").update(readFileSync(entry.destinationPath)).digest("hex");
    if (entry.classification === "reused") {
      if (destinationSha256 !== entry.sourceSha256) throw new Error(`Reused destination differs from source: ${entry.destinationPath}`);
      return { ...entry, destinationSha256 };
    }
    const reason = MODIFICATION_REASONS[entry.destinationPath];
    if (!reason) throw new Error(`Missing modification reason: ${entry.destinationPath}`);
    const status = destinationSha256 === entry.sourceSha256 ? "pending-adaptation" as const : "modified" as const;
    return { ...entry, destinationSha256, modification: { status, reason } };
  });
  return { ...manifest, kind: "completed-import", applicationImported: true, imports };
}

function git(repositoryPath: string, args: string[]): Buffer {
  return execFileSync("git", ["-C", repositoryPath, ...args], { stdio: ["ignore", "pipe", "pipe"] });
}

function originalCreatedAt(repositoryPath: string, sourcePath: string): string {
  const output = git(repositoryPath, ["log", "--follow", "--diff-filter=A", "--format=%aI", PINNED_COMMIT, "--", sourcePath]);
  const dates = output.toString("utf8").trim().split("\n").filter(Boolean);
  const createdAt = dates.at(-1);
  if (!createdAt) throw new Error(`No creation date for ${sourcePath}`);
  return createdAt;
}

function buildEntry(repositoryPath: string, sourcePath: string): ImportEntry {
  const bytes = git(repositoryPath, ["show", `${PINNED_COMMIT}:${sourcePath}`]);
  const sourceGitObject = git(repositoryPath, ["rev-parse", `${PINNED_COMMIT}:${sourcePath}`]).toString().trim();
  const classification = MODIFIED_FOR_ADTC.has(sourcePath) ? "modified-for-adtc" : "reused";
  return {
    sourcePath,
    destinationPath: sourcePath === "LICENSE" ? "docs/licenses/TRIAGE-0-APACHE-2.0.txt" : sourcePath,
    sourceGitObject,
    sourceSha256: createHash("sha256").update(bytes).digest("hex"),
    originalCreatedAt: originalCreatedAt(repositoryPath, sourcePath),
    classification,
    purpose: classification === "reused" ? "Exact pinned baseline component" : "Pinned baseline requiring the documented ADTC scope/runtime adaptation",
  };
}

export function buildImportManifest(repositoryPath = DEFAULT_SOURCE_REPOSITORY_PATH): ImportManifest {
  const resolvedCommit = git(repositoryPath, ["rev-parse", `${PINNED_COMMIT}^{commit}`]).toString().trim();
  if (resolvedCommit !== PINNED_COMMIT) throw new Error("Pinned source commit cannot be resolved exactly");
  return {
    schemaVersion: 1,
    kind: "pre-import-plan",
    applicationImported: false,
    preparedAt: "2026-08-24T00:00:00.000Z",
    reviewedBy: "conductor-authorized automated provenance contract",
    source: { repository: SOURCE_REPOSITORY, localObjectStore: repositoryPath, commit: PINNED_COMMIT, license: "Apache-2.0" },
    scope: {
      included: ["English text workflow", "local RAG", "deterministic clinical controls", "localhost UI/assets", "required tests and quality records", "package, ingestion, and SDK patch inputs"],
      excluded: ["speech-to-text", "text-to-speech", "translation", "cloud deployment", "demo/screenshots", "mutable performance logs", "model weights"],
    },
    notices: {
      apache20: "Reused Triage-0 material remains subject to the Apache License, Version 2.0; retain its copyright, license, and NOTICE obligations.",
      priorHackathon: "Triage-0 previously appeared as a non-commercial proof of concept in the June 2026 QVAC hackathon.",
    },
    reviews: { sourceRights: { completed: false, required: true }, clinical: { completed: false, required: true } },
    imports: PLANNED_SOURCE_PATHS.map((sourcePath) => buildEntry(repositoryPath, sourcePath)),
    adtcNewFiles: [
      { path: "PROVENANCE.md", classification: "adtc-new", purpose: "Human-readable reuse and risk disclosure" },
      { path: "PROVENANCE.json", classification: "adtc-new", purpose: "Machine-readable provenance registry" },
      { path: "config/import-manifest.schema.json", classification: "adtc-new", purpose: "Pre-import manifest contract" },
      { path: "config/import-manifest.json", classification: "adtc-new", purpose: "Frozen planned file ledger" },
      { path: "config/model-license-decision.json", classification: "adtc-new", purpose: "Disclosed-risk model license record" },
      { path: "scripts/build-import-manifest.ts", classification: "adtc-new", purpose: "Git-object manifest builder" },
      { path: "scripts/verify-import-manifest.ts", classification: "adtc-new", purpose: "Pinned-object verifier" },
      { path: "tests/import-provenance.test.ts", classification: "adtc-new", purpose: "Provenance regression contract" },
    ],
    thirdPartyDependencies: [
      { name: "MedPsy-1.7B Q4_K_M GGUF", classification: "third-party", basis: "Publisher-declared Apache-2.0 weights with attribution; bytes are downloaded separately and are not retained in Git", unresolvedRisk: "Model-card wording and incomplete upstream training-data provenance require disclosed-risk review" },
      { name: "@qvac/sdk 0.13.3", classification: "third-party", basis: "Pinned product runtime dependency from the source lockfile", unresolvedRisk: "Ubuntu x86 product compatibility remains to be proven" },
      { name: "llama.cpp", classification: "third-party", basis: "Official direct profiler and raw-evidence runtime", unresolvedRisk: "Final physical target-hardware evidence remains mandatory" },
      { name: "WHO-derived local protocol material", classification: "third-party", basis: "Locally cited clinical grounding source", unresolvedRisk: "Source-rights and clinical adaptation reviews remain mandatory" },
      { name: "ADTC official profiler/template", classification: "third-party", basis: "Competition-provided scored path and repository template", unresolvedRisk: "Organizer eligibility is not guaranteed by this record" },
    ],
  };
}

const invokedPath = process.argv[1];
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  const completed = process.argv.includes("--complete");
  const outputPath = process.argv.slice(2).find((arg) => !arg.startsWith("--")) ?? "config/import-manifest.json";
  const manifest = completed ? completeImportManifest() : buildImportManifest();
  writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`Wrote ${PLANNED_SOURCE_PATHS.length} ${completed ? "completed" : "planned"} imports to ${outputPath}\n`);
}
