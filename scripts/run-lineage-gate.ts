import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { arch, hostname, platform, totalmem } from "node:os";
import { dirname } from "node:path";

const [candidateId, sourceUrl, expectedHash, snapshotPath, outputPath] = process.argv.slice(2);
if (!candidateId || !sourceUrl || !expectedHash || !snapshotPath || !outputPath) throw new Error("usage: run-lineage-gate <candidate> <source-url> <sha256> <snapshot> <output>");
const finalists = JSON.parse(await readFile("config/model-finalists.json", "utf8"));
const model = finalists[candidateId];
if (!model) throw new Error(`unknown finalist: ${candidateId}`);
const response = await fetch(sourceUrl, { redirect: "follow" });
if (!response.ok) throw new Error(`lineage source returned ${response.status}`);
const sourceBytes = Buffer.from(await response.arrayBuffer());
const actualHash = createHash("sha256").update(sourceBytes).digest("hex");
if (actualHash !== expectedHash) throw new Error(`lineage source hash mismatch: ${candidateId}`);
const sourceText = sourceBytes.toString("utf8");
const replacementSources = JSON.parse(await readFile("config/replacement-lineage-sources.json", "utf8"))[candidateId];
if (replacementSources) {
  const verified: { id: string; url: string; sha256: string }[] = [];
  for (const item of replacementSources.sources) {
    const itemResponse = item.url === sourceUrl ? response : await fetch(item.url, { redirect: "follow" });
    if (!itemResponse.ok) throw new Error(`lineage source returned ${itemResponse.status}: ${item.id}`);
    const itemBytes = item.url === sourceUrl ? sourceBytes : Buffer.from(await itemResponse.arrayBuffer());
    const itemHash = createHash("sha256").update(itemBytes).digest("hex");
    if (itemHash !== item.sha256) throw new Error(`lineage source hash mismatch: ${item.id}`);
    verified.push({ id: item.id, url: item.url, sha256: itemHash });
  }
  await mkdir(dirname(snapshotPath), { recursive: true });
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(snapshotPath, sourceBytes, { flag: "wx" });
  const command = ["node", "--import", "tsx", "scripts/run-lineage-gate.ts", candidateId, sourceUrl, expectedHash, snapshotPath, outputPath];
  const evidence = { schemaVersion: 1, gate: "trainingLineage", status: "pass", model, command,
    inputs: Object.fromEntries(verified.map(item => [item.id, item.sha256])),
    host: { tier: "development", bootId: hostname(), cpu: `${platform()}-${arch()}`, ramBytes: totalmem() },
    result: { reviewed: true, sourceUrl, sourcesVerified: verified.length, modelLicense: replacementSources.modelLicense,
      rightsConclusion: replacementSources.rightsConclusion, caveat: "Preference mixture includes non-commercial subsets and third-party terms; exact upstream terms are preserved." } };
  await writeFile(outputPath, JSON.stringify(evidence, null, 2) + "\n", { flag: "wx" });
  console.log(`PASS ${candidateId}: verified ${verified.length} immutable primary lineage sources`);
  process.exit(0);
}
const disclosuresPresent = sourceText.includes("new health domain not yet publicly released") && sourceText.includes("open-source medical QA prompts");
if (!disclosuresPresent) throw new Error(`expected lineage disclosures absent: ${candidateId}`);
await mkdir(dirname(snapshotPath), { recursive: true });
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(snapshotPath, sourceBytes, { flag: "wx" });
const command = ["node", "--import", "tsx", "scripts/run-lineage-gate.ts", candidateId, sourceUrl, expectedHash, snapshotPath, outputPath];
const reason = "Training disclosure includes a new health domain not yet publicly released and unspecified open-source medical QA prompts, with no itemized dataset/right/license ledger; redistribution and medical-submission suitability are not established.";
const evidence = { schemaVersion: 1, gate: "trainingLineage", status: "fail", model, command,
  inputs: { sourceCardSha256: actualHash }, host: { tier: "development", bootId: hostname(), cpu: `${platform()}-${arch()}`, ramBytes: totalmem() },
  result: { reviewed: false, sourceUrl, sourceCardSha256: actualHash, reason } };
await writeFile(outputPath, JSON.stringify(evidence, null, 2) + "\n", { flag: "wx" });
console.error(`REJECT ${candidateId}: ${reason}`);
process.exitCode = 2;
