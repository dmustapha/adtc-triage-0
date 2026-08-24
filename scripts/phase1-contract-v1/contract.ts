import { readFile } from "node:fs/promises";

export const revision = "phase1-contract-v1";
export const candidateId = "olmo-2-1124-7b-instruct-q4-k-m";
export const systemPromptPath = `config/${revision}/system-prompt.txt`;
export const grammarPath = `config/${revision}/extraction.gbnf`;
export const runtimeArgs = ["-t", "4", "-ngl", "0", "-c", "2048", "-n", "128", "--temp", "0"] as const;

const scopes = ["SUPPORTED_PEDIATRIC_RESPIRATORY", "OUTSIDE_SCOPE", "INVALID_INPUT", "INSUFFICIENT_DATA"] as const;
const observations = ["PRESENT", "ABSENT", "UNKNOWN", "CONFLICT"] as const;
const uncertainties = ["NONE", "MISSING", "CONFLICT", "INVALID", "OUTSIDE_SCOPE"] as const;
export const dangerKeys = ["cd", "ve", "cv", "lu", "ci", "cs", "ox"] as const;
const reservedFences = ["<<<UNTRUSTED CASE DATA>>>", "<<<END UNTRUSTED CASE DATA>>>"] as const;

export interface Extraction {
  scope: typeof scopes[number];
  cd: typeof observations[number];
  ve: typeof observations[number];
  cv: typeof observations[number];
  lu: typeof observations[number];
  ci: typeof observations[number];
  cs: typeof observations[number];
  ox: typeof observations[number];
  uncertainty: typeof uncertainties[number];
  mimicConcern: typeof observations[number];
  instructionInjection: boolean;
  resourceMention: boolean;
}

export type AtomicDanger = Pick<Extraction, typeof dangerKeys[number]>;

export interface SafetyProjection {
  danger: "DANGER_PRESENT" | "DANGER_CONFLICT" | "DANGER_UNKNOWN" | "NO_DANGER_OBSERVED";
  urgency: "EMERGENCY" | "URGENT_REVIEW" | "ASSESSMENT_REQUIRED" | "ROUTINE";
  actions: [string];
  explanation: string;
}

export interface RawIdentity {
  schemaVersion: 1;
  revision: string;
  candidateId: string;
  caseId: string;
  corpusSha256: string;
  promptSha256: string;
  command: string[];
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) throw new Error(`${field} invalid`);
  return value as T;
}

export function parseExtraction(raw: string): Extraction {
  const text = raw.trim();
  if (!text.startsWith("{") || !text.endsWith("}") || /<\/?think>|chain[- ]of[- ]thought/i.test(text)) {
    throw new Error("visible reasoning or non-JSON output");
  }
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error("visible reasoning or non-JSON output"); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("output object invalid");
  const record = value as Record<string, unknown>;
  const keys = ["cd", "ci", "cs", "cv", "instructionInjection", "lu", "mimicConcern", "ox", "resourceMention", "scope", "uncertainty", "ve"];
  if (Object.keys(record).sort().join() !== keys.join()) throw new Error("keys invalid");
  if (typeof record.instructionInjection !== "boolean" || typeof record.resourceMention !== "boolean") throw new Error("boolean field invalid");
  return {
    scope: enumValue(record.scope, scopes, "scope"),
    cd: enumValue(record.cd, observations, "cd"),
    ve: enumValue(record.ve, observations, "ve"),
    cv: enumValue(record.cv, observations, "cv"),
    lu: enumValue(record.lu, observations, "lu"),
    ci: enumValue(record.ci, observations, "ci"),
    cs: enumValue(record.cs, observations, "cs"),
    ox: enumValue(record.ox, observations, "ox"),
    uncertainty: enumValue(record.uncertainty, uncertainties, "uncertainty"),
    mimicConcern: enumValue(record.mimicConcern, observations, "mimicConcern"),
    instructionInjection: record.instructionInjection,
    resourceMention: record.resourceMention
  };
}

export function assertCaseTextSafe(caseText: string): void {
  if (!caseText.trim()) throw new Error("case text is empty");
  if (reservedFences.some(marker => caseText.includes(marker))) throw new Error("reserved case-data fence in case text");
}

export async function buildPrompt(caseText: string): Promise<string> {
  assertCaseTextSafe(caseText);
  await readFile(systemPromptPath, "utf8");
  return `<<<UNTRUSTED CASE DATA>>>\n${JSON.stringify(caseText)}\n<<<END UNTRUSTED CASE DATA>>>\nEmit the JSON object now.`;
}

export function projectSafety(value: AtomicDanger): SafetyProjection {
  const observations = dangerKeys.map(key => value[key]);
  if (observations.includes("PRESENT")) return { danger: "DANGER_PRESENT", urgency: "EMERGENCY",
    actions: ["ESCALATE_TO_DETERMINISTIC_CLINICAL_PROTOCOL"], explanation: "At least one atomic danger observation is present." };
  if (observations.includes("CONFLICT")) return { danger: "DANGER_CONFLICT", urgency: "URGENT_REVIEW",
    actions: ["REQUEST_DETERMINISTIC_CONFLICT_RESOLUTION"], explanation: "At least one atomic danger observation conflicts." };
  if (observations.includes("UNKNOWN")) return { danger: "DANGER_UNKNOWN", urgency: "ASSESSMENT_REQUIRED",
    actions: ["COLLECT_MISSING_DANGER_OBSERVATIONS"], explanation: "At least one atomic danger observation is unknown." };
  return { danger: "NO_DANGER_OBSERVED", urgency: "ROUTINE",
    actions: ["CONTINUE_DETERMINISTIC_POLICY"], explanation: "All atomic danger observations are absent." };
}

export function llamaArgs(modelPath: string, prompt: string): string[] {
  return ["-m", modelPath, ...runtimeArgs, "--no-display-prompt", "--system-prompt-file", systemPromptPath,
    "--grammar-file", grammarPath, "--jinja", "--single-turn", "-p", prompt];
}

export function validateRawIdentity(actual: unknown, expected: RawIdentity): void {
  if (!actual || typeof actual !== "object") throw new Error("raw row identity mismatch");
  const record = actual as Record<string, unknown>;
  for (const field of ["schemaVersion", "revision", "candidateId", "caseId", "corpusSha256", "promptSha256", "command"] as const) {
    if (JSON.stringify(record[field]) !== JSON.stringify(expected[field])) throw new Error(`raw row identity mismatch: ${field}`);
  }
}
