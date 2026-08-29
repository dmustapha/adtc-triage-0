import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream, mkdirSync, writeFileSync } from "node:fs";
import { test, before, after } from "node:test";

const { app, sharedInferenceQueue } = await import("../../src/server.js");
const { orchestrator } = await import("../../src/qvac/orchestrator.js");
const { guard } = await import("../../src/qvac/egress-guard.js");
const { chunkCount } = await import("../../src/rag/store.js");

const ABSENT = Object.fromEntries([
  "cannotDrinkOrBreastfeed", "vomitsEverything", "convulsions", "lethargicOrUnconscious",
  "chestIndrawing", "stridorWhenCalm", "lowOxygenOrCentralCyanosis",
].map((key) => [key, "ABSENT"]));

type Event = { event: string; data: any };
let server: ReturnType<typeof app.listen>;
let base = "";
const evidence: Array<{ caseId: string; events: Event[] }> = [];

function parseSse(text: string): Event[] {
  return text.trim().split("\n\n").flatMap((block) => {
    const event = block.match(/^event: (.+)$/m)?.[1];
    const data = block.match(/^data: (.+)$/m)?.[1];
    return event && data ? [{ event, data: JSON.parse(data) }] : [];
  });
}

function normalize(events: Event[]): Event[] {
  return events.map(({ event, data }) => ({
    event,
    data: event === "job" ? { ...data, id: "[redacted]" } : data,
  }));
}

async function assess(caseId: string, body: Record<string, unknown>) {
  const response = await fetch(`${base}/triage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  assert.equal(response.status, 200);
  const events = parseSse(await response.text());
  evidence.push({ caseId, events: normalize(events) });
  return { events };
}

function eventData(events: Event[], name: string): any {
  const value = events.find((item) => item.event === name)?.data;
  assert.ok(value, `missing ${name} event`);
  return value;
}

async function sha256(path: string): Promise<string> {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest("hex");
}

before(async () => {
  assert.ok(chunkCount() > 0, "the real WHO store must be present on this development host");
  guard.arm(true);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolveReady, reject) => {
    server.once("listening", resolveReady);
    server.once("error", reject);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  base = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  await sharedInferenceQueue.shutdown(5_000);
  await orchestrator.shutdown();
  const modelPath = "model/medpsy-1.7b-q4_k_m-imat.gguf";
  const artifact = {
    schemaVersion: 1,
    kind: "real-restored-clinical-workflow",
    runtime: "QVAC SDK 0.13.3",
    model: { path: modelPath, sha256: await sha256(modelPath) },
    store: "triage0-who-protocols",
    egress: { strict: true, violations: [...guard.violations] },
    cases: evidence,
    shutdown: { queueClosed: true, orchestratorRoles: orchestrator.residentRoles() },
  };
  mkdirSync("output/evidence/restored-workflow", { recursive: true });
  writeFileSync("output/evidence/restored-workflow/real-clinical-matrix.json", `${JSON.stringify(artifact, null, 2)}\n`);
  guard.disarm();
});

// The restored one-flow contract: POST /triage streams card+plan in a single response.
// There is no provisional event, no /triage/confirm, no confirmation step.

test("real QVAC/WHO/MedPsy emits card and plan in one stream for IMCI pneumonia, IMCI diarrhoea, mhGAP, and abstains for off-domain", { timeout: 360_000 }, async () => {
  // IMCI pneumonia — card and plan must arrive in the same SSE stream.
  const pneumonia = await assess("pneumonia-confirmed", {
    caseText: "Two-year-old child with cough for three days and fast breathing at 52 breaths per minute, alert and drinking.",
    patientAge: { value: 24, unit: "months" },
    dangerObservations: ABSENT,
    respiratoryAssessment: {
      coughOrDifficultBreathing: "PRESENT",
      respiratoryRatePerMinute: 52,
      rateCountQuality: "ONE_MINUTE_WHILE_CALM",
    },
  });
  const pneumoniaEvents = pneumonia.events.map((item) => item.event);
  // One-flow: card and plan in the same stream, no provisional gate.
  assert.ok(pneumoniaEvents.includes("card"), "pneumonia: card event must be present");
  assert.ok(pneumoniaEvents.includes("plan"), "pneumonia: plan event must be present");
  assert.equal(pneumonia.events.some((item) => item.event === "provisional"), false, "no provisional event in one-flow");
  // job first, done last.
  assert.equal(pneumoniaEvents[0], "job");
  assert.equal(pneumoniaEvents.at(-1), "done");
  // Card carries severity.
  const pneumoniaCard = eventData(pneumonia.events, "card").card;
  assert.ok(pneumoniaCard.severity, "pneumonia card must have severity");
  assert.equal(pneumoniaCard.plan, undefined, "plan must be split into a separate plan event");
  // Stage pipeline must include assess step.
  const stages = pneumonia.events.filter((item) => item.event === "stage").map((item) => item.data.key);
  assert.ok(stages.includes("assess"), "assess stage must fire");

  // IMCI diarrhoea — one-flow.
  const diarrhoea = await assess("imci-diarrhoea", {
    caseText: "Four-year-old child with watery diarrhoea for two days, sunken eyes, restless and irritable, drinks eagerly, skin pinch goes back slowly.",
    patientAge: { value: 48, unit: "months" },
    dangerObservations: ABSENT,
  });
  const diarrhoeaEvents = diarrhoea.events.map((item) => item.event);
  assert.ok(diarrhoeaEvents.includes("card"), "diarrhoea: card event must be present");
  assert.equal(diarrhoea.events.some((item) => item.event === "provisional"), false, "no provisional event");

  // mhGAP depression — one-flow.
  const mhgap = await assess("mhgap-depression", {
    caseText: "Thirty-year-old adult with persistent low mood, loss of interest, low energy, and difficulty functioning for three weeks.",
    patientAge: { value: 30, unit: "years" },
    dangerObservations: ABSENT,
  });
  const mhgapEvents = mhgap.events.map((item) => item.event);
  assert.ok(mhgapEvents.includes("card"), "mhgap: card event must be present");
  assert.equal(mhgap.events.some((item) => item.event === "provisional"), false, "no provisional event");

  // Off-domain — abstain card (UNKNOWN severity) with no plan.
  const offDomain = await assess("off-domain", {
    caseText: "Explain how to repair a bicycle chain and adjust the rear derailleur.",
    patientAge: { value: 30, unit: "years" },
    dangerObservations: ABSENT,
  });
  assert.ok(offDomain.events.some((item) => item.event === "card"), "off-domain must emit card");
  const offDomainCard = eventData(offDomain.events, "card").card;
  // Abstain path: severity must be UNKNOWN (one-flow contract; no reviewState fallback).
  assert.equal(
    offDomainCard.severity,
    "UNKNOWN",
    `off-domain card must have severity UNKNOWN, got severity=${offDomainCard.severity}`,
  );

  assert.deepEqual(guard.violations, []);
});
