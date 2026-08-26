import { z } from "zod";

const INVISIBLE_CONTROLS = /[\u0000\u200B\u200E-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/u;
const boundedPrompt = z.string().max(4000)
  .refine((value) => value.trim().length > 0, "Prompt is required.")
  .refine((value) => !INVISIBLE_CONTROLS.test(value), "Invisible control characters are not allowed.");
const textList = z.array(z.string().min(1)).max(20);

export const PromptRequestSchema = z.object({
  prompt: boundedPrompt,
}).strict();
export type PromptRequest = z.infer<typeof PromptRequestSchema>;

export const PromptExtractSchema = z.object({
  answer: z.string().min(1),
  uncertainty: textList,
  limitations: textList,
}).strict();
export type PromptExtract = z.infer<typeof PromptExtractSchema>;

export const PROMPT_EXTRACT_JSON_SCHEMA = {
  type: "object",
  properties: {
    answer: { type: "string", description: "The complete plain-language answer to the user's request." },
    uncertainty: { type: "array", items: { type: "string" }, description: "Material facts that remain unknown or were not recorded." },
    limitations: { type: "array", items: { type: "string" }, description: "Important boundaries of the answer." },
  },
  required: ["answer", "uncertainty", "limitations"],
  additionalProperties: false,
} as const;

const ValidationSummarySchema = z.object({
  passed: z.boolean(),
  categories: z.array(z.string().min(1)),
}).strict();

const CompletedPromptResultSchema = PromptExtractSchema.extend({
  status: z.literal("COMPLETED"),
  validation: ValidationSummarySchema,
}).strict();

const IncompletePromptResultSchema = z.object({
  status: z.enum(["REJECTED", "CANCELLED", "UNAVAILABLE"]),
  answer: z.null(),
  reason: z.string().min(1),
  validation: ValidationSummarySchema,
}).strict();

export const PromptResultSchema = z.union([CompletedPromptResultSchema, IncompletePromptResultSchema]);
export type PromptResult = z.infer<typeof PromptResultSchema>;
