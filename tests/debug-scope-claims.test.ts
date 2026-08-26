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

  assert.doesNotMatch(surface, /MedPsy 1\.7B\s*[·-]\s*GPU/i);
  assert.match(surface, /QVAC SDK 0\.13\.3\s*[·-]\s*on-device/i);
  if (/classification/i.test(surface)) {
    assert.match(surface, /provisional WHO protocol classification/i);
    assert.match(surface, /confirm/i);
  }
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
  const surface = `${read("src/server.ts")}\n${read("src/http/create-app.ts")}\n${read("public/assets/js/triage.js")}`;
  assert.doesNotMatch(surface, /Detected \$\{LANG_NAME|classify\/plan fire below|plan<done/i);
  assert.match(surface, /Recorded assessment received/);
});

test("debug: local performance telemetry is not presented as official score evidence", () => {
  const logger = read("src/qvac/perf-logger.ts");
  assert.doesNotMatch(logger, /scored submission artifact/i);
  assert.match(logger, /local product telemetry/i);
});

test("debug: current report keeps any classification explicitly provisional and supervised", () => {
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
});
