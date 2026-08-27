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
let assistResponder = async (_init?: RequestInit) => sseAnswer();
let jobResponder = async (_url: string, _init?: RequestInit) =>
  new Response(JSON.stringify({ ok: true }), { status: 200 });
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
  if (url.startsWith("/jobs/")) return jobResponder(url, init);
  return assistResponder(init);
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
  assert.ok(Array.from(actions, (button) => button.classList.contains("btn")).every(Boolean));
  assert.ok(Array.from(actions, (button) => button.type === "button").every(Boolean));
  assert.equal(page.activeElement, actions[0]);
  (actions[1] as HTMLButtonElement).click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(requests.at(-1)?.url, "/assist");
  input.value = "Another unclear request.";
  frontend.handleUnifiedInput();
  assert.equal(choice.classList.contains("hidden"), true);
});

test("editing during assist aborts revision N before it can render over revision N plus one", async () => {
  let release!: () => void;
  let signal!: AbortSignal;
  assistResponder = (init) => new Promise<Response>((resolve, reject) => {
    signal = init?.signal as AbortSignal;
    release = () => resolve(sseAnswer("Stale revision answer."));
    signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
  });
  input.value = "Explain the first revision.";
  frontend.handleUnifiedInput();
  const running = frontend.runUnified();
  await new Promise((resolve) => setTimeout(resolve, 0));
  input.value = "Explain the second revision.";
  frontend.handleUnifiedInput();
  const wasAborted = signal.aborted;
  if (!wasAborted) release();
  await running;
  assert.equal(wasAborted, true);
  assert.doesNotMatch(page.getElementById("sharedAnswer")?.textContent ?? "", /Stale revision answer/);
  assistResponder = async () => sseAnswer();
});

test("repeated action and keyboard submission cannot orphan an active assist run", async () => {
  const releases: Array<() => void> = [];
  assistResponder = (init) => new Promise<Response>((resolve) => {
    releases.push(() => resolve(sseAnswer("Owned terminal answer.")));
    (init?.signal as AbortSignal).addEventListener("abort", () => resolve(sseAnswer("Aborted answer.")), { once: true });
  });
  requests.length = 0;
  input.value = "Explain active request ownership.";
  frontend.handleUnifiedInput();
  const first = frontend.runUnified();
  await new Promise((resolve) => setTimeout(resolve, 0));
  const repeated = frontend.runUnified();
  input.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  const activeRequests = requests.filter((request) => request.url === "/assist");
  const requestCount = activeRequests.length;
  releases.forEach((release) => release());
  await Promise.all([first, repeated]);
  assert.equal(requestCount, 1);
  assert.equal(new Set(activeRequests.map((request) => request.init?.signal)).size, 1);
  assistResponder = async () => sseAnswer();
});

test("Cancel deletes and aborts the owned job, then Retry starts a fresh shared run", async () => {
  const encoder = new TextEncoder();
  let assistSignal!: AbortSignal;
  assistResponder = async (init) => new Response(new ReadableStream({
    start(controller) {
      assistSignal = init?.signal as AbortSignal;
      controller.enqueue(encoder.encode('event: job\ndata: {"id":"job-cancel"}\n\n'));
      assistSignal.addEventListener("abort", () => controller.error(new DOMException("Aborted", "AbortError")), { once: true });
    },
  }), { status: 200 });
  requests.length = 0;
  input.value = "Explain cancellation behavior.";
  frontend.handleUnifiedInput();
  const running = frontend.runUnified();
  await new Promise((resolve) => setTimeout(resolve, 0));
  (page.getElementById("cancelPrompt") as HTMLButtonElement).click();
  await running;
  assert.equal(requests.some((request) => request.url === "/jobs/job-cancel" && request.init?.method === "DELETE"), true);
  assert.equal(assistSignal.aborted, true);
  assert.match(page.getElementById("status")?.textContent ?? "", /Cancelled by user/);

  assistResponder = async () => sseAnswer("Fresh retry answer.");
  (page.getElementById("retryPrompt") as HTMLButtonElement).click();
  for (let attempt = 0; attempt < 5 && !/Fresh retry answer/.test(page.getElementById("sharedAnswer")?.textContent ?? ""); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  assert.equal(requests.filter((request) => request.url === "/assist").length, 2);
  assert.match(page.getElementById("sharedAnswer")?.textContent ?? "", /Fresh retry answer/);
});

test("a late cancellation response cannot mutate a newer clinical revision", async () => {
  const encoder = new TextEncoder();
  const outcomes = [
    () => new Response(JSON.stringify({ error: "already terminal" }), { status: 409 }),
    () => new Response(JSON.stringify({ error: "delete failed" }), { status: 500 }),
    () => Promise.reject(new Error("late network failure")),
    () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
  ];
  for (const outcome of outcomes) {
    let releaseDelete!: () => void;
    jobResponder = () => new Promise<Response>((resolve, reject) => {
      releaseDelete = () => Promise.resolve(outcome()).then(resolve, reject);
    });
    assistResponder = async (init) => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('event: job\ndata: {"id":"old-job"}\n\n'));
        (init?.signal as AbortSignal).addEventListener("abort", () => controller.error(new DOMException("Aborted", "AbortError")), { once: true });
      },
    }), { status: 200 });
    input.value = "Explain the old general request.";
    frontend.handleUnifiedInput();
    const oldRun = frontend.runUnified();
    await new Promise((resolve) => setTimeout(resolve, 0));
    (page.getElementById("cancelPrompt") as HTMLButtonElement).click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    input.value = "Two year old child cannot drink or breastfeed.";
    frontend.handleUnifiedInput();
    const currentStatus = page.getElementById("status")?.textContent;
    releaseDelete();
    await oldRun;
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(page.getElementById("status")?.textContent, currentStatus);
    assert.equal((page.getElementById("cancelPrompt") as HTMLButtonElement).hidden, true);
    assert.equal((page.getElementById("retryPrompt") as HTMLButtonElement).hidden, true);
  }

  jobResponder = async () => new Response(JSON.stringify({ error: "already terminal" }), { status: 409 });
  input.value = "Explain a current cancellable request.";
  frontend.handleUnifiedInput();
  const currentRun = frontend.runUnified();
  await new Promise((resolve) => setTimeout(resolve, 0));
  (page.getElementById("cancelPrompt") as HTMLButtonElement).click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.match(page.getElementById("status")?.textContent ?? "", /already finished/);
  input.value = "Cleanup current cancellation test.";
  frontend.handleUnifiedInput();
  await currentRun;
  jobResponder = async () => new Response(JSON.stringify({ ok: true }), { status: 200 });
  assistResponder = async () => sseAnswer();
});

test("incomplete streams and HTTP or network failures replace progress with terminal shared status", async () => {
  assistResponder = async () => new Response('event: stage\ndata: {"label":"Still working."}\n\n', { status: 200 });
  await submit("Explain an incomplete response.");
  assert.equal(page.getElementById("status")?.textContent, "Local assistance unavailable.");
  assert.match(page.getElementById("sharedAnswer")?.textContent ?? "", /No validated terminal answer/);

  const failures = [
    async () => new Response(JSON.stringify({ error: "Unavailable", code: "DOWN", retryable: false }), { status: 503 }),
    async () => { throw new Error("network unavailable"); },
  ];
  for (const failure of failures) {
    assistResponder = failure;
    await submit("Explain a failed response.");
    assert.equal(page.getElementById("status")?.textContent, "Local assistance unavailable.");
    assert.match(page.getElementById("sharedAnswer")?.textContent ?? "", /Local assistance unavailable/);
  }
  assistResponder = async () => sseAnswer();
});

test("cancel, retry, safe rendering, and terminal recovery remain bound to shared state", () => {
  assert.match(source, /fetch\("\/jobs\/"\s*\+\s*encodeURIComponent\(owner\.jobId\)[\s\S]*method:\s*"DELETE"/);
  assert.match(source, /ownsCancellation\(\)\s*&&\s*owner\.controller[\s\S]*owner\.controller\.abort\(\)/);
  assert.match(source, /function retryPrompt[\s\S]*promptState\.jobId\s*=\s*null[\s\S]*runPrompt\(\)/);
  assert.match(source, /response\.status\s*===\s*409[\s\S]*already finished[\s\S]*return/);
  assert.match(source, /if\s*\(!response\.ok\)[\s\S]*Cancellation could not be confirmed[\s\S]*return/);
  assert.match(source, /function promptMessage[\s\S]*sharedAnswer[\s\S]*textContent/);
  assert.doesNotMatch(source, /sharedAnswer[^\n]*innerHTML\s*=/);
  assert.match(source, /code:\s*"MALFORMED_RESPONSE"[\s\S]*retryable:\s*false/);
});
