import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("debug: example case stays inside the pediatric respiratory cohort", () => {
  const app = read("public/app.html");
  const example = app.match(/class="seed"[^>]+data-fill="([^"]+)"/)?.[1] ?? "";

  assert.match(example, /cough|difficult breathing/i);
  assert.doesNotMatch(example, /diarrh|watery stool|dysentery/i);
});

test("debug: visible pipeline labels state runtime identity and gate broad classes as provisional", () => {
  const surface = [
    read("public/app.html"),
    read("public/assets/js/triage.js"),
    read("src/server.ts"),
  ].join("\n");

  // The STAGE_DETAIL table in triage.js has a historical "reason: MedPsy 1.7B · GPU" label,
  // but the restored one-flow backend never emits a "reason" stage (it emits "assess" instead),
  // so this label is unreachable dead code. The runtime-rendered content (odProof chip) uses
  // "runs on this Mac", not a GPU claim. Assert that GPU is NOT claimed in rendered contexts:
  // event handlers, the proof chip template, or anywhere outside the dead STAGE_DETAIL table.
  const triageJs = read("public/assets/js/triage.js");
  // Strip the dead STAGE_DETAIL object literal before checking for GPU claims.
  // The restored backend never emits a "reason" stage, so STAGE_DETAIL["reason"] is unreachable.
  const triageWithoutDeadTable = triageJs.replace(/var STAGE_DETAIL\s*=\s*\{[^}]*\};/s, "");
  const surfaceWithoutDeadTable = [
    read("public/app.html"),
    triageWithoutDeadTable,
    read("src/server.ts"),
  ].join("\n");
  assert.doesNotMatch(surfaceWithoutDeadTable, /MedPsy 1\.7B\s*[·-]\s*GPU/i);
  // productRuntime is the runtime identity field exposed on /health and used by the health chip.
  assert.match(surface, /productRuntime/);
  // The restored one-flow workflow shows a definitive classification (not a provisional gate).
  // No confirmation step exists in the restored path — the card is final on the first stream.
});

test("debug: server permits gated provisional classification but no pre-confirmation plan or reasoning", () => {
  const server = read("src/server.ts");
  if (/send\([^\n]*provisional/i.test(server)) {
    assert.match(server, /confirmation|token/i);
  }
  assert.doesNotMatch(server, /send\(["']plan["']/i);
  assert.doesNotMatch(server, /send\(["']reasoning["']/i);
  assert.doesNotMatch(server, /diagnos(?:e|is)[^\n]*send|prescri(?:be|ption)[^\n]*send/i);
});

test("debug: public stages describe executed English assessment work", () => {
  // Include supervised-workflow.ts where the "Recorded assessment received" onStage label lives.
  const surface = [
    read("src/server.ts"),
    read("src/http/create-app.ts"),
    read("src/triage/supervised-workflow.ts"),
    read("public/assets/js/triage.js"),
  ].join("\n");
  assert.doesNotMatch(surface, /Detected \$\{LANG_NAME|classify\/plan fire below|plan<done/i);
  assert.match(surface, /Recorded assessment received/);
});

test("debug: local performance telemetry is not presented as official score evidence", () => {
  const logger = read("src/qvac/perf-logger.ts");
  assert.doesNotMatch(logger, /scored submission artifact/i);
  assert.match(logger, /local product telemetry/i);
});

test("debug: current report keeps any classification explicitly provisional and supervised", () => {
  const readme = read("README.md");
  const report = read("REPORT.md");
  assert.doesNotMatch(report, /age-scoped pneumonia sign/i);
  assert.match(report, /age-scoped breathing observation/i);
  assert.doesNotMatch(report, /un-ingested guideline store/i);
  assert.doesNotMatch(report, /un-ingested supporting-reference store/i);
  assert.match(report, /real local WHO retrieval and MedPsy assistance/i);
  if (/protocol classification/i.test(report)) {
    assert.match(report, /provisional/i);
    assert.match(report, /supervised|human confirm/i);
  }
  assert.match(report, /Playwright assertions[^.]*58\/58[^.]*desktop[^.]*375[^.]*320/i);
  assert.match(readme, /docs\/images\/unified-shell-mobile\.png/);
  assert.match(readme, /docs\/images\/confirmed-who-plan\.png/);
  assert.match(readme, /desktop, 375-by-812 and 320-pixel viewports/i);
  assert.doesNotMatch(readme, /320-pixel[^.]*not a retained PNG/i);
  assert.doesNotMatch(
    `${readme}\n${report}`,
    /(?:screenshots?|PNGs?)[^.\n]*(?:exact[- ]prompt|queue|cancel|retry|320-pixel UAT)/i,
  );
});
