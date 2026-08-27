// File: tests/integration/http-validation.test.ts
// MODEL-FREE HTTP-contract gate: the "never crashes on bad input" defence. Boots the Express app on an
// ephemeral port and asserts every validation short-circuit (400/413) BEFORE any inference can run — so
// no model is loaded and the single-writer RAG store is never touched. Each rejection path returns a
// FRIENDLY, fixed message (no raw paths), and the server stays up after a malformed-JSON request.
//
// Why no model is needed: every assertion here hits a guard that returns before withInferenceLock()
// (empty/oversized body, malformed JSON, no file, oversized upload). The one request that reaches a
// handler — GET /health — only calls chunkCount()/citationMapHealthy(), which read the sidecar, never a
// model. The excluded audio routes are asserted absent, and no inference is triggered.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const perfDir = mkdtempSync(join(tmpdir(), "triage0-http-perf-"));
process.env.TRIAGE0_PERF_DIR = perfDir;

// Import the app WITHOUT pre-warm: app.listen(0) below does not pre-warm (only startServer on a real
// port does), so importing `app` directly keeps this suite model-free.
const { app } = await import("../../src/server.js");
const { setTriageExecutionObserver } = await import("../../src/triage/triage.js");

let server: { address(): { port: number } | string | null; close(): void };
let base = "";

before(async () => {
  await new Promise<void>((ready) => {
    server = app.listen(0, () => ready()) as never;
  });
  const addr = (server as { address(): { port: number } }).address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
});
after(() => {
  if (server) server.close();
  rmSync(perfDir, { recursive: true, force: true });
});

const postJson = (path: string, body: unknown, raw = false) =>
  fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw ? (body as string) : JSON.stringify(body),
  });

// ── /triage validation (short-circuits before inference) ───────────────────────────
test("POST /triage with empty caseText -> 400 'caseText is required.'", async () => {
  const r = await postJson("/triage", { caseText: "" });
  assert.equal(r.status, 400);
  assert.deepEqual(await r.json(), { error: "caseText is required." });
});

test("POST /triage with whitespace-only caseText -> 400 (trimmed to empty)", async () => {
  const r = await postJson("/triage", { caseText: "    \n\t  " });
  assert.equal(r.status, 400);
  assert.deepEqual(await r.json(), { error: "caseText is required." });
});

test("POST /triage with a missing body field -> 400 'caseText is required.'", async () => {
  const r = await postJson("/triage", { notCaseText: "hello" });
  assert.equal(r.status, 400);
  assert.deepEqual(await r.json(), { error: "caseText is required." });
});

test("POST /triage over 2000 chars -> 400 friendly 'too long' (no embedder overflow)", async () => {
  const r = await postJson("/triage", { caseText: "a".repeat(2001) });
  assert.equal(r.status, 400);
  const j = await r.json();
  assert.match(j.error, /too long/i);
  assert.doesNotMatch(j.error, /\//, "friendly message leaks no path");
});

test("POST /triage rejects invalid structured age and danger values before inference", async () => {
  const boundaries: string[] = [];
  const restore = setTriageExecutionObserver((boundary: string) => boundaries.push(boundary));
  const invalidBodies = [
    { caseText: "child coughing", patientAge: { value: -1, unit: "months" } },
    { caseText: "child coughing", patientAge: { value: 2, unit: "weeks" } },
    { caseText: "child coughing", patientAge: { value: "2", unit: "months" } },
    { caseText: "child coughing", dangerObservations: { convulsions: "CONFLICT" } },
    { caseText: "child coughing", dangerObservations: { convulsions: "YES" } },
  ];
  try {
    for (const body of invalidBodies) {
      const r = await postJson("/triage", body);
      assert.equal(r.status, 400);
      assert.deepEqual(await r.json(), { error: "Invalid structured danger assessment." });
    }
    assert.deepEqual(boundaries, [], "invalid requests reach neither triageContext nor any runtime/download boundary");
  } finally {
    restore();
  }
});

test("POST /triage rejects invalid respiratory assessment values before inference", async () => {
  const boundaries: string[] = [];
  const restore = setTriageExecutionObserver((boundary: string) => boundaries.push(boundary));
  const invalidRespiratoryAssessments = [
    { coughOrDifficultBreathing: "YES", respiratoryRatePerMinute: 40, rateCountQuality: "ONE_MINUTE_WHILE_CALM" },
    { coughOrDifficultBreathing: "PRESENT", respiratoryRatePerMinute: 0, rateCountQuality: "ONE_MINUTE_WHILE_CALM" },
    { coughOrDifficultBreathing: "PRESENT", respiratoryRatePerMinute: 201, rateCountQuality: "ONE_MINUTE_WHILE_CALM" },
    { coughOrDifficultBreathing: "PRESENT", respiratoryRatePerMinute: 40.5, rateCountQuality: "ONE_MINUTE_WHILE_CALM" },
    { coughOrDifficultBreathing: "PRESENT", respiratoryRatePerMinute: 40, rateCountQuality: "CALM" },
  ];
  try {
    for (const respiratoryAssessment of invalidRespiratoryAssessments) {
      const response = await postJson("/triage", {
        caseText: "18 month old with cough",
        patientAge: { value: 18, unit: "months" },
        dangerObservations: { convulsions: "ABSENT" },
        respiratoryAssessment,
      });
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { error: "Invalid structured respiratory assessment." });
    }
    assert.deepEqual(boundaries, [], "invalid respiratory input reaches no QVAC or retrieval boundary");
  } finally {
    restore();
  }
});

test("POST /triage lets a structured emergency observation win before narrative conflicts", async () => {
  const absent = Object.fromEntries([
    "cannotDrinkOrBreastfeed", "vomitsEverything", "convulsions", "lethargicOrUnconscious",
    "chestIndrawing", "stridorWhenCalm", "lowOxygenOrCentralCyanosis",
  ].map((key) => [key, "ABSENT"]));
  const response = await postJson("/triage", {
    caseText: "18 month old with cough, alert and drinking",
    patientAge: { value: 7, unit: "months" },
    dangerObservations: { ...absent, cannotDrinkOrBreastfeed: "PRESENT" },
  });
  assert.equal(response.status, 200);
  const stream = await response.text();
  assert.match(stream, /"outcome":"EMERGENCY"/);
  assert.doesNotMatch(stream, /event: continuation|event: first_token/);
});

test("POST /triage accepts coordinated explicit absence as deterministic outside scope", async () => {
  const boundaries: string[] = [];
  const restore = setTriageExecutionObserver((boundary: string) => boundaries.push(boundary));
  const absent = Object.fromEntries([
    "cannotDrinkOrBreastfeed", "vomitsEverything", "convulsions", "lethargicOrUnconscious",
    "chestIndrawing", "stridorWhenCalm", "lowOxygenOrCentralCyanosis",
  ].map((key) => [key, "ABSENT"]));
  try {
    const response = await postJson("/triage", {
      caseText: "Two year old. Cough or difficult breathing absent. Cannot drink or breastfeed, vomits everything, convulsions, lethargic or unconscious, chest indrawing, stridor when calm, and low oxygen or central cyanosis were absent.",
      patientAge: { value: 2, unit: "years" },
      dangerObservations: absent,
      respiratoryAssessment: { coughOrDifficultBreathing: "ABSENT", rateCountQuality: "NOT_CONFIRMED" },
    });
    assert.equal(response.status, 200);
    const stream = await response.text();
    assert.match(stream, /"outcome":"OUTSIDE_SUPPORTED_SCOPE"/);
    assert.doesNotMatch(stream, /event: continuation|event: first_token/);
    assert.deepEqual(boundaries, []);
  } finally {
    restore();
  }
});

test("POST /triage rejects explicit facts discarded as structured not-assessed", async () => {
  const boundaries: string[] = [];
  const restore = setTriageExecutionObserver((boundary: string) => boundaries.push(boundary));
  try {
    const response = await postJson("/triage", {
      caseText: "Two year old. Convulsions were absent. Cough is present.",
      patientAge: { value: 2, unit: "years" },
      dangerObservations: { convulsions: "NOT_ASSESSED" },
      respiratoryAssessment: { coughOrDifficultBreathing: "NOT_ASSESSED", rateCountQuality: "NOT_CONFIRMED" },
    });
    assert.equal(response.status, 409);
    assert.deepEqual((await response.json()).conflicts, [
      "convulsions",
      "respiratoryAssessment.coughOrDifficultBreathing",
    ]);
    assert.deepEqual(boundaries, []);
  } finally {
    restore();
  }
});

// ── excluded optional modalities ───────────────────────────────────────────────────
test("POST /tts is not registered in the English text baseline", async () => {
  const r = await postJson("/tts", { text: "" });
  assert.equal(r.status, 404);
});

test("POST /transcribe is not registered in the English text baseline", async () => {
  const fd = new FormData();
  fd.append("note", "no file here");
  const r = await fetch(`${base}/transcribe`, { method: "POST", body: fd });
  assert.equal(r.status, 404);
});

// ── body-parser edge cases (centralised error middleware) ──────────────────────────
test("malformed JSON body -> 400 'Malformed JSON body.'", async () => {
  const r = await postJson("/triage", "{ not: valid json ", true);
  assert.equal(r.status, 400);
  assert.deepEqual(await r.json(), { error: "Malformed JSON body." });
});

test("oversized JSON body (> 256kb express limit) -> 413 'Request body is too large.'", async () => {
  // A single JSON string field over 256kb trips entity.too.large in body-parser BEFORE the route.
  const huge = JSON.stringify({ caseText: "a".repeat(300 * 1024) });
  const r = await postJson("/triage", huge, true);
  assert.equal(r.status, 413);
  assert.deepEqual(await r.json(), { error: "Request body is too large." });
});

// ── survival: the server stays up after a bad request ───────────────────────────────
test("GET /health returns 200 AFTER a malformed-JSON request (server survives bad input)", async () => {
  // Hit the centralised error path first...
  const bad = await postJson("/triage", "{ broken ", true);
  assert.equal(bad.status, 400);
  // ...then prove the process is still serving. /health reads chunkCount()/citationMapHealthy() only.
  const r = await fetch(`${base}/health`);
  assert.equal(r.status, 200);
  const h = await r.json();
  assert.equal(h.ok, true);
  assert.equal(h.ready, false, "bare app.listen reports HTTP liveness, never product readiness");
  assert.equal(h.readiness.modelContractVerified, false);
  assert.equal(h.readiness.ragLive, false);
  assert.equal(h.readiness.egressGuardArmed, false);
  assert.equal(typeof h.citationMapHealthy, "boolean", "health exposes citationMapHealthy boolean");
  assert.ok("chunks" in h, "health reports chunk count");
  assert.ok("residentModels" in h, "health reports resident models");
  assert.ok("residentMode" in h, "health reports resident mode");
  assert.ok("medpsy" in h, "health reports the medpsy variant");
});

test("known endpoints return JSON 405 with exact Allow headers", async () => {
  const cases = [
    ["/health", "POST", "GET, HEAD"],
    ["/app", "POST", "GET, HEAD"],
    ["/perf-log", "POST", "GET, HEAD"],
    ["/perf-log.csv", "POST", "GET, HEAD"],
    ["/triage", "GET", "POST"],
  ] as const;

  for (const [path, method, allow] of cases) {
    const response = await fetch(`${base}${path}`, { method });
    assert.equal(response.status, 405, `${method} ${path}`);
    assert.equal(response.headers.get("allow"), allow);
    assert.match(response.headers.get("content-type") || "", /application\/json/);
    assert.deepEqual(await response.json(), { error: "Method Not Allowed" });
  }
});

test("unknown routes remain 404", async () => {
  assert.equal((await fetch(`${base}/not-a-real-endpoint`)).status, 404);
});

test("empty perf CSV is a truthful header-only dataset", async () => {
  const response = await fetch(`${base}/perf-log.csv`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /^text\/csv/);
  assert.equal(
    await response.text(),
    "ts,phase,event,modelId,promptTokens,ttftMs,tokensPerSec,totalTokens,backendDevice,durationMs\n",
  );
});
