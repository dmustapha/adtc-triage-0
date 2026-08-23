import { createHash, createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import type { SourceRecord } from "../src/types.js";

const digest = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
function attestation(record: SourceRecord): Buffer {
  const { attestationSignature: _signature, ...value } = record;
  return Buffer.from(JSON.stringify(value));
}
const catalogBytes = await readFile("config/clinical-sources.json");
const records = JSON.parse(catalogBytes.toString("utf8")) as SourceRecord[];
for (const record of records) {
  if (record.rightsStatus !== "approved" || record.reviewStatus !== "reviewed" || !record.rightsReviewedBy || !record.clinicallyReviewedBy || !Number.isFinite(Date.parse(record.attestedAt))) {
    throw new Error(`source review incomplete: ${record.id}`);
  }
}
const key = createPublicKey(await readFile("config/release-public-key.pem"));
const verified = [];
for (const record of records) {
  if (!verify(null, attestation(record), key, Buffer.from(record.attestationSignature, "base64"))) throw new Error(`source attestation signature invalid: ${record.id}`);
  if (digest(JSON.stringify({ locator: record.locator, facts: record.facts, limitations: record.limitations })) !== record.derivedContentSha256) throw new Error(`derived source content changed: ${record.id}`);
  const response = await fetch(record.url, { redirect: "follow" });
  if (!response.ok) throw new Error(`source unavailable ${record.id}: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length !== record.bytes || digest(bytes) !== record.sha256) throw new Error(`source bytes changed: ${record.id}`);
  verified.push({ id: record.id, bytes: record.bytes, sha256: record.sha256,
    derivedContentSha256: record.derivedContentSha256, attestedAt: record.attestedAt });
}
await mkdir("evidence", { recursive: true });
const proof = { status: "pass", verifiedAt: new Date().toISOString(),
  catalogSha256: digest(catalogBytes), sources: verified };
const proofBytes = Buffer.from(JSON.stringify(proof, null, 2) + "\n");
const privateKey = createPrivateKey(await readFile(".release-private-key.pem"));
await writeFile("evidence/source-verification.json.tmp", proofBytes);
await writeFile("evidence/source-verification.sig.tmp", sign(null, proofBytes, privateKey).toString("base64") + "\n");
await rename("evidence/source-verification.json.tmp", "evidence/source-verification.json");
await rename("evidence/source-verification.sig.tmp", "evidence/source-verification.sig");
console.log(`verified ${verified.length} source records and source bytes`);
