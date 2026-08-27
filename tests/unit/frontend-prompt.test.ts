import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
// @ts-expect-error jsdom does not bundle declarations in this workspace.
import { JSDOM } from "jsdom";

const root = new URL("../../", import.meta.url);
const html = readFileSync(new URL("public/app.html", root), "utf8");
const source = readFileSync(new URL("public/assets/js/triage.js", root), "utf8");
const metadata = JSON.parse(readFileSync(new URL("metadata.json", root), "utf8"));
const prompts = metadata.test_prompts.map((entry: { prompt: string }) => entry.prompt);
const promptIds = metadata.test_prompts.map((entry: { prompt_id: string }) => entry.prompt_id);
const dom = new JSDOM(html, { url: "http://localhost:3010/app" });
const page = dom.window.document;
const requests: Array<{ url: string; init?: RequestInit }> = [];
const globals = globalThis as Record<string, unknown>;
globals.window = dom.window;
globals.document = page;
(dom.window as any).matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
(dom.window as any).HTMLElement.prototype.scrollIntoView = function () {};

function sseAnswer(answer = "Safe local answer.") {
  const body = `event: answer\ndata: ${JSON.stringify({ answer, uncertainty: [], limitations: [] })}\n\nevent: done\ndata: {}\n\n`;
  return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

globals.fetch = async (url: string, init?: RequestInit) => {
  if (url === "/health") return new Response(JSON.stringify({ ready: true, chunks: 994, egress: {} }));
  requests.push({ url, init });
  return sseAnswer();
};
const require = createRequire(import.meta.url);
(dom.window as any).TriageUnifiedInput = require("../../public/assets/js/unified-input.js");
const frontend = require("../../public/assets/js/triage.js") as {
  runUnified(): Promise<void>;
  handleUnifiedInput(): void;
};
const input = page.getElementById("case") as HTMLTextAreaElement;

async function submit(text: string) {
  input.value = text;
  frontend.handleUnifiedInput();
  await frontend.runUnified();
}

test("submitted prompts load from metadata and are pasted through the unified input", async () => {
  assert.equal(prompts.length, 2);
  assert.equal(page.querySelector("#promptExample1, #promptExample2, #ordinaryPrompt"), null);
  requests.length = 0;
  for (const prompt of prompts) await submit(prompt);
  assert.deepEqual(requests.map((request) => request.url), ["/assist", "/assist"]);
  assert.deepEqual(requests.map((request) => JSON.parse(String(request.init?.body)).prompt), prompts);
  const publicState = html + requests.map((request) => String(request.init?.body)).join("");
  for (const id of promptIds) assert.doesNotMatch(publicState, new RegExp(id, "i"));
  assert.doesNotMatch(publicState, /prompt[_-]?(?:id|hash)/i);
});

test("general input uses only assist and renders in the shared result", async () => {
  requests.length = 0;
  await submit("Explain why careful observation matters.");
  assert.deepEqual(requests.map((request) => request.url), ["/assist"]);
  assert.equal(page.getElementById("result")?.classList.contains("hidden"), false);
  assert.match(page.getElementById("sharedAnswer")?.textContent ?? "", /Safe local answer/);
});

test("clinical input does not call assist before its deterministic review", async () => {
  requests.length = 0;
  await submit("Two year old child with cough.");
  assert.equal(requests.some((request) => request.url === "/assist"), false);
  assert.equal((page.getElementById("dangerDisclosure") as HTMLDetailsElement).open, true);
});

test("ambiguous recovery is inline and applies to one input revision", async () => {
  requests.length = 0;
  await submit("Please help with this record.");
  const choice = page.getElementById("intentChoice")!;
  assert.equal(choice.classList.contains("hidden"), false);
  const actions = choice.querySelectorAll("button") as NodeListOf<HTMLButtonElement>;
  assert.deepEqual(Array.from(actions, (button) => button.textContent), ["Assess as a patient case", "Answer as a general question"]);
  (actions[1] as HTMLButtonElement).click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(requests.at(-1)?.url, "/assist");
  input.value = "Another unclear request.";
  frontend.handleUnifiedInput();
  assert.equal(choice.classList.contains("hidden"), true);
});

test("cancel, retry, safe rendering, and terminal recovery remain bound to shared state", () => {
  assert.match(source, /fetch\("\/jobs\/"\s*\+\s*encodeURIComponent\(promptState\.jobId\)[\s\S]*method:\s*"DELETE"/);
  assert.match(source, /promptState\.abortController\.abort\(\)/);
  assert.match(source, /function retryPrompt[\s\S]*promptState\.jobId\s*=\s*null[\s\S]*runPrompt\(\)/);
  assert.match(source, /response\.status\s*===\s*409[\s\S]*already finished[\s\S]*return/);
  assert.match(source, /if\s*\(!response\.ok\)[\s\S]*Cancellation could not be confirmed[\s\S]*return/);
  assert.match(source, /function promptMessage[\s\S]*sharedAnswer[\s\S]*textContent/);
  assert.doesNotMatch(source, /sharedAnswer[^\n]*innerHTML\s*=/);
  assert.match(source, /code:\s*"MALFORMED_RESPONSE"[\s\S]*retryable:\s*false/);
});
