import { createHash } from "node:crypto";
import { closeSync, existsSync, openSync, readFileSync, readSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const DEFAULT_ROOT = fileURLToPath(new URL("..", import.meta.url));

export interface ModelIdentity {
  candidateId: string;
  name: string;
  revision: string;
  url: string;
  filename: string;
  path: string;
  bytes: number;
  sha256: string;
  languageScope: string[];
  officialRuntime: string;
  productRuntime: { name: string; version: string; modelPath: string };
}

function readJson(path: string): any {
  return JSON.parse(readFileSync(path, "utf8"));
}

function hashFile(path: string): string {
  const hash = createHash("sha256");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  const fd = openSync(path, "r");
  try {
    for (;;) {
      const count = readSync(fd, buffer, 0, buffer.length, null);
      if (count === 0) break;
      hash.update(buffer.subarray(0, count));
    }
  } finally {
    closeSync(fd);
  }
  return hash.digest("hex");
}

export function readModelIdentity(root = DEFAULT_ROOT): ModelIdentity {
  const identity = readJson(resolve(root, "config/canonical-model.json")) as ModelIdentity;
  if (!/^model\/[A-Za-z0-9._-]+\.gguf$/.test(identity.path)) throw new Error("Invalid canonical model path");
  if (identity.productRuntime?.modelPath !== identity.path) throw new Error("Product runtime model path mismatch");
  if (!/^[a-f0-9]{64}$/.test(identity.sha256)) throw new Error("Invalid canonical model SHA-256");
  if (/olmo/i.test(JSON.stringify(identity))) throw new Error("OLMo cannot be the active model identity");
  return identity;
}

export function profilerModelPath(root = DEFAULT_ROOT): string {
  const metadataPath = readJson(resolve(root, "metadata.json"))?._runtime?.model_path;
  const canonicalPath = readModelIdentity(root).path;
  if (metadataPath !== canonicalPath) throw new Error("Profiler metadata model path mismatch");
  return metadataPath;
}

export function loadModelContract(root = DEFAULT_ROOT): ModelIdentity & { absolutePath: string } {
  const identity = readModelIdentity(root);
  profilerModelPath(root);
  const absolutePath = resolve(root, identity.path);
  if (!existsSync(absolutePath)) throw new Error(`Missing canonical model: ${identity.path}`);
  const actualBytes = statSync(absolutePath).size;
  if (actualBytes !== identity.bytes) throw new Error(`Canonical model size mismatch: expected ${identity.bytes}, got ${actualBytes}`);
  const actualHash = hashFile(absolutePath);
  if (actualHash !== identity.sha256) throw new Error(`Canonical model hash mismatch: expected ${identity.sha256}, got ${actualHash}`);
  return { ...identity, absolutePath };
}
