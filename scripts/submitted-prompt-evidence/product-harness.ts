import { createHash } from "node:crypto";

import { PromptResultSchema, type PromptResult } from "../../src/prompt/schema.js";
import { validatePromptAnswer } from "../../src/prompt/validation.js";
import type { CaseKind } from "./harness.js";

export type ProductPrompt = { promptId: string; prompt: string };
export type ProductCase = ProductPrompt & { caseId: string; caseKind: CaseKind; repeat: number | null };

export function buildProductCasePlan(prompts: ProductPrompt[]): ProductCase[] {
  if (prompts.length !== 2) throw new Error("product evidence requires exactly two submitted prompts");
  return prompts.flatMap((item) => [1, 2, 3].map((repeat) => ({
    ...item,
    caseId: `${item.promptId}-product-repeat-${repeat}`,
    caseKind: "submitted-exact" as const,
    repeat,
  })));
}

export function parseSseTranscript(transcript: string): {
  events: Array<{ event: string; data: any }>;
  jobId: string | null;
  stageKeys: string[];
  terminalEvent: "answer" | "rejected" | "error" | null;
  result: any;
  done: boolean;
} {
  const events = transcript.split(/\n\n+/).flatMap((block) => {
    const event = block.match(/^event:\s*([^\n]+)/m)?.[1]?.trim();
    const dataText = block.match(/^data:\s*([^\n]*)/m)?.[1];
    if (!event || dataText === undefined) return [];
    try { return [{ event, data: JSON.parse(dataText) }]; } catch { return [{ event, data: null }]; }
  });
  const terminal = events.find((item) => ["answer", "rejected", "error"].includes(item.event));
  return {
    events,
    jobId: events.find((item) => item.event === "job")?.data?.id ?? null,
    stageKeys: events.filter((item) => item.event === "stage").map((item) => item.data?.key).filter(Boolean),
    terminalEvent: terminal?.event as "answer" | "rejected" | "error" | null ?? null,
    result: terminal?.data ?? null,
    done: events.find((item) => item.event === "done")?.data?.ok === true,
  };
}

export function evaluateProductExecution(input: {
  caseKind: CaseKind;
  prompt: string;
  result: unknown;
  done: boolean;
}): { status: "pass" | "fail"; failures: string[] } {
  const failures: string[] = [];
  const parsed = PromptResultSchema.safeParse(input.result);
  if (!parsed.success) return { status: "fail", failures: ["malformed-output"] };
  const result = parsed.data;
  if (["submitted-exact", "paraphrase"].includes(input.caseKind) && result.status !== "COMPLETED") {
    failures.push("submitted-prompt-not-completed");
  }
  if (result.status === "COMPLETED") {
    const validation = validatePromptAnswer({
      prompt: input.prompt,
      extract: {
        answer: result.answer,
        uncertainty: result.uncertainty,
        limitations: result.limitations,
      },
    });
    if (!result.validation.passed || !validation.passed) failures.push("validation-failed");
    if (!input.done) failures.push("incomplete-terminal-sequence");
  } else if (input.caseKind !== "submitted-exact") {
    if (result.status !== "REJECTED" || result.validation.categories.length === 0) failures.push("unsafe-adversarial-terminal");
  }
  return { status: failures.length ? "fail" : "pass", failures: [...new Set(failures)] };
}

export function productPromptSha256(prompt: string): string {
  return createHash("sha256").update(prompt).digest("hex");
}

export function buildProductEvidence(input: {
  promptContract: ProductPrompt[];
  executions: any[];
  runtime: { sdkVersion: string; workflowVersion: string };
  model: { path: string; bytes: number; sha256: string };
  host: { label: string; platform: string; arch: string; release: string };
  startedAt: string;
  finishedAt: string;
  listenerClosed: boolean;
  workerClosed: boolean;
}) {
  const evaluations = input.executions.map((item) => ({
    caseId: item.caseId,
    ...evaluateProductExecution(item),
  }));
  const status = input.executions.length > 0
    && evaluations.every((item) => item.status === "pass")
    && input.listenerClosed
    && input.workerClosed ? "pass" : "fail";
  return {
    schemaVersion: 1,
    kind: "submitted-prompt-product-evidence",
    plane: "QVAC supported product /assist",
    status,
    officialProfilerEvidence: "separate-and-unchanged",
    historicalOneShotEvidence: "preserved-and-unchanged",
    promptContract: input.promptContract.map((item) => ({ ...item, sha256: productPromptSha256(item.prompt) })),
    runtime: input.runtime,
    model: input.model,
    host: input.host,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    listenerClosed: input.listenerClosed,
    workerClosed: input.workerClosed,
    executions: input.executions,
    evaluations,
  };
}
