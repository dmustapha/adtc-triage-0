import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { requiredGates, validateFinalistComparison, validateGateRecord, validateTemplateEvidence, type GateRecord } from "../src/release-evidence.js";
import type { ModelCandidate } from "../src/types.js";

const [candidateId, indexPath, outputPath = "evidence/finalist-bundle.json"] = process.argv.slice(2);
if (!candidateId || !indexPath) throw new Error("usage: tsx scripts/build-finalist-bundle.ts <candidate-id> <index.json> [bundle.json]");
const finalists = JSON.parse(await readFile("config/model-finalists.json", "utf8"));
const model = finalists[candidateId] as ModelCandidate | undefined; if (!model) throw new Error("unknown finalist");
const descriptor = JSON.parse(await readFile(indexPath, "utf8")) as { gates: Record<string, { path: string; producer: string[] }>; comparison: { path: string; producer: string[] } };
const index = descriptor.gates; if (Object.keys(index).sort().join() !== [...requiredGates].sort().join()) throw new Error("evidence index gate set invalid");
const seen = new Set<string>(); const gateArtifacts: Record<string, unknown> = {};
for (const gate of requiredGates) {
  const item = index[gate]; if (!item?.path || !item.producer.length) throw new Error(`producer missing: ${gate}`);
  execFileSync(item.producer[0]!, item.producer.slice(1), { stdio: "inherit" }); const path = item.path;
  if (!path.startsWith("evidence/") || seen.has(path)) throw new Error(`invalid or duplicate gate path: ${gate}`); seen.add(path);
  const bytes = await readFile(path); const record = JSON.parse(bytes.toString("utf8"));
  if (JSON.stringify(record.command) !== JSON.stringify(item.producer)) throw new Error(`gate record command differs from executed producer: ${gate}`);
  validateGateRecord(record as GateRecord, gate, model);
  gateArtifacts[gate] = { path, sha256: createHash("sha256").update(bytes).digest("hex") };
}
execFileSync(descriptor.comparison.producer[0]!, descriptor.comparison.producer.slice(1), { stdio: "inherit" });
const comparisonBytes = await readFile(descriptor.comparison.path); const comparison = JSON.parse(comparisonBytes.toString("utf8"));
if (JSON.stringify(comparison.command) !== JSON.stringify(descriptor.comparison.producer)) throw new Error("comparison record command differs from executed producer");
validateFinalistComparison(comparison, candidateId);
const template = JSON.parse(await readFile("evidence/chat-template.json", "utf8"));
validateTemplateEvidence(template, model);
const generationPolicySha256 = createHash("sha256").update(await readFile("config/generation-policy.json")).digest("hex");
await writeFile(outputPath, JSON.stringify({ schemaVersion: 1, candidateId, model, chatTemplateSha256: template.sha256, generationPolicySha256, gateArtifacts,
  comparison: { path: descriptor.comparison.path, sha256: createHash("sha256").update(comparisonBytes).digest("hex") } }, null, 2) + "\n", { flag: "wx" });
