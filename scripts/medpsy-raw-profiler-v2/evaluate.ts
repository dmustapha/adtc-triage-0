import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { normalizeJsonStdout } from "../medpsy-shared-runtime-v2/json-framing.js";

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) throw new Error("usage: evaluate <input.json> <output.json>");

const contract = JSON.parse(await readFile("config/medpsy-raw-profiler-v2/contract.json", "utf8"));
const inputBytes = await readFile(inputPath);
const input = JSON.parse(inputBytes.toString("utf8"));
const rows = Array.isArray(input.rows) ? input.rows : [];
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
const gate = (pass: boolean, result: Record<string, unknown>) => ({ status: pass ? "pass" : "fail", result });

function rowIntegrity(row: any): { hashes: boolean; framing: boolean } {
  const hashes = sha256(String(row.rawStdout)) === row.rawSha256 && sha256(String(row.normalizedPayload)) === row.normalizedSha256;
  try {
    const normalized = normalizeJsonStdout(String(row.rawStdout));
    return { hashes, framing: normalized.normalizedPayload === row.normalizedPayload };
  } catch {
    return { hashes, framing: false };
  }
}

const integrity = rows.map(rowIntegrity);
const artifacts = Array.isArray(input.artifacts) ? input.artifacts.map(String) : [];
const weightArtifacts = artifacts.filter((path: string) => contract.forbiddenArtifactSuffixes.some((suffix: string) => path.toLowerCase().endsWith(suffix)));
const rate = (predicate: (item: { hashes: boolean; framing: boolean }) => boolean) => integrity.length ? integrity.filter(predicate).length / integrity.length : 0;
const runtimeIdentity = input.schemaVersion === 2 && input.namespace === contract.namespace && input.evidenceTier === contract.evidenceTier &&
  /^[a-f0-9]{64}$/.test(String(input.manifestSha256 ?? "")) && same(input.candidate, contract.candidate) &&
  same(input.runtime, { name: contract.runtime.name, revision: contract.runtime.revision });
const gates = {
  runtimeIdentity: gate(runtimeIdentity, { valid: runtimeIdentity }),
  dualHashIntegrity: gate(rate((item) => item.hashes) === contract.thresholds.dualHashRequiredRate, { rows: rows.length, validRate: rate((item) => item.hashes) }),
  exactOneJson: gate(rate((item) => item.framing) === contract.thresholds.exactOneJsonRequiredRate, { rows: rows.length, validRate: rate((item) => item.framing) }),
  artifactNoWeights: gate(weightArtifacts.length <= contract.thresholds.maximumWeightArtifacts, { artifacts, violations: weightArtifacts.length }),
};
const status = Object.values(gates).every((item) => item.status === "pass") ? "pass" : "fail";
const evidence = {
  schemaVersion: 2,
  namespace: contract.namespace,
  evidenceTier: contract.evidenceTier,
  manifestSha256: input.manifestSha256 ?? null,
  status,
  inputSha256: sha256(inputBytes),
  gates,
  notEvaluated: ["dangerOwnership", "productSafety", "qvacProductBehavior"],
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx" });
console.log(`MedPsy raw/profiler: ${status}`);
if (status !== "pass") process.exitCode = 2;
