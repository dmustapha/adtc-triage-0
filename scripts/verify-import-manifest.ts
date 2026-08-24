import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import {
  DEFAULT_SOURCE_REPOSITORY_PATH,
  PINNED_COMMIT,
  PLANNED_SOURCE_PATHS,
  SOURCE_REPOSITORY,
  type ImportEntry,
  type ImportManifestDocument,
} from "./build-import-manifest.js";

const PLACEHOLDER = /pending|placeholder|todo|tbd|1970-01-01/i;

function git(repositoryPath: string, args: string[]): Buffer {
  return execFileSync("git", ["-C", repositoryPath, ...args], { stdio: ["ignore", "pipe", "pipe"] });
}

function assertRecord(value: unknown): asserts value is ImportManifestDocument {
  if (!value || typeof value !== "object") throw new Error("Manifest must be an object");
}

function verifyHeader(manifest: ImportManifestDocument): void {
  const preImport = manifest.kind === "pre-import-plan" && manifest.applicationImported === false;
  const completed = manifest.kind === "completed-import" && manifest.applicationImported === true;
  if (!preImport && !completed) throw new Error("Manifest import status is inconsistent");
  if (manifest.source?.repository !== SOURCE_REPOSITORY || manifest.source?.commit !== PINNED_COMMIT) throw new Error("Manifest source is not the approved immutable baseline");
  if (!manifest.imports?.length) throw new Error("Manifest must contain planned imports");
  if (!manifest.reviewedBy || PLACEHOLDER.test(manifest.reviewedBy)) throw new Error("Manifest contains placeholder provenance");
  if (!manifest.notices?.apache20 || !manifest.notices?.priorHackathon) throw new Error("Required license and prior-work disclosures are missing");
  if (manifest.reviews?.clinical?.completed !== false || manifest.reviews?.sourceRights?.completed !== false) throw new Error("Mandatory reviews must not be reported complete before review");
}

function sourceObject(repositoryPath: string, sourcePath: string): { object: string; bytes: Buffer } {
  if (!sourcePath || sourcePath.startsWith("/") || sourcePath.split("/").includes("..")) throw new Error(`Invalid source path: ${sourcePath}`);
  const row = git(repositoryPath, ["ls-tree", PINNED_COMMIT, "--", sourcePath]).toString().trim();
  if (!row || !row.endsWith(`\t${sourcePath}`)) throw new Error(`${sourcePath} is absent from pinned source tree`);
  const object = row.split(/\s+/)[2];
  if (!object) throw new Error(`Cannot resolve Git object for ${sourcePath}`);
  return { object, bytes: git(repositoryPath, ["show", `${PINNED_COMMIT}:${sourcePath}`]) };
}

function destinationBytes(destinationPath: string): Buffer {
  if (!destinationPath || destinationPath.startsWith("/") || destinationPath.split("/").includes("..")) {
    throw new Error(`Invalid destination path: ${destinationPath}`);
  }
  return readFileSync(destinationPath);
}

function verifyCompletedEntry(entry: ImportEntry): void {
  const sha256 = createHash("sha256").update(destinationBytes(entry.destinationPath)).digest("hex");
  if (entry.destinationSha256 !== sha256) throw new Error(`Destination SHA-256 mismatch for ${entry.destinationPath}`);
  if (entry.classification === "reused") {
    if (sha256 !== entry.sourceSha256) throw new Error(`Reused destination differs from source for ${entry.destinationPath}`);
    if (entry.modification) throw new Error(`Reused destination cannot record a modification for ${entry.destinationPath}`);
    return;
  }
  if (!entry.modification?.reason || PLACEHOLDER.test(entry.modification.reason)) throw new Error(`Missing modification reason for ${entry.destinationPath}`);
  if (!(["pending-adaptation", "modified"] as string[]).includes(entry.modification.status)) throw new Error(`Invalid modification status for ${entry.destinationPath}`);
  if (entry.modification.status === "modified" && sha256 === entry.sourceSha256) throw new Error(`Modified destination still matches source for ${entry.destinationPath}`);
  if (entry.modification.status === "pending-adaptation" && sha256 !== entry.sourceSha256) throw new Error(`Pending adaptation already differs from source for ${entry.destinationPath}`);
}

function verifyEntry(entry: ImportEntry, repositoryPath: string, completed: boolean): void {
  if (!entry.destinationPath || !entry.originalCreatedAt || PLACEHOLDER.test(entry.destinationPath)) throw new Error(`Incomplete provenance for ${entry.sourcePath}`);
  if (!(["reused", "modified-for-adtc"] as string[]).includes(entry.classification)) throw new Error(`Invalid import classification for ${entry.sourcePath}`);
  const source = sourceObject(repositoryPath, entry.sourcePath);
  const sha256 = createHash("sha256").update(source.bytes).digest("hex");
  if (entry.sourceGitObject !== source.object) throw new Error(`Git object mismatch for ${entry.sourcePath}`);
  if (entry.sourceSha256 !== sha256) throw new Error(`SHA-256 mismatch for ${entry.sourcePath}`);
  if (completed) verifyCompletedEntry(entry);
}

export function verifyImportManifest(value: unknown, repositoryPath = DEFAULT_SOURCE_REPOSITORY_PATH): void {
  assertRecord(value);
  verifyHeader(value);
  const destinations = new Set<string>();
  for (const entry of value.imports) {
    if (destinations.has(entry.destinationPath)) throw new Error(`Duplicate destination: ${entry.destinationPath}`);
    destinations.add(entry.destinationPath);
    verifyEntry(entry, repositoryPath, value.applicationImported);
  }
  const actualPaths = value.imports.map((entry) => entry.sourcePath).sort();
  const plannedPaths = [...PLANNED_SOURCE_PATHS].sort();
  if (actualPaths.length !== plannedPaths.length || actualPaths.some((path, index) => path !== plannedPaths[index])) throw new Error("Manifest planned import set mismatch");
  if (!value.adtcNewFiles?.every((entry) => entry.classification === "adtc-new")) throw new Error("Invalid ADTC-new classification");
  if (!value.thirdPartyDependencies?.every((entry) => entry.classification === "third-party")) throw new Error("Invalid third-party classification");
}

const invokedPath = process.argv[1];
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  const manifestPath = process.argv[2] ?? "config/import-manifest.json";
  const manifest: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
  verifyImportManifest(manifest);
  const typedManifest = manifest as ImportManifestDocument;
  const state = typedManifest.applicationImported ? "completed imports" : "planned imports";
  process.stdout.write(`Verified ${typedManifest.imports.length} ${state} from ${PINNED_COMMIT}\n`);
}
