import assert from "node:assert/strict";
import test from "node:test";

import { InferenceQueue } from "../../src/qvac/inference-queue.js";
import { createApp } from "../../src/server.js";

const ABSENT = Object.fromEntries([
  "cannotDrinkOrBreastfeed", "vomitsEverything", "convulsions", "lethargicOrUnconscious",
  "chestIndrawing", "stridorWhenCalm", "lowOxygenOrCentralCyanosis",
].map((key) => [key, "ABSENT"]));

const body = {
  caseText: "Two year old with cough for three days.",
  patientAge: { value: 24, unit: "months" },
  dangerObservations: ABSENT,
  respiratoryAssessment: {
    coughOrDifficultBreathing: "PRESENT",
    respiratoryRatePerMinute: 32,
    rateCountQuality: "ONE_MINUTE_WHILE_CALM",
  },
};

function events(text: string) {
  return text.split("\n\n").filter(Boolean).map((block) => ({
    event: block.match(/^event: (.+)$/m)?.[1],
    data: JSON.parse(block.match(/^data: (.+)$/m)?.[1] ?? "{}"),
  }));
}

async function fixture() {
  let token = 0;
  const workflow = {
    async assess() {
      token += 1;
      return {
        reviewState: "PROVISIONAL", classification: "PNEUMONIA", protocol: "IMCI",
        recordedFacts: ["patientAge: 24 months"], inferredFacts: [],
        uncertainty: "Provisional WHO protocol classification, not a diagnosis.",
        severity: "URGENT", redFlags: ["must-not-leak"], internalSecret: "must-not-leak",
        plan: { medicines: [{ name: "must-not-leak" }] },
        citations: [{ doc: "WHO IMCI Chart Booklet (2014)", page: 6 }],
        confirmation: { eligible: true, token: `token-${token}`, expiresAt: "2026-08-25T17:00:00.000Z", missingFields: [] },
      };
    },
  };
  const app = createApp({
    supervisedWorkflow: workflow,
    promptRunner: { run: async () => ({ status: "UNAVAILABLE", answer: null }) },
    confirmationStore: { consume: () => ({ ok: false, reason: "NOT_FOUND" }) },
    projectReferenceActions: () => ({ referenceActions: null, doseState: { status: "NOT_APPLICABLE", missingFields: [] } }),
    inferenceQueue: new InferenceQueue({ idFactory: (() => { let id = 0; return () => `job-${++id}`; })() }),
  } as any);
  const server = await new Promise<any>((resolve) => {
    const listening = app.listen(0, () => resolve(listening));
  });
  const port = server.address().port;
  return { base: `http://127.0.0.1:${port}`, server };
}

test("/triage rejects invalid and conflicting records before opening SSE", async (t) => {
  const f = await fixture();
  t.after(() => f.server.close());
  const invalid = await fetch(`${f.base}/triage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseText: "" }) });
  assert.equal(invalid.status, 400);
  assert.doesNotMatch(invalid.headers.get("content-type") ?? "", /event-stream/);

  const conflict = await fetch(`${f.base}/triage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, caseText: "Three year old with cough for three days." }),
  });
  assert.equal(conflict.status, 409);
  assert.doesNotMatch(conflict.headers.get("content-type") ?? "", /event-stream/);

  const invisible = await fetch(`${f.base}/triage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, caseText: "Two year old with cough\u0000hidden text." }),
  });
  assert.equal(invisible.status, 400);
});

test("/triage emits additive events in order and no pre-confirmation plan", async (t) => {
  const f = await fixture();
  t.after(() => f.server.close());
  const response = await fetch(`${f.base}/triage`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /text\/event-stream/);
  const stream = events(await response.text());
  assert.deepEqual(stream.map((item) => item.event), ["job", "stage", "citation", "card", "provisional", "done"]);
  assert.equal(stream.some((item) => item.event === "plan"), false);
  assert.equal(stream.find((item) => item.event === "provisional")?.data.token, "token-1");
  const publicCard = stream.find((item) => item.event === "card")?.data.card;
  assert.equal(publicCard.severity, undefined);
  assert.equal(publicCard.redFlags, undefined);
  assert.equal(publicCard.internalSecret, undefined);
  assert.equal(publicCard.plan, undefined);
});

test("retrying a completed assessment receives a new job and confirmation token", async (t) => {
  const f = await fixture();
  t.after(() => f.server.close());
  const run = async () => events(await (await fetch(`${f.base}/triage`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  })).text());
  const first = await run();
  const second = await run();
  assert.notEqual(first[0]?.data.id, second[0]?.data.id);
  assert.notEqual(first.find((item) => item.event === "provisional")?.data.token, second.find((item) => item.event === "provisional")?.data.token);
});
