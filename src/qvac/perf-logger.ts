// File: src/qvac/perf-logger.ts
// The auditable perf log is local product telemetry, not official profiler or score evidence. One row is
// appended to perf-log.csv and perf-log.jsonl for every locally observed inference event.
import { appendFileSync, closeSync, existsSync, fstatSync, openSync, readFileSync, readSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { recordDiagnostic } from "../logging.js";

export type PerfEvent =
  | "load"
  | "unload"
  | "completion"
  | "transcribe"
  | "embed"
  | "search"
  | "tts"
  | "translate";

export interface PerfLogRow {
  ts: string; // ISO8601
  phase: string; // e.g. "transcribe" | "triage" | "tts" | "ingest" | "spike"
  event: PerfEvent;
  modelId: string;
  promptTokens?: number; // approx prompt token count (chars/4) when known
  ttftMs?: number; // timeToFirstToken from final.stats
  tokensPerSec?: number; // tokensPerSecond from final.stats
  totalTokens?: number; // totalTokens from final.stats
  backendDevice?: string; // e.g. "gpu"
  durationMs: number; // wall-clock via performance.now()
}

// Paths are resolved lazily against TRIAGE0_PERF_DIR (defaults to cwd) so tests can redirect
// output to a temp dir without polluting the repo. The app always runs from triage-0/.
const perfDir = () => process.env.TRIAGE0_PERF_DIR ?? process.cwd();
const csvPath = () => resolve(perfDir(), "perf-log.csv");
const jsonlPath = () => resolve(perfDir(), "perf-log.jsonl");
const jsonPath = () => resolve(perfDir(), "perf-log.json");
export const PERF_CSV_HEADER =
  "ts,phase,event,modelId,promptTokens,ttftMs,tokensPerSec,totalTokens,backendDevice,durationMs\n";

function csvCell(v: unknown): string {
  if (v === undefined || v === null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function rowToCsv(r: PerfLogRow): string {
  return [
    r.ts, r.phase, r.event, r.modelId, r.promptTokens, r.ttftMs,
    r.tokensPerSec, r.totalTokens, r.backendDevice, r.durationMs,
  ].map(csvCell).join(",") + "\n";
}

/**
 * Append one row to perf-log.csv AND perf-log.jsonl. Called on EVERY event.
 * Both are append-only single-line writes (atomic on local FS for small payloads), so the two
 * artifacts stay consistent even under concurrent/interleaved calls — unlike the previous
 * whole-array JSON rewrite, which was O(n²) and dropped rows when calls interleaved.
 */
export function logPerf(row: PerfLogRow): void {
  try {
    const csv = csvPath();
    if (!existsSync(csv)) writeFileSync(csv, PERF_CSV_HEADER, "utf8");
    appendFileSync(csv, rowToCsv(row), "utf8");
    appendFileSync(jsonlPath(), JSON.stringify(row) + "\n", "utf8");
  } catch (error) {
    // Disk error (ENOSPC, EACCES, etc.) — degrade gracefully.
    // A full disk must not crash an in-progress clinical triage, but it remains observable.
    recordDiagnostic("PERF_WRITE_FAILED", error);
  }
}

function boundedTail(path: string, maximumBytes = 1_048_576): string {
  const handle = openSync(path, "r");
  try {
    const size = fstatSync(handle).size;
    const length = Math.min(size, maximumBytes);
    const buffer = Buffer.alloc(length);
    readSync(handle, buffer, 0, length, size - length);
    const text = buffer.toString("utf8");
    return length < size ? text.slice(Math.max(0, text.indexOf("\n") + 1)) : text;
  } finally {
    closeSync(handle);
  }
}

export function readPerfRows(limit?: number): PerfLogRow[] {
  const jsonl = jsonlPath();
  if (!existsSync(jsonl)) return [];
  const text = limit === undefined ? readFileSync(jsonl, "utf8") : boundedTail(jsonl);
  const rows = text
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as PerfLogRow;
      } catch (error) {
        recordDiagnostic("PERF_ROW_MALFORMED", error);
        return null;
      }
    })
    .filter((r): r is PerfLogRow => r !== null);
  return limit === undefined ? rows : rows.slice(-Math.max(0, limit));
}

export function readPerfCsv(limit?: number): string {
  const path = csvPath();
  if (!existsSync(path)) return PERF_CSV_HEADER;
  if (limit === undefined) return readFileSync(path, "utf8");
  const lines = boundedTail(path).split("\n").filter(Boolean).filter((line) => !line.startsWith("ts,phase,event,"));
  return PERF_CSV_HEADER + lines.slice(-Math.max(0, limit)).join("\n") + (lines.length ? "\n" : "");
}

/**
 * Render perf-log.json (a pretty array) from the JSONL spine for local diagnostic snapshots.
 * Call once at clean shutdown or snapshot time, not per event.
 */
export function snapshotPerfJson(): string {
  const p = jsonPath();
  writeFileSync(p, JSON.stringify(readPerfRows(), null, 2), "utf8");
  return p;
}

export function perfCsvPath(): string {
  return csvPath();
}

export function perfJsonlPath(): string {
  return jsonlPath();
}
