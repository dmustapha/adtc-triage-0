import { createHash, createPrivateKey, sign } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { requiredGates, validateFinalistComparison, validateGateRecord } from "../src/release-evidence.js";

const [candidateId, bundlePath, signer] = process.argv.slice(2);
if (!candidateId || !bundlePath || !signer) throw new Error("usage: npm run finalist-gate -- <candidate-id> <bundle.json> <signer>");
const finalists = JSON.parse(await readFile("config/model-finalists.json", "utf8"));
const model = finalists[candidateId];
if (!model) throw new Error(`unknown finalist: ${candidateId}`);
const bundleBytes = await readFile(bundlePath);
const bundle = JSON.parse(bundleBytes.toString("utf8")) as any;
if (bundle.candidateId !== candidateId || JSON.stringify(bundle.model) !== JSON.stringify(model)) throw new Error("bundle/model identity mismatch");
if (Object.keys(bundle.gateArtifacts ?? {}).sort().join() !== [...requiredGates].sort().join()) throw new Error("finalist bundle gate set invalid");
const gates: Record<string, boolean> = {};
for (const gate of requiredGates) {
  const ref = bundle.gateArtifacts[gate]; const prior = JSON.parse(await readFile(ref.path, "utf8"));
  execFileSync(prior.command[0], prior.command.slice(1), { stdio: "inherit" }); const bytes = await readFile(ref.path);
  if (createHash("sha256").update(bytes).digest("hex") !== ref.sha256) throw new Error(`gate evidence drift: ${gate}`);
  const record = JSON.parse(bytes.toString("utf8"));
  validateGateRecord(record, gate, model);
  gates[gate] = true;
}
const priorComparison = JSON.parse(await readFile(bundle.comparison.path, "utf8"));
execFileSync(priorComparison.command[0], priorComparison.command.slice(1), { stdio: "inherit" });
const comparisonBytes = await readFile(bundle.comparison.path);
if (createHash("sha256").update(comparisonBytes).digest("hex") !== bundle.comparison.sha256) throw new Error("finalist comparison drift");
validateFinalistComparison(JSON.parse(comparisonBytes.toString("utf8")), candidateId);
for (const field of ["chatTemplateSha256", "generationPolicySha256"] as const) {
  if (typeof bundle[field] !== "string" || !/^[a-f0-9]{64}$/.test(bundle[field] as string)) throw new Error(`invalid ${field}`);
}
const decision = { schemaVersion: 1, status: "pass", candidateId,
  model,
  chatTemplateSha256: bundle.chatTemplateSha256, generationPolicySha256: bundle.generationPolicySha256,
  evidenceBundleSha256: createHash("sha256").update(bundleBytes).digest("hex"), gates,
  signer, signedAt: new Date().toISOString() };
const bytes = Buffer.from(JSON.stringify(decision, null, 2) + "\n");
const key = createPrivateKey(await readFile(".release-private-key.pem"));
await writeFile("evidence/model-decision.json", bytes);
await writeFile("evidence/model-decision.sig", sign(null, bytes, key).toString("base64") + "\n");
console.log(`signed PASS decision for ${candidateId} by ${signer}`);
