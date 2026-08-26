import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const MODEL_PATH = "model/medpsy-1.7b-q4_k_m-imat.gguf";
const MODEL_BYTES = 1_282_439_360;
const MODEL_SHA256 = "41ee947d9cce72ec657577219fd1798fabeabf0d832217fe23c9d6d3d18d5880";
const CITATION_PATH = "data/rag/citation-map.json";
const STORE_PATH = join(homedir(), ".qvac", "rag-hyperdb", "triage0-who-protocols");

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function requireCondition(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

requireCondition(existsSync(MODEL_PATH), `Missing ${MODEL_PATH}; run bash download_model.sh.`);
requireCondition(statSync(MODEL_PATH).size === MODEL_BYTES, `Wrong GGUF byte count at ${MODEL_PATH}.`);
requireCondition(sha256(MODEL_PATH) === MODEL_SHA256, `Wrong GGUF SHA-256 at ${MODEL_PATH}.`);
const citations = JSON.parse(readFileSync(CITATION_PATH, "utf8")) as Record<string, unknown>;
requireCondition(citations && typeof citations === "object" && Object.keys(citations).length === 994, `Expected 994 citation entries in ${CITATION_PATH}.`);
requireCondition(existsSync(STORE_PATH), `Missing native WHO store at ${STORE_PATH}; run npm run ingest with the server stopped.`);
process.stdout.write("Local doctor passed: exact GGUF, 994-entry citation map, and native WHO store are present.\n");
