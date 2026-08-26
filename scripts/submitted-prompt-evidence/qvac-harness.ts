import { evaluateEvidenceRow } from "./harness.js";

type Prompt = { promptId: string; prompt: string; sha256: string };
type Output = {
  promptId: string;
  text: string;
  durationMs?: number;
  stats: {
    generatedTokens?: number;
    promptTokens?: number;
    tokensPerSecond?: number;
    timeToFirstToken?: number;
    backendDevice?: string;
  };
};

export function buildQvacEvidence(input: {
  prompts: Prompt[];
  outputs: Output[];
  sdkVersion: string;
  hostLabel: string;
  model: { bytes: number; sha256: string; path: string };
}) {
  if (input.prompts.length !== 2 || input.outputs.length !== 2) {
    throw new Error("QVAC evidence requires exactly two submitted prompts and outputs");
  }
  const rows = input.prompts.map((prompt) => {
    const output = input.outputs.find((item) => item.promptId === prompt.promptId);
    if (!output) throw new Error(`missing QVAC output for ${prompt.promptId}`);
    return {
      promptId: prompt.promptId,
      rawPrompt: prompt.prompt,
      normalizedPromptSha256: prompt.sha256,
      rawOutput: output.text,
      retrievalMode: "not-applicable" as const,
      generation: { predict: 128, temp: 0, reasoningBudget: 0 },
      performance: { durationMs: output.durationMs ?? null, ...output.stats },
    };
  });
  const evaluations = rows.map((row) => ({
    promptId: row.promptId,
    ...evaluateEvidenceRow({
      promptId: row.promptId,
      caseKind: "submitted-exact",
      rawStdout: row.rawOutput,
      rawStderr: "",
      exitCode: 0,
      timedOut: false,
      performance: {
        wallTimeMs: row.performance.durationMs ?? 0,
        generatedTokens: row.performance.generatedTokens ?? null,
        tokensPerSecond: row.performance.tokensPerSecond ?? null,
      },
    }),
  }));
  return {
    schemaVersion: 1,
    kind: "submitted-prompt-evidence",
    plane: "QVAC product runtime" as const,
    status: evaluations.every((item) => item.status === "pass") ? "pass" as const : "fail" as const,
    runtime: { name: "QVAC SDK", sdkVersion: input.sdkVersion },
    host: { label: input.hostLabel },
    model: input.model,
    rows,
    evaluations,
  };
}
