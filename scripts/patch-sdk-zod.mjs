#!/usr/bin/env node
// Postinstall compatibility gate. QVAC SDK 0.13.3 declares Zod 4 and this project pins Zod 4,
// so no vendor mutation is permitted. Fail closed if either identity or schema shape drifts.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, "node_modules", "@qvac", "sdk", "dist", "schemas", "download-asset.js");
const sdkPackage = join(root, "node_modules", "@qvac", "sdk", "package.json");
const zodPackage = join(root, "node_modules", "zod", "package.json");

try {
  const sdk = JSON.parse(readFileSync(sdkPackage, "utf8"));
  const zod = JSON.parse(readFileSync(zodPackage, "utf8"));
  const content = readFileSync(target, "utf8");
  if (sdk.version !== "0.13.3") throw new Error(`unexpected @qvac/sdk version ${sdk.version}`);
  if (!String(zod.version).startsWith("4.")) throw new Error(`QVAC requires Zod 4, found ${zod.version}`);
  if (!/\bz\.(?:url\(\)|string\(\)\.url\(\))/.test(content)) throw new Error("unexpected QVAC download URL schema");
  process.stdout.write("[triage-0] verified @qvac/sdk 0.13.3 + Zod 4 compatibility; vendor files unchanged\n");
} catch (err) {
  process.stderr.write("[triage-0] QVAC/Zod compatibility check failed; inspect pinned package identities.\n");
  process.exitCode = 1;
}
