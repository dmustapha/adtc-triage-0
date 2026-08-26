import assert from "node:assert/strict";
import test from "node:test";
import { buildQvacEvidence } from "../scripts/submitted-prompt-evidence/qvac-harness.js";

test("QVAC evidence preserves the two exact prompts and keeps product-plane provenance separate", () => {
  const prompts = [
    { promptId: "tp_001", prompt: "exact prompt one", sha256: "hash-one" },
    { promptId: "tp_002", prompt: "exact prompt two", sha256: "hash-two" },
  ];
  const evidence = buildQvacEvidence({
    prompts,
    outputs: [
      { promptId: "tp_001", text: "output one", stats: { generatedTokens: 8, tokensPerSecond: 4 } },
      { promptId: "tp_002", text: "output two", stats: { generatedTokens: 9, tokensPerSecond: 5 } },
    ],
    sdkVersion: "0.13.3",
    hostLabel: "Apple development host",
    model: { bytes: 1, sha256: "model-hash", path: "/model.gguf" },
  });

  assert.equal(evidence.plane, "QVAC product runtime");
  assert.equal(evidence.runtime.sdkVersion, "0.13.3");
  assert.deepEqual(evidence.rows.map((row) => row.rawPrompt), ["exact prompt one", "exact prompt two"]);
  assert.deepEqual(evidence.rows.map((row) => row.rawOutput), ["output one", "output two"]);
  assert.ok(evidence.rows.every((row) => row.retrievalMode === "not-applicable"));
});
