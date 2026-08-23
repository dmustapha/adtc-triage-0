import { createHash, createPrivateKey, sign } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import type { SourceRecord } from "../src/types.js";

function contentHash(record: SourceRecord): string {
  return createHash("sha256").update(JSON.stringify({ locator: record.locator, facts: record.facts, limitations: record.limitations })).digest("hex");
}
function attestation(record: SourceRecord): Buffer {
  const { attestationSignature: _signature, ...value } = record;
  return Buffer.from(JSON.stringify(value));
}
const [id, rightsReviewer, clinicalReviewer, rightsFlag, clinicalFlag] = process.argv.slice(2);
if (!id || !rightsReviewer || !clinicalReviewer || rightsFlag !== "--rights-approved" || clinicalFlag !== "--clinical-reviewed") {
  throw new Error("usage: npm run attest-source -- <id> <rights-reviewer> <clinical-reviewer> --rights-approved --clinical-reviewed");
}
const path = "config/clinical-sources.json";
const records = JSON.parse(await readFile(path, "utf8")) as SourceRecord[];
const record = records.find(item => item.id === id);
if (!record) throw new Error(`unknown source: ${id}`);
const response = await fetch(record.url, { redirect: "follow" });
if (!response.ok) throw new Error(`source returned ${response.status}`);
const bytes = Buffer.from(await response.arrayBuffer());
record.bytes = bytes.length;
record.sha256 = createHash("sha256").update(bytes).digest("hex");
record.derivedContentSha256 = contentHash(record);
record.rightsStatus = "approved";
record.reviewStatus = "reviewed";
record.rightsReviewedBy = rightsReviewer;
record.clinicallyReviewedBy = clinicalReviewer;
record.attestedAt = new Date().toISOString();
const key = createPrivateKey(await readFile(".release-private-key.pem"));
record.attestationSignature = sign(null, attestation(record), key).toString("base64");
await writeFile(`${path}.tmp`, JSON.stringify(records, null, 2) + "\n");
await rename(`${path}.tmp`, path);
console.log(`attested source ${id}: ${record.bytes} bytes ${record.sha256}`);
