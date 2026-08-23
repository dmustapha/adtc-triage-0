import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { arch, hostname, platform, release, totalmem } from "node:os";
import { dirname } from "node:path";

const outputPath = process.argv[2] ?? "evidence/finalists/producer-manifest.json";
const replacementId = process.argv[3];
const paths = {
  corpus: "config/finalist-corpus.json",
  rubric: "config/finalist-rubric.json",
  finalists: "config/model-finalists.json",
  generationPolicy: "config/generation-policy.json",
  rawProducer: "scripts/run-raw-finalist.ts"
} as const;
const bytes = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await readFile(path)]))) as Record<keyof typeof paths, Buffer>;
const corpus = JSON.parse(bytes.corpus.toString("utf8"));
const rubric = JSON.parse(bytes.rubric.toString("utf8"));
const finalists = JSON.parse(bytes.finalists.toString("utf8"));
const pediatricIds = corpus.splits?.pediatricHoldout?.map((item: { id: string }) => item.id) ?? [];
const generalIds = corpus.splits?.generalMedicalHoldout?.map((item: { id: string }) => item.id) ?? [];
if (pediatricIds.length !== 50 || generalIds.length !== 50 || new Set([...pediatricIds, ...generalIds]).size !== 100) throw new Error("finalist corpus must contain 50 unique cases per frozen split");
if (rubric.generatedTokenLimit !== 128 || rubric.temperature !== 0) throw new Error("rubric must preserve evaluator-equivalent generation settings");
const lineage = {
  "medpsy-1.7b-q4": { revision: "59335b96dd541b0061d748d7a6e9536e92274985", sha256: "437a67d37127fe87f310e04bb8a1258c917b92c3682c73c09da3dd4a59fd3c7e" },
  "medpsy-4b-q4": { revision: "77aec3ab8c6eae92e18951e0a86c68c84a067d28", sha256: "cba279f9b8a226acd540bd9f14212adbdaa6578b32a34eae52aaa3cfa3ae0239" }
} as const;
const selectedIds = replacementId ? [replacementId] : Object.keys(finalists).filter(id => id.startsWith("medpsy-"));
if (replacementId && !finalists[replacementId]) throw new Error(`unknown replacement finalist: ${replacementId}`);
const candidates = Object.fromEntries(selectedIds.map(candidateId => {
  if (candidateId === "olmo-2-0425-1b-instruct-q4-k-m") return [candidateId, {
    modelPath: `model/${candidateId}.gguf`,
    rawResponsePath: `evidence/finalists/replacement/raw/${candidateId}-responses.jsonl`,
    chatTemplatePath: `evidence/finalists/replacement/${candidateId}-template.json`,
    lineageSource: { url: "https://huggingface.co/allenai/OLMo-2-0425-1B-Instruct/raw/48d788eca847d4d7548f375ad03d3c9312f6139e/README.md", sha256: "5f5b891d66a46079920172f8d5957ec386825f76cfc14ae2e79c7208d4dca4d8", snapshotPath: `evidence/finalists/replacement/sources/${candidateId}-instruct.md` },
    lineageProducer: ["node", "--import", "tsx", "scripts/run-lineage-gate.ts", candidateId, "https://huggingface.co/allenai/OLMo-2-0425-1B-Instruct/raw/48d788eca847d4d7548f375ad03d3c9312f6139e/README.md", "5f5b891d66a46079920172f8d5957ec386825f76cfc14ae2e79c7208d4dca4d8", `evidence/finalists/replacement/sources/${candidateId}-instruct.md`, `evidence/finalists/replacement/${candidateId}-training-lineage.json`],
    templateProducer: ["node", "--import", "tsx", "scripts/extract-gguf-chat-template.ts", candidateId, `model/${candidateId}.gguf`, `evidence/finalists/replacement/${candidateId}-template.json`],
    rawProducer: ["node", "--import", "tsx", "scripts/run-raw-finalist.ts", candidateId, `evidence/finalists/replacement/${candidateId}-training-lineage.json`, `evidence/finalists/replacement/raw/${candidateId}-responses.jsonl`]
  }];
  const short = candidateId === "medpsy-1.7b-q4" ? "1.7b" : "4b";
  const source = lineage[candidateId as keyof typeof lineage];
  const sourceUrl = `https://huggingface.co/qvac/MedPsy-${short === "1.7b" ? "1.7B" : "4B"}/raw/${source.revision}/README.md`;
  const snapshotPath = `evidence/finalists/sources/${short}-model-card.md`;
  const lineagePath = `evidence/finalists/${short}-training-lineage.json`;
  const rawResponsePath = `evidence/finalists/raw/${short}-responses.jsonl`;
  return [candidateId, {
    modelPath: `model/${candidateId}.gguf`, rawResponsePath,
    chatTemplatePath: `evidence/finalists/${short}-template.json`,
    lineageSource: { url: sourceUrl, sha256: source.sha256, snapshotPath },
    lineageProducer: ["node", "--import", "tsx", "scripts/run-lineage-gate.ts", candidateId, sourceUrl, source.sha256, snapshotPath, lineagePath],
    templateProducer: ["node", "--import", "tsx", "scripts/extract-gguf-chat-template.ts", candidateId, `model/${candidateId}.gguf`, `evidence/finalists/${short}-template.json`],
    rawProducer: ["node", "--import", "tsx", "scripts/run-raw-finalist.ts", candidateId, lineagePath, rawResponsePath]
  }];
}));
const digest = (value: Buffer) => createHash("sha256").update(value).digest("hex");
const manifest = {
  schemaVersion: 1, freezeRule: "inputs and producers frozen before any candidate response is observed",
  status: "frozen-prerequisites-pending",
  host: { label: `${platform()}-${arch()}-${release()}`, hostname: hostname(), ramBytes: totalmem(), tier: "development" },
  corpus: { path: paths.corpus, splits: { pediatricHoldout: pediatricIds.length, generalMedicalHoldout: generalIds.length } },
  rubric: { path: paths.rubric, generatedTokenLimit: rubric.generatedTokenLimit, temperature: rubric.temperature },
  inputHashes: Object.fromEntries(Object.entries(bytes).map(([key, value]) => [key, digest(value)])), candidates
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(manifest, null, 2) + "\n", { flag: "wx" });
console.log(`froze finalist inputs and producers: ${outputPath}`);
