import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { open, readFile, stat, writeFile } from "node:fs/promises";

const [candidateId, modelPath, outputPath = "evidence/chat-template.json"] = process.argv.slice(2);
if (!candidateId || !modelPath) throw new Error("usage: tsx scripts/extract-gguf-chat-template.ts <candidate-id> <model.gguf> [output.json]");
const model = JSON.parse(await readFile("config/model-finalists.json", "utf8"))[candidateId];
const allowedPaths = [model?.outputPath, `model/${candidateId}.gguf`];
if (!model || !allowedPaths.includes(modelPath)) throw new Error("candidate/path mismatch");
const file = await open(modelPath, "r"); let offset = 0;
async function take(size: number): Promise<Buffer> { const value = Buffer.alloc(size); const { bytesRead } = await file.read(value, 0, size, offset); if (bytesRead !== size) throw new Error("truncated GGUF metadata"); offset += size; return value; }
const u32 = async () => (await take(4)).readUInt32LE();
const u64 = async () => Number((await take(8)).readBigUInt64LE());
const string = async () => (await take(await u64())).toString("utf8");
async function skip(type: number): Promise<void> {
  const fixed: Record<number, number> = { 0:1, 1:1, 2:2, 3:2, 4:4, 5:4, 6:4, 7:1, 10:8, 11:8, 12:8 };
  if (type === 8) { await take(await u64()); return; }
  if (type === 9) { const inner = await u32(); const count = await u64(); for (let i = 0; i < count; i++) await skip(inner); return; }
  if (!fixed[type]) throw new Error(`unsupported GGUF metadata type ${type}`); await take(fixed[type]);
}
if ((await take(4)).toString("ascii") !== "GGUF") throw new Error("not a GGUF file");
const version = await u32(); if (version < 2 || version > 3) throw new Error(`unsupported GGUF version ${version}`);
await u64(); const entries = await u64(); let template: string | undefined;
for (let i = 0; i < entries; i++) { const key = await string(); const type = await u32(); if (key === "tokenizer.chat_template") { if (type !== 8) throw new Error("chat template is not a string"); template = await string(); } else await skip(type); }
await file.close(); if (!template) throw new Error("GGUF tokenizer.chat_template missing");
const bytes = Buffer.from(template, "utf8");
const modelHash = createHash("sha256"); for await (const chunk of createReadStream(modelPath)) modelHash.update(chunk);
const modelBytes = (await stat(modelPath)).size; const modelSha256 = modelHash.digest("hex");
if (modelBytes !== model.bytes || modelSha256 !== model.sha256) throw new Error("GGUF bytes do not match selected finalist");
await writeFile(outputPath, JSON.stringify({ candidateId, modelPath, modelBytes, modelSha256, key: "tokenizer.chat_template",
  templateBytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }, null, 2) + "\n");
