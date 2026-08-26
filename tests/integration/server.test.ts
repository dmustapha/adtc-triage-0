// File: tests/integration/server.test.ts
// Phase-4 P1 milestone gate: the whole hero loop through the HTTP server, end-to-end on the live SDK.
// Boots the Express app on an ephemeral port and exercises /health, /triage (SSE: citation lands
// first, then a grounded card). Audio and translation are intentionally outside this import baseline.
//
// Loads MedPsy + GTE + supertonic. SLOW. Self-skips if the store isn't ingested or models aren't cached.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.TRIAGE0_PERF_DIR = mkdtempSync(join(tmpdir(), "triage0-test-perf-"));

const { app } = await import("../../src/server.js");
const { orchestrator } = await import("../../src/qvac/orchestrator.js");
const { chunkCount } = await import("../../src/rag/store.js");

const skip = chunkCount() > 0 ? false : "store not ingested";

let server: { address(): { port: number } | string | null; close(): void };
let base = "";
before(async () => {
  await new Promise<void>((resolveReady) => {
    server = app.listen(0, () => resolveReady()) as never;
  });
  const addr = (server as { address(): { port: number } }).address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
});
after(async () => {
  if (server) server.close();
  await orchestrator.shutdown();
  rmSync(process.env.TRIAGE0_PERF_DIR!, { recursive: true, force: true });
});

/** Read an SSE response body into a list of {event, data} objects. */
async function readSse(res: Response): Promise<Array<{ event: string; data: any }>> {
  const out: Array<{ event: string; data: any }> = [];
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const event = (block.match(/^event: (.*)$/m) || [])[1];
      const data = (block.match(/^data: (.*)$/m) || [])[1];
      if (event && data) out.push({ event, data: JSON.parse(data) });
    }
  }
  return out;
}

test("GET /health reports canonical shared-runtime identity", { timeout: 60_000 }, async () => {
  const r = await fetch(`${base}/health`);
  const h = await r.json();
  assert.equal(h.ok, true);
  assert.equal(h.medpsy, "medpsy-1.7b-q4");
  assert.equal(h.model.path, "model/medpsy-1.7b-q4_k_m-imat.gguf");
  assert.equal(h.model.sha256, "41ee947d9cce72ec657577219fd1798fabeabf0d832217fe23c9d6d3d18d5880");
  assert.deepEqual(h.model.productRuntime, { name: "QVAC SDK", version: "0.13.3" });
  assert.equal(h.model.officialRuntime, "llama.cpp");
});

test("POST /triage keeps a below-threshold respiratory result neutral while assistance completes", { skip, timeout: 300_000 }, async () => {
  const absent = Object.fromEntries([
    "cannotDrinkOrBreastfeed", "vomitsEverything", "convulsions", "lethargicOrUnconscious",
    "chestIndrawing", "stridorWhenCalm", "lowOxygenOrCentralCyanosis",
  ].map((key) => [key, "ABSENT"]));
  const r = await fetch(`${base}/triage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      caseText: "2-year-old with cough for 3 days, alert and drinking.",
      patientAge: { value: 24, unit: "months" },
      dangerObservations: absent,
      respiratoryAssessment: {
        coughOrDifficultBreathing: "PRESENT",
        respiratoryRatePerMinute: 32,
        rateCountQuality: "ONE_MINUTE_WHILE_CALM",
      },
    }),
  });
  assert.match(r.headers.get("content-type") || "", /text\/event-stream/);
  const events = await readSse(r);
  const kinds = events.map((e) => e.event);

  // Citation must arrive BEFORE the card (E-5 sequencing).
  const ci = kinds.indexOf("citation");
  const cardi = kinds.indexOf("card");
  assert.ok(ci >= 0, "got a citation event");
  assert.ok(cardi > ci, "card event arrives after citation");

  const citation = events[ci].data;
  assert.match(citation.doc, /IMCI/i, "cited the IMCI protocol");
  assert.ok(String(citation.page).match(/\d/), "citation has a real page");

  const card = events[cardi].data.card;
  assert.ok(!("severity" in card));
  assert.equal(card.outcome, "NO_ESCALATION_CRITERION_RECORDED");
  assert.equal(card.thresholdComparison.respiratoryRatePerMinute, 32);
  assert.equal(card.thresholdComparison.thresholdPerMinute, 40);
  assert.equal(card.assistance.status, "COMPLETED");
  assert.equal(card.reviewState, "DETERMINISTIC");
  assert.equal("classification" in card, false);
  assert.equal("protocol" in card, false);
  assert.ok(events[cardi].data.perf, "card carries a perf payload for the HUD");
  assert.ok(!kinds.includes("plan"), "no reference actions before confirmation");
  assert.ok(!kinds.includes("provisional"), "a model classification cannot be promoted over the settled respiratory result");
  const publicText = JSON.stringify(events).replace(/not a diagnosis/gi, "");
  assert.doesNotMatch(publicText, /diagnos(?:e|is)|prescri(?:be|ption)|chain.of.thought|<think>|raw reasoning/i);
  assert.doesNotMatch(JSON.stringify(events), /PNEUMONIA|provisional WHO protocol classification/i);
});

test("POST /triage rejects an oversized case with a friendly 400 (no embedder overflow)", { skip, timeout: 30_000 }, async () => {
  const r = await fetch(`${base}/triage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ caseText: "a".repeat(5000) }),
  });
  assert.equal(r.status, 400, "oversized case is rejected before it can overflow the embedding context");
  const j = await r.json();
  assert.match(j.error, /too long/i);
});

test("POST /tts is absent from the English text baseline", { skip, timeout: 30_000 }, async () => {
  const r = await fetch(`${base}/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "Assessment summary." }),
  });
  assert.equal(r.status, 404);
});
