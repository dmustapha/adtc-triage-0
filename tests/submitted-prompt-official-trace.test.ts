import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";

import {
  captureOfficialAttempt,
  officialGreedySampling,
  officialServerCommand,
  selectOfficialCases,
  stopOfficialServer,
} from "../scripts/submitted-prompt-evidence/official-product-harness.js";

test("official application requests use the minimal deterministic sampler chain", () => {
  assert.deepEqual(officialGreedySampling(), { temperature: 0, samplers: ["temperature"] });
});

test("official application server is CPU-only, loopback-only, and disables learned reasoning", () => {
  const command = officialServerCommand("/tmp/llama-server", "/tmp/model.gguf", 49173);
  assert.deepEqual(command.slice(1, 7), ["-m", "/tmp/model.gguf", "-t", "4", "-ngl", "0"]);
  assert.deepEqual(command.slice(command.indexOf("--host"), command.indexOf("--host") + 4), [
    "--host", "127.0.0.1", "--port", "49173",
  ]);
  assert.deepEqual(command.slice(command.indexOf("--reasoning-budget"), command.indexOf("--reasoning-budget") + 2), [
    "--reasoning-budget", "0",
  ]);
});

test("forced official shutdown cannot miss a synchronous close event", async () => {
  class FakeChild extends EventEmitter {
    exitCode: number | null = null;
    kill(signal: NodeJS.Signals) {
      if (signal === "SIGKILL") {
        this.exitCode = 137;
        this.emit("close", 137);
      }
      return true;
    }
  }
  const child = new FakeChild();
  const graceful = await stopOfficialServer(child as never, 1);
  assert.equal(graceful, false);
  assert.equal(child.exitCode, 137);
});

test("official attempt capture preserves successful trace projection", async () => {
  const traces: any[] = [];
  const ticks = [10, 35];
  const value = await captureOfficialAttempt({
    traces,
    base: { phase: "assist-extract", requestSha256: "request" },
    operation: async () => ({ text: "safe" }),
    success: (result, durationMs) => ({ responseSha256: result.text, durationMs }),
    now: () => ticks.shift() ?? 35,
  });
  assert.deepEqual(value, { text: "safe" });
  assert.deepEqual(traces, [{ phase: "assist-extract", requestSha256: "request", responseSha256: "safe", durationMs: 25 }]);
});

test("official attempt capture records timeout before rethrowing", async () => {
  const traces: any[] = [];
  const ticks = [100, 280];
  await assert.rejects(captureOfficialAttempt({
    traces,
    base: { phase: "assist-reason", requestSha256: "request" },
    operation: async () => { throw new DOMException("timed out", "TimeoutError"); },
    success: () => ({}),
    now: () => ticks.shift() ?? 280,
  }), /timed out/);
  assert.deepEqual(traces, [{
    phase: "assist-reason",
    requestSha256: "request",
    responseSha256: null,
    rawOutput: null,
    durationMs: 180,
    generatedTokens: null,
    tokensPerSecond: null,
    error: { name: "TimeoutError", timedOut: true },
  }]);
});

test("official case selection supports a bounded prompt-specific diagnostic", () => {
  const cases = [
    { promptId: "tp_001", repeat: 1 },
    { promptId: "tp_001", repeat: 2 },
    { promptId: "tp_002", repeat: 1 },
    { promptId: "tp_002", repeat: 2 },
  ];
  assert.deepEqual(selectOfficialCases(cases, { promptId: "tp_002", limit: 1 }), [{ promptId: "tp_002", repeat: 1 }]);
});
