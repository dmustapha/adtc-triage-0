import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
// @ts-expect-error jsdom does not bundle declarations in this workspace.
import { JSDOM } from "jsdom";

const root = new URL("../../", import.meta.url);
const html = readFileSync(new URL("public/app.html", root), "utf8");
const page = new JSDOM(html).window.document;
const metadata = JSON.parse(readFileSync(new URL("metadata.json", root), "utf8")) as {
  test_prompts: Array<{ prompt: string }>;
};

function publicScriptSources(): string[] {
  const scripts = new URL("public/assets/js/", root);
  return readdirSync(scripts)
    .filter((name) => name.endsWith(".js"))
    .map((name) => readFileSync(new URL(name, scripts), "utf8"));
}

test("the public workflow has one input, one action, and no visible modes", () => {
  assert.equal(page.querySelectorAll('[role="tablist"], .mode-tab').length, 0);
  assert.equal(page.querySelectorAll("textarea[data-unified-input]").length, 1);
  assert.equal(page.querySelectorAll("[data-unified-submit]").length, 1);
  assert.equal(page.querySelectorAll("#promptExample1, #promptExample2").length, 0);
  assert.doesNotMatch(page.body.textContent ?? "", /Use submitted Prompt [12]/i);
});

test("submitted prompt bytes never appear in the public shell or scripts", () => {
  const publicSources = [html, ...publicScriptSources()];
  assert.equal(metadata.test_prompts.length, 2);
  for (const { prompt } of metadata.test_prompts) {
    for (const source of publicSources) assert.equal(source.includes(prompt), false);
  }
});
