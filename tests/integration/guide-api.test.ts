import assert from "node:assert/strict";
import test from "node:test";
import { createRestoredApp } from "../../src/http/create-app.js";

function collectSse(text: string) {
  return text.split("\n\n").filter(Boolean).map((block) => ({
    event: (block.match(/^event: (.*)$/m) || [])[1],
    data: JSON.parse((block.match(/^data: (.*)$/m) || [])[1] || "{}"),
  }));
}

const deps = {
  supervisedWorkflow: {
    guide: async (_input: unknown, o: any) => {
      o.onStage?.({ key: "reason", label: "Reasoning on-device" });
      o.onCitation?.({ doc: "WHO IMCI Chart Booklet (2014)", page: 6, section: "Pneumonia", protocol: "IMCI" });
      o.onFirstToken?.();
      return {
        classification: "PNEUMONIA",
        retrieval: "semantic",
        card: {
          severity: "URGENT",
          action: "Give oral Amoxicillin",
          reasoning: "fast breathing",
          protocol_citation: { doc: "WHO IMCI Chart Booklet (2014)", page: 6, section: "Pneumonia" },
          red_flags: [],
          confidence: "high",
          plan: {
            medicines: [{ name: "Amoxicillin", citation: { doc: "WHO IMCI Chart Booklet (2014)", page: 6 } }],
            supportive: [],
            home_care: [],
            return_now: [],
            follow_up: null,
            referral: null,
          },
        },
      };
    },
    // Stub out assess and deterministic so old routes don't break
    assess: async () => ({ reviewState: "UNAVAILABLE", uncertainty: "stub" }),
    deterministic: () => null,
  },
  inferenceQueue: {
    submit: (_o: string, _k: string, run: any) => ({
      id: "j1",
      position: 0,
      promise: run({ signal: undefined, publish: (f: any) => f() }),
      disconnect() {},
    }),
    status: () => null,
    cancel: () => {},
  },
  promptRunner: { run: async () => ({}) },
  confirmationStore: { consume: () => ({ ok: false }) },
  projectReferenceActions: () => ({}),
  performance: () => null,
};

async function fixture() {
  const app = createRestoredApp(deps as any);
  const server = await new Promise<any>((resolve) => {
    const listening = app.listen(0, () => resolve(listening));
  });
  const port = server.address().port;
  return { base: `http://127.0.0.1:${port}`, server };
}

test("POST /triage streams job → stage → citation → card → plan → done", async (t) => {
  const f = await fixture();
  t.after(() => f.server.close());

  const response = await fetch(`${f.base}/triage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ caseText: "2 year old, cough, breathing fast 52, alert and drinking" }),
  });

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /text\/event-stream/);

  const text = await response.text();
  const events = collectSse(text);
  const eventNames = events.map((e) => e.event);

  assert.ok(eventNames.includes("card"), "must emit card");
  assert.ok(eventNames.includes("plan"), "must emit plan");
  assert.ok(eventNames.indexOf("card") < eventNames.indexOf("plan"), "card must come before plan");
  assert.ok(!eventNames.includes("provisional"), "must NOT emit provisional");
  assert.ok(!eventNames.includes("continuation"), "must NOT emit continuation");

  const cardEvent = events.find((e) => e.event === "card")!;
  assert.equal(cardEvent.data.card.severity, "URGENT");
  assert.equal(cardEvent.data.classification, "PNEUMONIA");
  assert.equal(cardEvent.data.card.translated, false);
  assert.equal(cardEvent.data.card.source_language, "en");
  assert.equal(cardEvent.data.card.plan, undefined, "card event must NOT include the plan field");
});

test("POST /triage returns 400 for missing caseText", async (t) => {
  const f = await fixture();
  t.after(() => f.server.close());

  const response = await fetch(`${f.base}/triage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  assert.equal(response.status, 400);
  assert.doesNotMatch(response.headers.get("content-type") ?? "", /event-stream/);
});
