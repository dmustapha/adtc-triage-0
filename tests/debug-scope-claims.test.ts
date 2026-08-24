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

test("debug: visible pipeline labels state runtime identity without invented backend or broad-class counts", () => {
  const surface = [
    read("public/app.html"),
    read("public/assets/js/triage.js"),
    read("src/server.ts"),
  ].join("\n");

  assert.doesNotMatch(surface, /MedPsy 1\.7B\s*[·-]\s*GPU/i);
  assert.doesNotMatch(surface, /1 (?:of|sur|de) 27 (?:WHO|classes|clases)/i);
  assert.match(surface, /QVAC SDK 0\.13\.3\s*[·-]\s*on-device/i);
});
