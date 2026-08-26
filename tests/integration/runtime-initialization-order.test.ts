import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";

const { app } = await import("../../src/server.js");
const { orchestrator } = await import("../../src/qvac/orchestrator.js");

let server: { address(): { port: number } | string | null; close(): void };
let base = "";

before(async () => {
  await new Promise<void>((ready) => {
    server = app.listen(0, () => ready()) as never;
  });
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

after(() => server?.close());

const allAbsent = Object.fromEntries([
  "cannotDrinkOrBreastfeed",
  "vomitsEverything",
  "convulsions",
  "lethargicOrUnconscious",
  "chestIndrawing",
  "stridorWhenCalm",
  "lowOxygenOrCentralCyanosis",
].map((key) => [key, "ABSENT"]));

test("a failed MedPsy request initialization never starts the embeddings runtime", async () => {
  const runtime = orchestrator as unknown as {
    getMedpsy(): Promise<string>;
    getEmbeddings(): Promise<string>;
  };
  const originalMedpsy = runtime.getMedpsy;
  const originalEmbeddings = runtime.getEmbeddings;
  let embeddingCalls = 0;

  runtime.getMedpsy = async () => { throw new Error("missing MedPsy fixture"); };
  runtime.getEmbeddings = async () => {
    embeddingCalls += 1;
    return "unexpected-embedding-model";
  };

  try {
    const response = await fetch(`${base}/triage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caseText: "2-year-old with cough for three days, alert and drinking",
        patientAge: { value: 24, unit: "months" },
        dangerObservations: allAbsent,
        respiratoryAssessment: {
          coughOrDifficultBreathing: "PRESENT",
          respiratoryRatePerMinute: 32,
          rateCountQuality: "ONE_MINUTE_WHILE_CALM",
        },
      }),
    });
    const stream = await response.text();

    assert.match(stream, /event: card/);
    assert.match(stream, /"outcome":"NO_ESCALATION_CRITERION_RECORDED"/);
    assert.match(stream, /"assistance":\{"status":"UNAVAILABLE"/);
    assert.doesNotMatch(stream, /event: error/);
    assert.equal(embeddingCalls, 0, "embedding acquisition must wait for successful MedPsy initialization");
  } finally {
    runtime.getMedpsy = originalMedpsy;
    runtime.getEmbeddings = originalEmbeddings;
  }
});

test("startup prewarm initializes MedPsy before requesting embeddings", async () => {
  const source = await readFile("src/server.ts", "utf8");
  const start = source.indexOf("export function startServer");
  const end = source.indexOf("// Run directly", start);
  assert.ok(start >= 0 && end > start, "startServer source is present");

  const prewarm = source.slice(start, end);
  assert.doesNotMatch(
    prewarm,
    /Promise\.all\(\[orchestrator\.getMedpsy\(\),\s*orchestrator\.getEmbeddings\(\)\]\)/,
    "startup must not launch the embedding download beside a MedPsy load that can fail",
  );
  assert.ok(
    prewarm.indexOf("orchestrator.getMedpsy()") < prewarm.indexOf("orchestrator.getEmbeddings()"),
    "startup must await MedPsy before requesting embeddings",
  );
  assert.match(prewarm, /server\.once\("close"[\s\S]*removeListener\("unhandledRejection"[\s\S]*removeListener\("uncaughtException"/);
});

test("documented fallback mode does not acquire the optional embeddings runtime", async () => {
  const source = await readFile("src/server.ts", "utf8");
  const contextStart = source.indexOf("async function triageContext");
  const contextEnd = source.indexOf("// ── GET /health", contextStart);
  const context = source.slice(contextStart, contextEnd);
  assert.match(context, /config\.residentMode === "fallback"\s*\?\s*undefined\s*:\s*await orchestrator\.getEmbeddings\(\)/);

  const start = source.indexOf("export function startServer");
  const end = source.indexOf("// Run directly", start);
  const prewarm = source.slice(start, end);
  assert.match(prewarm, /config\.residentMode === "fallback"\s*\?\s*undefined\s*:\s*await orchestrator\.getEmbeddings\(\)/);
});

test("ordinary prompt assistance acquires MedPsy without the clinical embeddings runtime", async () => {
  const source = await readFile("src/server.ts", "utf8");
  const runnerStart = source.indexOf("promptRunner: {");
  const runnerEnd = source.indexOf("confirmationStore,", runnerStart);
  const runner = source.slice(runnerStart, runnerEnd);
  assert.match(runner, /orchestrator\.getMedpsy\(/);
  assert.doesNotMatch(runner, /triageContext\(|getEmbeddings\(/);
});
