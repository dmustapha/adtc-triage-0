// File: tests/integration/sse-contract.test.ts
// MODEL-GATED. Pins the /triage SSE WIRE CONTRACT — the exact event order and per-event payload schema
// the frontend (triage.js handleEvent) depends on. server.test.ts proves the hero loop end-to-end; this
// proves the contract is STABLE: citation arrives before first-token telemetry, card/provisional, and
// done; reference actions remain absent until confirmation, and abstention never invents a class.
//
// Self-skips until both the store and exact canonical MedPsy file exist.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.TRIAGE0_PERF_DIR = mkdtempSync(join(tmpdir(), "triage0-test-perf-"));

const { app } = await import("../../src/server.js");
const { orchestrator } = await import("../../src/qvac/orchestrator.js");
const { chunkCount } = await import("../../src/rag/store.js");
const { setTriageExecutionObserver } = await import("../../src/triage/triage.js");

const modelPath = new URL("../../model/medpsy-1.7b-q4_k_m-imat.gguf", import.meta.url);
const skip = chunkCount() === 0
  ? "store not ingested — run `npm run ingest` first"
  : existsSync(modelPath)
    ? false
    : "canonical MedPsy GGUF not downloaded";

let server: { address(): { port: number } | string | null; close(): void };
let base = "";
before(async () => {
  await new Promise<void>((ready) => { server = app.listen(0, () => ready()) as never; });
  const addr = (server as { address(): { port: number } }).address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
});
after(async () => {
  if (server) server.close();
  await orchestrator.shutdown();
  rmSync(process.env.TRIAGE0_PERF_DIR!, { recursive: true, force: true });
});

/** Read an SSE response body into a list of {event, data} objects (same helper as server.test.ts). */
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

const FORBIDDEN_PRECONFIRMATION_KEYS = new Set(["plan", "referenceActions", "medicines", "dose", "bands"]);

function assertPreconfirmationPublicValue(value: unknown, path = "payload"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertPreconfirmationPublicValue(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assert.ok(!FORBIDDEN_PRECONFIRMATION_KEYS.has(key), `${path}.${key} is not public before confirmation`);
    assertPreconfirmationPublicValue(child, `${path}.${key}`);
  }
}

function assertNoUnsafeClinicalClaim(value: unknown): void {
  const publicText = JSON.stringify(value).replace(/not a diagnosis/gi, "");
  assert.doesNotMatch(
    publicText,
    /diagnos(?:e|is)|prescri(?:be|ption)|model-authored (?:plan|action)|chain.of.thought|<think>|raw reasoning/i,
  );
}

const ABSENT = {
  cannotDrinkOrBreastfeed: "ABSENT",
  vomitsEverything: "ABSENT",
  convulsions: "ABSENT",
  lethargicOrUnconscious: "ABSENT",
  chestIndrawing: "ABSENT",
  stridorWhenCalm: "ABSENT",
  lowOxygenOrCentralCyanosis: "ABSENT",
};

const respiratoryAssessment = (respiratoryRatePerMinute: number) => ({
  coughOrDifficultBreathing: "PRESENT",
  respiratoryRatePerMinute,
  rateCountQuality: "ONE_MINUTE_WHILE_CALM",
});

const triage = (caseText: string, extra: Record<string, unknown> = {}) =>
  fetch(`${base}/triage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ caseText, ...extra }),
  });

async function beginRespiratoryContinuation(caseText: string, extra: Record<string, unknown>) {
  const initialResponse = await triage(caseText, extra);
  const cookie = initialResponse.headers.get("set-cookie")?.split(";")[0];
  const initial = await readSse(initialResponse);
  const token = initial.find((event) => event.event === "continuation")?.data.token;
  assert.ok(token, "initial deterministic result carries an explicit continuation token");
  const continued = await fetch(`${base}/triage/continue`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify({ token }),
  });
  return { initial, continued: await readSse(continued) };
}

async function observeRequest(body: Record<string, unknown>, failOnBoundary = false) {
  const boundaries: string[] = [];
  const restore = setTriageExecutionObserver((boundary: string) => {
    boundaries.push(boundary);
    if (failOnBoundary) throw new Error(`unexpected execution boundary: ${boundary}`);
  });
  try {
    return { events: await readSse(await triage(String(body.caseText), body)), boundaries };
  } finally {
    restore();
  }
}

test("omitted and partial structured assessments fail closed before routing or MedPsy", async () => {
  for (const body of [
    { caseText: "nine month old child with cough" },
    { caseText: "nine month old child with cough", patientAge: { value: 9, unit: "months" }, dangerObservations: { convulsions: "ABSENT" } },
  ]) {
    const { events, boundaries } = await observeRequest(body);
    assert.deepEqual(events.filter((event) => event.event !== "stage").map((event) => event.event), ["assessment_required", "done"]);
    const card = events.find((event) => event.event === "assessment_required")!.data.card;
    assert.equal(card.outcome, "ASSESSMENT_REQUIRED");
    assert.ok(!("severity" in card));
    assert.deepEqual(boundaries, [], "no QVAC context, semantic routing, retrieval, or MedPsy boundary ran");
  }
});

test("known structured emergency precedes missing age and fields without routing or MedPsy", async () => {
  const { events, boundaries } = await observeRequest({
    caseText: "free text says the child is well",
    dangerObservations: { cannotDrinkOrBreastfeed: "PRESENT" },
  });
  const cardEvent = events.find((event) => event.event === "card")!.data;
  assert.equal(cardEvent.card.outcome, "EMERGENCY");
  assert.deepEqual(cardEvent.card.emergencyObservations, ["cannotDrinkOrBreastfeed"]);
  assert.equal(cardEvent.card.assistance.status, "NOT_RUN");
  const citationEvent = events.find((event) => event.event === "citation")!.data;
  assert.equal(citationEvent.provenance, "fixed-policy");
  assert.match(cardEvent.card.finding, /emergency/i);
  assert.match(cardEvent.card.sourceRule.doc, /IMCI/i);
  assert.ok(!("severity" in cardEvent.card));
  assert.ok(!("redFlags" in cardEvent.card));
  assert.ok(events.some((event) => event.event === "citation"));
  events.forEach((event) => assertPreconfirmationPublicValue(event.data));
  assertNoUnsafeClinicalClaim(events);
  assert.deepEqual(boundaries, []);
});

test("reviewed narrative conflicts return exact correction fields before routing or MedPsy", async () => {
  const boundaries: string[] = [];
  const restore = setTriageExecutionObserver((boundary: string) => { boundaries.push(boundary); });
  try {
    const response = await triage("Two year old child with cough, breathing 32 per minute, and no chest indrawing.", {
      patientAge: { value: 3, unit: "years" },
      dangerObservations: { ...ABSENT, chestIndrawing: "PRESENT" },
      respiratoryAssessment: respiratoryAssessment(40),
      medicationSafety: {
        allergiesReviewed: "NOT_ASSESSED", contraindicationsReviewed: "NOT_ASSESSED",
        allergyDetails: [], contraindicationDetails: [],
      },
      protocolApplicability: { status: "NOT_ASSESSED", details: [] },
    });
    assert.equal(response.status, 409);
    assert.deepEqual((await response.json()).conflicts, [
      "patientAge",
      "chestIndrawing",
      "respiratoryAssessment.respiratoryRatePerMinute",
    ]);
    assert.deepEqual(boundaries, []);
  } finally {
    restore();
  }
});

test("missing breathing rate fails closed with exact missing field before routing or MedPsy", async () => {
  const { events, boundaries } = await observeRequest({
    caseText: "18 month old with cough, alert and drinking",
    patientAge: { value: 18, unit: "months" },
    dangerObservations: ABSENT,
    respiratoryAssessment: {
      coughOrDifficultBreathing: "PRESENT",
      rateCountQuality: "ONE_MINUTE_WHILE_CALM",
    },
  }, true);
  const assessmentEvent = events.find((event) => event.event === "assessment_required");
  assert.ok(assessmentEvent, "missing rate returns assessment_required before any execution boundary");
  const card = assessmentEvent.data.card;

  assert.equal(card.outcome, "ASSESSMENT_REQUIRED");
  assert.deepEqual(card.missingFields, ["respiratoryAssessment.respiratoryRatePerMinute"]);
  assert.match(card.finding, /breathing rate was not recorded/i);
  assert.equal(card.assistance.status, "NOT_RUN");
  assert.ok(!("severity" in card));
  assert.ok(!("redFlags" in card));
  assert.deepEqual(boundaries, []);
});

test("supported isolated chest indrawing remains a deterministic respiratory result", async () => {
  const chest = { ...ABSENT, chestIndrawing: "PRESENT" };
  const supported = await observeRequest({
    caseText: "2 month old with cough and chest indrawing",
    patientAge: { value: 2, unit: "months" },
    dangerObservations: chest,
    respiratoryAssessment: { coughOrDifficultBreathing: "PRESENT", rateCountQuality: "NOT_CONFIRMED" },
  });
  const card = supported.events.find((event) => event.event === "card")!.data;
  assert.equal(card.card.outcome, "PROMPT_SUPERVISED_REVIEW");
  assert.deepEqual(card.card.emergencyObservations, []);
  assert.ok(!("severity" in card.card));
  assert.ok(!("redFlags" in card.card));
  supported.events.forEach((event) => assertPreconfirmationPublicValue(event.data));
  assertNoUnsafeClinicalClaim(supported.events);
  assert.deepEqual(supported.boundaries, []);

  const outside = await observeRequest({ caseText: "model prose says severe", patientAge: { value: 60, unit: "months" }, dangerObservations: chest });
  assert.ok(outside.events.some((event) => event.event === "assessment_required"));
  assert.deepEqual(outside.boundaries, []);
});

test("fast breathing is deterministic and never crosses a QVAC or retrieval boundary", async () => {
  const { events, boundaries } = await observeRequest({
    caseText: "2-year-old with cough; breathing counted at 40 per minute while calm",
    patientAge: { value: 24, unit: "months" },
    dangerObservations: ABSENT,
    respiratoryAssessment: respiratoryAssessment(40),
  }, true);
  const card = events.find((event) => event.event === "card")!.data.card;
  const citation = events.find((event) => event.event === "citation")!.data;

  assert.equal(card.outcome, "PROMPT_SUPERVISED_REVIEW");
  assert.equal(card.thresholdComparison.relation, "AT_OR_ABOVE");
  assert.equal(card.assistance.status, "NOT_RUN");
  assert.equal(citation.provenance, "fixed-policy");
  assert.deepEqual(boundaries, []);
  assert.ok(!events.some((event) => event.event === "first_token"));
  assert.ok(!events.some((event) => event.event === "stage" && ["retrieve", "reason"].includes(event.data.key)));
});

test("initial respiratory result is model-free and explicit continuation keeps reasoning private and actions gated", { skip, timeout: 300_000 }, async () => {
  const flow = await beginRespiratoryContinuation("2-year-old, cough 3 days, breathing 32 a minute, alert and drinking, no chest indrawing or danger signs.", {
    patientAge: { value: 24, unit: "months" }, dangerObservations: ABSENT, respiratoryAssessment: respiratoryAssessment(32),
  });
  assert.deepEqual(flow.initial.map((event) => event.event), ["stage", "citation", "card", "continuation", "done"]);
  assert.equal(flow.initial.find((event) => event.event === "citation")?.data.provenance, "fixed-policy");
  assert.ok(!flow.initial.some((event) => event.event === "first_token"));

  const events = flow.continued;
  const kinds = events.map((e) => e.event);

  const idx = (k: string) => kinds.indexOf(k);
  assert.ok(idx("citation") >= 0, "emits a citation");
  assert.ok(idx("first_token") > idx("citation"), "first_token after citation");
  assert.ok(idx("card") > idx("first_token"), "card after first-token telemetry");
  assert.equal(kinds[kinds.length - 1], "done", "done is the terminal event");
  assert.ok(!kinds.includes("reasoning"), "model chain-of-thought is never exposed");
  assert.ok(!kinds.includes("plan"), "reference actions are absent before confirmation");
  assert.ok(!kinds.includes("error"), "a grounded case never emits an error event");

  // Representation: additive on-device pipeline readout. Each `stage` marks a REAL step; they are
  // ignorable by any existing consumer and never reorder the load-bearing citation/card/plan sequence.
  const stageKeys = events.filter((e) => e.event === "stage").map((e) => e.data.key);
  for (const s of ["detect", "retrieve", "reason", "summarize"]) {
    assert.ok(stageKeys.includes(s), `stage readout covers the real "${s}" step`);
  }
  events.forEach((event) => assertPreconfirmationPublicValue(event.data));
  assertNoUnsafeClinicalClaim(events);
  const provisional = events.find((event) => event.event === "provisional")?.data;
  if (provisional) {
    assert.ok(provisional.token || provisional.confirmation?.token, "provisional classification carries an opaque confirmation token");
    const provisionalCard = events.find((event) => event.event === "card")?.data.card;
    assert.equal(provisionalCard?.reviewState, "PROVISIONAL");
    assert.match(provisionalCard?.uncertainty ?? "", /provisional|not a diagnosis/i);
  }
  assert.ok(idx("stage") >= 0 && idx("stage") < idx("card"), "stages stream before the card they describe");
});

test("grounded respiratory continuation keeps the deterministic result authoritative", { skip, timeout: 300_000 }, async () => {
  const { continued: events } = await beginRespiratoryContinuation("2-year-old, cough 3 days, breathing 32 a minute, alert and drinking, no chest indrawing or danger signs.", {
    patientAge: { value: 24, unit: "months" }, dangerObservations: ABSENT, respiratoryAssessment: respiratoryAssessment(32),
  });
  const get = (k: string) => events.find((e) => e.event === k)?.data;

  // citation: protocol/doc/page/section/score/retrieval.
  const citation = get("citation");
  assert.ok(citation, "citation present");
  for (const f of ["protocol", "doc", "page", "score", "retrieval"]) {
    assert.ok(f in citation, `citation carries ${f}`);
  }
  assert.equal(typeof citation.score, "number");
  assert.equal(citation.retrieval, "semantic");
  assert.equal(citation.provenance, "retrieved-reference");
  assert.ok(String(citation.page).match(/\d/), "citation page is a real number");

  // first_token: ttftMs number.
  const ft = get("first_token");
  assert.ok(ft && typeof ft.ttftMs === "number" && ft.ttftMs >= 0, "first_token carries a numeric ttftMs");

  // card: neutral result authority / attempts / perf{ttftMs,tokensPerSec,totalTokens,backendDevice}.
  const cardEv = get("card");
  assert.ok(cardEv, "card present");
  for (const f of ["card", "attempts", "perf"]) assert.ok(f in cardEv, `card event carries ${f}`);
  assert.equal(typeof cardEv.attempts, "number");
  for (const k of ["ttftMs", "tokensPerSec", "totalTokens", "backendDevice"]) {
    assert.ok(k in cardEv.perf, `perf HUD carries ${k}`);
  }
  for (const f of ["outcome", "finding", "basis", "nextAssessmentStep", "matchedCriteria", "missingFields", "recorded", "thresholdComparison", "emergencyObservations", "sourceRule", "assistance", "uncertainty"]) {
    assert.ok(f in cardEv.card, `public card carries ${f}`);
  }
  assert.equal(cardEv.card.outcome, "NO_ESCALATION_CRITERION_RECORDED");
  assert.match(cardEv.card.finding, /no emergency observation.*fast-breathing criterion/i);
  assert.deepEqual(cardEv.card.thresholdComparison, {
    respiratoryRatePerMinute: 32,
    thresholdPerMinute: 40,
    relation: "BELOW",
  });
  assert.equal(cardEv.card.assistance.status, "COMPLETED");
  assert.equal(cardEv.card.assistance.runtime, "QVAC SDK 0.13.3");
  assert.match(cardEv.card.assistance.model, /MedPsy-1\.7B-GGUF/i);
  assert.ok(!("supportingExcerpt" in cardEv.card.assistance), "raw retrieved text is never public");
  assert.ok(!("severity" in cardEv.card), "classifier-derived severity is not public result authority");
  assert.ok(!("redFlags" in cardEv.card), "only emergencyObservations is public");
  events.forEach((event) => assertPreconfirmationPublicValue(event.data));
  assertNoUnsafeClinicalClaim(events);
});

test("complete structured respiratory record remains authoritative over unrelated narrative", { skip, timeout: 120_000 }, async () => {
  const events = await readSse(await triage("What is the best recipe for chocolate cake?", {
    patientAge: { value: 24, unit: "months" }, dangerObservations: ABSENT, respiratoryAssessment: respiratoryAssessment(32),
  }));
  const kinds = events.map((e) => e.event);
  const card = events.find((e) => e.event === "card")!.data.card;
  assert.equal(card.outcome, "NO_ESCALATION_CRITERION_RECORDED");
  assert.equal(card.thresholdComparison.relation, "BELOW");
  assert.ok(!("severity" in card));
  assert.ok(!("redFlags" in card));
  assert.ok(kinds.includes("citation"), "the structured respiratory route retrieves supporting WHO evidence");
  assert.ok(!kinds.includes("abstain"), "unrelated narrative cannot override the structured respiratory record");
  assert.ok(!kinds.includes("plan"), "no plan on abstain");
});
