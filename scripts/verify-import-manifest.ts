import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import {
  DEFAULT_SOURCE_REPOSITORY_PATH,
  PINNED_COMMIT,
  PLANNED_SOURCE_PATHS,
  SOURCE_REPOSITORY,
  type ImportManifest,
} from "./build-import-manifest.js";

const PLACEHOLDER = /pending|placeholder|todo|tbd|1970-01-01/i;

function git(repositoryPath: string, args: string[]): Buffer {
  return execFileSync("git", ["-C", repositoryPath, ...args], { stdio: ["ignore", "pipe", "pipe"] });
}

function assertRecord(value: unknown): asserts value is ImportManifest {
  if (!value || typeof value !== "object") throw new Error("Manifest must be an object");
}

function verifyHeader(manifest: ImportManifest): void {
  if (manifest.kind !== "pre-import-plan" || manifest.applicationImported !== false) throw new Error("Manifest must remain a pre-import plan");
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

function verifyEntry(entry: ImportManifest["imports"][number], repositoryPath: string): void {
  if (!entry.destinationPath || !entry.originalCreatedAt || PLACEHOLDER.test(entry.destinationPath)) throw new Error(`Incomplete provenance for ${entry.sourcePath}`);
  if (!(["reused", "modified-for-adtc"] as string[]).includes(entry.classification)) throw new Error(`Invalid import classification for ${entry.sourcePath}`);
  const source = sourceObject(repositoryPath, entry.sourcePath);
  const sha256 = createHash("sha256").update(source.bytes).digest("hex");
  if (entry.sourceGitObject !== source.object) throw new Error(`Git object mismatch for ${entry.sourcePath}`);
  if (entry.sourceSha256 !== sha256) throw new Error(`SHA-256 mismatch for ${entry.sourcePath}`);
}

export function verifyImportManifest(value: unknown, repositoryPath = DEFAULT_SOURCE_REPOSITORY_PATH): void {
  assertRecord(value);
  verifyHeader(value);
  const destinations = new Set<string>();
  for (const entry of value.imports) {
    if (destinations.has(entry.destinationPath)) throw new Error(`Duplicate destination: ${entry.destinationPath}`);
    destinations.add(entry.destinationPath);
    verifyEntry(entry, repositoryPath);
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
  process.stdout.write(`Verified ${(manifest as ImportManifest).imports.length} planned imports from ${PINNED_COMMIT}\n`);
}
