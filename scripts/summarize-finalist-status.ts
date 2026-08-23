import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const [manifestPath, onePath, fourPath, outputPath] = process.argv.slice(2);
if (!manifestPath || !onePath || !fourPath || !outputPath) throw new Error("usage: summarize-finalist-status <manifest> <1.7b-lineage> <4b-lineage> <output>");
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const manifestBytes = await readFile(manifestPath);
const rows = await Promise.all([["medpsy-1.7b-q4", onePath], ["medpsy-4b-q4", fourPath]].map(async ([candidateId, path]) => {
  const bytes = await readFile(path!); const evidence = JSON.parse(bytes.toString("utf8"));
  if (evidence.status !== "fail" || evidence.gate !== "trainingLineage") throw new Error(`candidate does not have a failed lineage prerequisite: ${candidateId}`);
  return [candidateId, { prerequisite: "trainingLineage", status: "rejected", evidencePath: path,
    evidenceSha256: digest(bytes), reason: evidence.result.reason, rawInference: "not-run-after-prerequisite-failure" }];
}));
const status = { schemaVersion: 1, status: "blocked", selectedCandidateId: null,
  producerManifest: { path: manifestPath, sha256: digest(manifestBytes) }, candidates: Object.fromEntries(rows) };
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(status, null, 2) + "\n", { flag: "wx" });
console.log(`recorded blocked finalist status: ${outputPath}`);
