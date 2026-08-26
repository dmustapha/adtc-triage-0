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
    data: event === "job" ? { ...data, id: "[redacted]" }
      : event === "provisional" ? { ...data, token: "[redacted]" }
        : data,
  }));
}

async function assess(caseId: string, body: Record<string, unknown>) {
  const response = await fetch(`${base}/triage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
  const events = parseSse(await response.text());
  evidence.push({ caseId, events: normalize(events) });
  return { events, cookie };
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

test("real QVAC/WHO/MedPsy restores broad IMCI, confirmation, mhGAP, and abstention", { timeout: 360_000 }, async () => {
  const pneumonia = await assess("pneumonia-confirmed", {
    caseText: "Two-year-old child with cough for three days and fast breathing at 52 breaths per minute, alert and drinking.",
    patientAge: { value: 24, unit: "months" },
    patientWeightKg: 12,
    dangerObservations: ABSENT,
    medicationSafety: {
      allergiesReviewed: "CONFIRMED_NONE",
      contraindicationsReviewed: "CONFIRMED_NONE",
      allergyDetails: [],
      contraindicationDetails: [],
    },
    protocolApplicability: { status: "CONFIRMED_APPLICABLE", details: [] },
  });
  const pneumoniaCard = eventData(pneumonia.events, "card").card;
  const provisional = eventData(pneumonia.events, "provisional");
  assert.equal(pneumoniaCard.reviewState, "PROVISIONAL");
  assert.equal(pneumoniaCard.classification, undefined, "the neutral card does not expose classifier output");
  assert.equal(provisional.classification, "PNEUMONIA");
  assert.equal(provisional.protocol, "IMCI");
  assert.equal(pneumoniaCard.assistance.retrievalMode, "semantic");
  assert.equal("referenceActions" in pneumoniaCard, false);
  assert.deepEqual(pneumonia.events.filter((item) => item.event === "stage").map((item) => item.data.key), [
    "assess", "detect", "retrieve", "reason", "summarize",
  ]);

  const confirmation = await fetch(`${base}/triage/confirm`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: pneumonia.cookie },
    body: JSON.stringify({ token: provisional.token, decision: "CONFIRM" }),
  });
  assert.equal(confirmation.status, 200);
  const confirmed = await confirmation.json();
  assert.equal(confirmed.reviewState, "CONFIRMED");
  assert.equal(confirmed.classification, "PNEUMONIA");
  assert.ok(confirmed.referenceActions);
  assert.equal(confirmed.doseState.status, "AVAILABLE_REFERENCE_BAND");

  const diarrhoea = await assess("imci-diarrhoea", {
    caseText: "Four-year-old child with watery diarrhoea for two days, sunken eyes, restless and irritable, drinks eagerly, skin pinch goes back slowly.",
    patientAge: { value: 48, unit: "months" },
    dangerObservations: ABSENT,
  });
  const diarrhoeaCard = eventData(diarrhoea.events, "card").card;
  const diarrhoeaProvisional = eventData(diarrhoea.events, "provisional");
  assert.equal(diarrhoeaCard.classification, undefined);
  assert.equal(diarrhoeaProvisional.classification, "SOME DEHYDRATION");
  assert.equal(diarrhoeaProvisional.protocol, "IMCI");

  const mhgap = await assess("mhgap-depression", {
    caseText: "Thirty-year-old adult with persistent low mood, loss of interest, low energy, and difficulty functioning for three weeks.",
    patientAge: { value: 30, unit: "years" },
    dangerObservations: ABSENT,
  });
  const mhgapCard = eventData(mhgap.events, "card").card;
  const mhgapProvisional = eventData(mhgap.events, "provisional");
  assert.equal(mhgapCard.classification, undefined);
  assert.equal(mhgapProvisional.classification, "DEPRESSION");
  assert.equal(mhgapProvisional.protocol, "mhGAP");

  const offDomain = await assess("off-domain", {
    caseText: "Explain how to repair a bicycle chain and adjust the rear derailleur.",
    patientAge: { value: 30, unit: "years" },
    dangerObservations: ABSENT,
  });
  const unavailable = eventData(offDomain.events, "card").card;
  assert.equal(unavailable.reviewState, "UNAVAILABLE");
  assert.match(unavailable.uncertainty, /no matching WHO protocol route/i);
  assert.deepEqual(guard.violations, []);
});
