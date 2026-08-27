import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
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
  "data/protocols/README.md", "package-lock.json", "package.json", "public/app.html", "public/index.html", "public/logo.png", "public/assets/css/app.css", "public/assets/js/net.js", "public/assets/js/triage.js",
  "scripts/clinical-audit.ts", "scripts/ingest-protocols.ts", "scripts/patch-sdk-zod.mjs",
  "src/config.ts", "src/qvac/engine.ts", "src/qvac/orchestrator.ts", "src/qvac/perf-logger.ts", "src/qvac/sdk.ts", "src/rag/store.ts", "src/server.ts",
  "src/triage/class-router.ts", "src/triage/schema.ts", "src/triage/severity.ts", "src/triage/triage.ts",
  "tests/integration/http-validation.test.ts",
  "tests/integration/server.test.ts", "tests/integration/sse-contract.test.ts",
  "tests/integration/triage.test.ts", "tests/unit/config.test.ts", "tests/unit/frontend.test.ts",
  "tests/unit/class-router.test.ts", "tests/unit/perf-csv.test.ts", "tests/unit/perf-logger.test.ts", "tests/unit/severity.test.ts", "tsconfig.json",
]);

const MODIFICATION_REASONS: Record<string, string> = {
  "data/protocols/README.md": "Replaced manual-only WHO setup with the checksum-locked, idempotent protocol downloader used by clean local setup.",
  "package-lock.json": "Reconciled one lockfile for the merged ADTC evidence and Triage-0 application dependency contract.",
  "package.json": "Preserved ADTC evidence commands while adding the pinned Triage-0 runtime, application, and corrected integration-test package contract.",
  "public/app.html": "Restored one unified textarea, one Get guidance action, and one shared result region; removed visible assessment and model modes plus submitted-prompt shortcuts; preserved manual paste of the exact two Gate 1 prompts.",
  "public/index.html": "Replaced imported unsupported claims with claim-limited copy that truthfully introduces pediatric IMCI, adult mhGAP, ordinary prompts, and observed runtime readiness.",
  "public/logo.png": "Removed the redundant raster logo after the interface standardized on the imported SVG identity assets.",
  "public/assets/css/app.css": "Removed obsolete public classification, plan, and raw-retrieval-excerpt styling; added result-first respiratory assessment, input-authority, and provenance styles; and raised mobile controls and operational text to comfortable touch targets.",
  "public/assets/js/net.js": "Distinguished browser network reachability from server-enforced on-device egress proof so UI badges cannot imply cloud inference or completed offline evidence.",
  "public/assets/js/triage.js": "Added semantic internal routing for general versus explicit clinical input, one-revision ambiguity clarification, structured review before /triage, shared /assist and clinical result ownership, and truthful cancellation, readiness, and provenance states without exact-prompt branching.",
  "scripts/clinical-audit.ts": "Kept clinical audit failures observable while preventing raw operational error content from entering console logs.",
  "scripts/ingest-protocols.ts": "Made ingestion failures use the shared bounded error-name policy without exposing raw paths or SDK messages.",
  "scripts/patch-sdk-zod.mjs": "Replaced vendor mutation with a read-only pinned QVAC/Zod compatibility gate and bounded failure output.",
  "src/config.ts": "Bound the QVAC MedPsy role to the verified canonical local GGUF and removed alternate remote model selection.",
  "src/qvac/engine.ts": "Removed excluded modality functions and bound queue abort signals to exact QVAC completion request cancellation without releasing native ownership before settlement.",
  "src/qvac/orchestrator.ts": "Made unload and shutdown failures observable through bounded diagnostics while preserving safe stale-handle removal.",
  "src/qvac/perf-logger.ts": "Exposed one canonical header-only CSV representation so an empty local telemetry dataset is truthful and stable without creating evidence rows.",
  "src/qvac/sdk.ts": "Added the typed QVAC 0.13.3 completion request identifier and exact request-cancellation shim used by bounded clinical and prompt jobs.",
  "src/rag/store.ts": "Preserved native QVAC retrieval and citation mapping while bounding parse diagnostics and removing raw path/error logging.",
  "src/triage/class-router.ts": "Made the off-domain routing threshold finite and range-bounded so invalid environment configuration fails closed.",
  "src/server.ts": "Made deterministic respiratory policy the sole public result authority; exposed only neutral assessment fields plus model/runtime/retrieval provenance; kept raw retrieval and classifier output private; made model initialization sequential; rejected record conflicts; and preserved exact method/readiness contracts.",
  "src/triage/schema.ts": "Added strict structured patient-age, seven-field danger-observation, respiratory-concern, one-minute calm count-quality, and 1-200 respiratory-rate request schemas.",
  "src/triage/severity.ts": "Added authoritative structured danger state to severity entry points so free text and model red_flags cannot control the seven frozen atoms while non-respiratory and self-harm safeguards remain deterministic.",
  "src/triage/triage.ts": "Preserved English QVAC routing and grounding while adding deterministic structured-danger cards, observable runtime boundaries, authoritative structured severity input, and structured-only visible red_flags.",
  "tests/integration/http-validation.test.ts": "Added exact JSON 405 and Allow-header coverage, truthful header-only empty telemetry CSV behavior, narrative/structured conflict rejection, and a regression proving a bare listener reports liveness but not product readiness.",
  "tests/integration/server.test.ts": "Kept canonical health identity coverage and changed the real model-backed hero loop to require a narrowed assessment payload with no public classification, plan, or clinical instructions.",
  "tests/integration/sse-contract.test.ts": "Defined deterministic respiratory API/SSE outcomes, exact no-QVAC boundaries, fixed versus retrieved citation provenance, real QVAC assistance with truthful retrieval mode, and the absence of classifier, plan, treatment, and raw retrieval text from public payloads.",
  "tests/integration/triage.test.ts": "Replaced the model-dependent danger case with deterministic fixed-citation and citation-integrity coverage, and required supported all-absent grounded QVAC cases to observe a MedPsy call.",
  "tests/unit/config.test.ts": "Asserted the single canonical local MedPsy path, fail-closed missing bytes, and rejection of alternate model selection.",
  "tests/unit/class-router.test.ts": "Added fail-closed boundary coverage for invalid off-domain router thresholds.",
  "tests/unit/frontend.test.ts": "Defined one-input and no-visible-mode shell, manual prompt paste, shared general and clinical result ownership, structured review, keyboard accessibility, cancellation behavior, evidence provenance, readiness, and mobile touch-target regressions.",
  "tests/unit/perf-csv.test.ts": "Added regression coverage for the canonical header-only empty telemetry dataset while preserving append and RFC-4180 escaping behavior.",
  "tests/unit/perf-logger.test.ts": "Added bounded-tail telemetry and corrupt-row diagnostic coverage without exposing raw row content.",
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
  destinationStatus?: "present" | "removed";
  destinationSha256?: string;
  modification?: { status: "pending-adaptation" | "modified" | "removed"; reason: string };
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
    if (!existsSync(entry.destinationPath)) {
      if (entry.classification !== "modified-for-adtc") throw new Error(`Reused destination is missing: ${entry.destinationPath}`);
      const reason = MODIFICATION_REASONS[entry.destinationPath];
      if (!reason) throw new Error(`Missing removal reason: ${entry.destinationPath}`);
      return { ...entry, destinationStatus: "removed" as const, modification: { status: "removed" as const, reason } };
    }
    const destinationSha256 = createHash("sha256").update(readFileSync(entry.destinationPath)).digest("hex");
    if (entry.classification === "reused") {
      if (destinationSha256 !== entry.sourceSha256) throw new Error(`Reused destination differs from source: ${entry.destinationPath}`);
      return { ...entry, destinationStatus: "present" as const, destinationSha256 };
    }
    const reason = MODIFICATION_REASONS[entry.destinationPath];
    if (!reason) throw new Error(`Missing modification reason: ${entry.destinationPath}`);
    const status = destinationSha256 === entry.sourceSha256 ? "pending-adaptation" as const : "modified" as const;
    return { ...entry, destinationStatus: "present" as const, destinationSha256, modification: { status, reason } };
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
      { path: "config/import-manifest.json", classification: "adtc-new", purpose: "Completed current import ledger" },
      { path: "config/canonical-protocols.json", classification: "adtc-new", purpose: "Pinned WHO PDF origins, byte counts, and hashes" },
      { path: "config/model-license-decision.json", classification: "adtc-new", purpose: "Disclosed-risk model license record" },
      { path: "scripts/build-import-manifest.ts", classification: "adtc-new", purpose: "Git-object manifest builder" },
      { path: "scripts/setup-local.sh", classification: "adtc-new", purpose: "Supported clean-machine dependency, corpus, store, and readiness setup" },
      { path: "scripts/verify-import-manifest.ts", classification: "adtc-new", purpose: "Pinned-object verifier" },
      { path: "download_protocols.sh", classification: "adtc-new", purpose: "Fail-closed checksum-locked WHO protocol downloader" },
      { path: "src/logging.ts", classification: "adtc-new", purpose: "Bounded secret-safe operational diagnostic codes and counters" },
      { path: "tests/import-provenance.test.ts", classification: "adtc-new", purpose: "Provenance regression contract" },
      { path: "tests/protocol-downloader.test.ts", classification: "adtc-new", purpose: "WHO downloader idempotence and fail-closed regression contract" },
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
