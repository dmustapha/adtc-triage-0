import assert from "node:assert/strict";
import test from "node:test";

import { InferenceQueue } from "../../src/qvac/inference-queue.js";
import { ConfirmationStore } from "../../src/triage/confirmation.js";
import { ContinuationStore } from "../../src/triage/continuation.js";
import { projectReferenceActions } from "../../src/triage/reference-actions.js";
import { createSupervisedWorkflow } from "../../src/triage/supervised-workflow.js";
import { createRestoredApp } from "../../src/http/create-app.js";

const ABSENT = {
  cannotDrinkOrBreastfeed: "ABSENT", vomitsEverything: "ABSENT", convulsions: "ABSENT",
  lethargicOrUnconscious: "ABSENT", chestIndrawing: "ABSENT", stridorWhenCalm: "ABSENT",
  lowOxygenOrCentralCyanosis: "ABSENT",
} as const;

const body = {
  caseText: "Two year old with cough for three days, alert and drinking.",
  patientAge: { value: 24, unit: "months" },
  patientWeightKg: 12,
  dangerObservations: ABSENT,
  respiratoryAssessment: {
    coughOrDifficultBreathing: "PRESENT", respiratoryRatePerMinute: 40,
    rateCountQuality: "ONE_MINUTE_WHILE_CALM",
  },
  medicationSafety: {
    allergiesReviewed: "CONFIRMED_NONE", contraindicationsReviewed: "CONFIRMED_NONE",
    allergyDetails: [], contraindicationDetails: [],
  },
  protocolApplicability: { status: "CONFIRMED_APPLICABLE", details: [] },
};

function parseEvents(text: string) {
  return text.split("\n\n").filter(Boolean).map((block) => ({
    event: block.match(/^event: (.+)$/m)?.[1],
    data: JSON.parse(block.match(/^data: (.+)$/m)?.[1] ?? "{}"),
  }));
}

async function fixture(inferenceQueue = new InferenceQueue({ idFactory: () => "continuation-job" })) {
  const calls: string[] = [];
  let owner = "browser-a";
  const confirmationStore = new ConfirmationStore({ randomToken: () => "confirm-token" });
  const continuationStore = new ContinuationStore({ randomToken: () => "continue-token" });
  const hit = {
    id: "IMCI|p6|pneumonia", text: "PNEUMONIA Give oral Amoxicillin for 5 days", score: 0.9,
    mode: "semantic", source_ref: "IMCI p.6", protocol: "IMCI",
    citation: { protocol: "IMCI", title: "WHO IMCI Chart Booklet (2014)", page: 6, section: "PNEUMONIA" },
  } as const;
  const workflow = createSupervisedWorkflow({
    getContext: async () => { calls.push("context"); return { medpsyId: "medpsy", embedId: "embed" }; },
    routeCase: async () => { calls.push("route"); return { shortlist: [{ cls: "PNEUMONIA", score: 0.9 }], best: 0.9, offDomain: false }; },
    retrieveGrounding: async () => { calls.push("retrieval"); return { groundedHits: [hit], topHits: [hit], retrieval: "semantic" as const }; },
    triageFromHits: async (_text, _hits, _context, options) => {
      calls.push("model"); options.onReasonDelta?.("first");
      return {
        classification: "PNEUMONIA", attempts: 1, retrieval: "semantic" as const, citationChunk: hit,
        card: { severity: "URGENT" as const, action: "private", protocol_citation: { doc: "private", page: 6, section: "private" }, reasoning: "private", red_flags: [] },
      };
    },
    confirmationStore,
    continuationStore,
    policyVersion: "restored-workflow-v1",
  });
  const app = createRestoredApp({
    supervisedWorkflow: workflow,
    promptRunner: { run: async () => ({ status: "UNAVAILABLE" }) },
    confirmationStore,
    projectReferenceActions,
    inferenceQueue,
    sessionOwner: () => owner,
  });
  const server = await new Promise<any>((resolve) => { const active = app.listen(0, () => resolve(active)); });
  return {
    base: `http://127.0.0.1:${server.address().port}`, server, calls,
    setOwner(next: string) { owner = next; },
  };
}

const post = (url: string, value: unknown) => fetch(url, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value),
});

test("initial respiratory result is model-free, emits a separate grant, then continuation and confirmation complete the plan", async (t) => {
  const f = await fixture();
  t.after(() => f.server.close());

  const initialResponse = await post(`${f.base}/triage`, body);
  assert.equal(initialResponse.status, 200);
  assert.match(initialResponse.headers.get("cache-control") ?? "", /no-store/);
  const initial = parseEvents(await initialResponse.text());
  assert.deepEqual(initial.map((event) => event.event), ["stage", "citation", "card", "continuation", "done"]);
  assert.deepEqual(f.calls, []);
  assert.equal(initial.find((event) => event.event === "card")?.data.card.classification, undefined);
  assert.equal(initial.find((event) => event.event === "continuation")?.data.token, "continue-token");

  const continuedResponse = await post(`${f.base}/triage/continue`, { token: "continue-token" });
  assert.equal(continuedResponse.status, 200);
  assert.match(continuedResponse.headers.get("cache-control") ?? "", /no-store/);
  const continued = parseEvents(await continuedResponse.text());
  assert.equal(continued[0]?.event, "job");
  assert.ok(continued.some((event) => event.event === "citation"));
  assert.ok(continued.some((event) => event.event === "first_token"));
  assert.equal(continued.find((event) => event.event === "provisional")?.data.classification, "PNEUMONIA");
  assert.equal(continued.some((event) => event.event === "plan"), false);
  assert.deepEqual(f.calls, ["context", "route", "retrieval", "model"]);

  const confirmation = await post(`${f.base}/triage/confirm`, { token: "confirm-token", decision: "CONFIRM" });
  assert.equal(confirmation.status, 200);
  assert.match(confirmation.headers.get("cache-control") ?? "", /no-store/);
  const confirmed = await confirmation.json();
  assert.equal(confirmed.classification, "PNEUMONIA");
  assert.equal(confirmed.severity, "URGENT");
  assert.equal(confirmed.immediateAction.text, "Give oral Amoxicillin for 5 days");
  assert.equal(confirmed.referenceActions.medicines[0].bands.length, 3);
  assert.equal(confirmed.referenceActions.medicines[0].selectedBand.band, "12 months up to 3 years (10 - <14 kg)");
  assert.equal(confirmed.referenceActions.follow_up.detailCitation.page, 32);
});

test("confirmed emergency enters triage but never crosses model, retrieval, or QVAC boundaries", async (t) => {
  const f = await fixture();
  t.after(() => f.server.close());
  const response = await post(`${f.base}/triage`, {
    caseText: "Two year old child cannot drink or breastfeed.",
    patientAge: { value: 2, unit: "years" },
    dangerObservations: { ...ABSENT, cannotDrinkOrBreastfeed: "PRESENT" },
    medicationSafety: {
      allergiesReviewed: "NOT_ASSESSED", contraindicationsReviewed: "NOT_ASSESSED",
      allergyDetails: [], contraindicationDetails: [],
    },
    protocolApplicability: { status: "NOT_ASSESSED", details: [] },
  });
  assert.equal(response.status, 200);
  const events = parseEvents(await response.text());
  assert.equal(events.find((event) => event.event === "card")?.data.card.outcome, "EMERGENCY");
  assert.deepEqual(f.calls, []);
});

test("reviewed structured authority conflicts return exact correction fields before inference", async (t) => {
  const f = await fixture();
  t.after(() => f.server.close());
  const response = await post(`${f.base}/triage`, {
    ...body,
    caseText: "Two year old child with cough, breathing 32 per minute, and no chest indrawing.",
    patientAge: { value: 3, unit: "years" },
    dangerObservations: { ...ABSENT, chestIndrawing: "PRESENT" },
  });
  assert.equal(response.status, 409);
  const result = await response.json();
  assert.deepEqual(result.conflicts, [
    "patientAge",
    "chestIndrawing",
    "respiratoryAssessment.respiratoryRatePerMinute",
  ]);
  assert.deepEqual(f.calls, []);
});

test("continuation validates token-only input before queue admission and fails closed by owner/replay", async (t) => {
  const f = await fixture();
  t.after(() => f.server.close());
  await post(`${f.base}/triage`, body);

  assert.equal((await post(`${f.base}/triage/continue`, { token: "continue-token", classification: "MALARIA" })).status, 400);
  assert.deepEqual(f.calls, []);
  f.setOwner("browser-b");
  assert.equal((await post(`${f.base}/triage/continue`, { token: "continue-token" })).status, 403);
  assert.deepEqual(f.calls, []);
  f.setOwner("browser-a");
  assert.equal((await post(`${f.base}/triage/continue`, { token: "continue-token" })).status, 200);
  assert.equal((await post(`${f.base}/triage/continue`, { token: "continue-token" })).status, 409);
});

test("confirmation owner mismatch, rejection, and replay never expose source actions", async (t) => {
  const f = await fixture();
  t.after(() => f.server.close());
  await post(`${f.base}/triage`, body);
  await post(`${f.base}/triage/continue`, { token: "continue-token" });

  f.setOwner("browser-b");
  const mismatch = await post(`${f.base}/triage/confirm`, { token: "confirm-token", decision: "CONFIRM" });
  assert.equal(mismatch.status, 403);
  assert.equal("referenceActions" in await mismatch.json(), false);

  f.setOwner("browser-a");
  const rejected = await post(`${f.base}/triage/confirm`, { token: "confirm-token", decision: "REJECT" });
  assert.equal(rejected.status, 200);
  assert.deepEqual(await rejected.json(), { reviewState: "REJECTED" });
  const replay = await post(`${f.base}/triage/confirm`, { token: "confirm-token", decision: "CONFIRM" });
  assert.equal(replay.status, 409);
  assert.equal("referenceActions" in await replay.json(), false);
});

test("retryable queue saturation releases the reservation so the same continuation grant can retry", async (t) => {
  let release!: () => void;
  let id = 0;
  const queue = new InferenceQueue({ maxPending: 0, idFactory: () => `retry-job-${++id}` });
  const blocker = queue.submit("other", "assist", () => new Promise<void>((resolve) => { release = resolve; }));
  await new Promise((resolve) => setImmediate(resolve));
  const f = await fixture(queue);
  t.after(() => f.server.close());
  await post(`${f.base}/triage`, body);

  const saturated = await post(`${f.base}/triage/continue`, { token: "continue-token" });
  assert.equal(saturated.status, 429);
  assert.equal((await saturated.json()).retryable, true);

  release();
  await blocker.promise;
  const retry = await post(`${f.base}/triage/continue`, { token: "continue-token" });
  assert.equal(retry.status, 200);
  assert.match(await retry.text(), /event: provisional/);
});
