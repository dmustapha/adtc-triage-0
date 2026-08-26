import { test } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";

import { app } from "../src/server.js";
import { setTriageExecutionObserver } from "../src/triage/triage.js";

test("local app serves truthful health and deterministic emergency SSE without QVAC", async () => {
  const server = await new Promise<Server>((ready) => {
    const listener = app.listen(0, () => ready(listener));
  });
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const base = `http://127.0.0.1:${address.port}`;

    const health = await fetch(`${base}/health`);
    const healthBody = await health.json();
    assert.equal(health.status, 200);
    assert.deepEqual(healthBody.residentModels, []);
    assert.equal(healthBody.egress.armed, false);
    assert.equal(healthBody.model.sha256, "41ee947d9cce72ec657577219fd1798fabeabf0d832217fe23c9d6d3d18d5880");

    const appPage = await fetch(`${base}/app`);
    const html = await appPage.text();
    assert.equal(appPage.status, 200);
    assert.match(html, /Run an assessment/);
    assert.doesNotMatch(html, /This ran on the device/);

    const boundaries: string[] = [];
    const restore = setTriageExecutionObserver((boundary) => boundaries.push(boundary));
    try {
      const triage = await fetch(`${base}/triage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          caseText: "free text says the child is well",
          dangerObservations: { cannotDrinkOrBreastfeed: "PRESENT" },
        }),
      });
      const events = await triage.text();
      assert.equal(triage.status, 200);
      assert.match(triage.headers.get("content-type") ?? "", /text\/event-stream/);
      assert.match(events, /event: citation/);
      assert.match(events, /event: card/);
      assert.match(events, /"outcome":"EMERGENCY"/);
      assert.doesNotMatch(events, /"severity"|"redFlags"/);
      assert.match(events, /event: done/);
      assert.deepEqual(boundaries, []);
    } finally {
      restore();
    }
  } finally {
    await new Promise<void>((done) => server.close(() => done()));
  }
});
