// File: src/triage/schema.ts
// The triage card contract (rendered by the UI, returned by /triage) + the model's EXTRACT contract.
// RECONCILED for Phase 2 (RECONCILE.md "Phase-2 Tool-Calling reconciliation"): MedPsy-1.7B will NOT
// tool-call, so the card is NOT produced by completion({tools}). Instead the model reasons in prose
// then EXTRACTS structured fields under a responseFormat:json_schema grammar; `severity` is derived in
// code (severity.ts) and `protocol_citation` is injected from the retrieved chunk — neither is model-
// authored. This keeps the two things the model is bad at (severity bucketing, citing) out of its hands.
import { z } from "zod";

const INVISIBLE_CONTROLS = /[\u0000\u200B\u200E-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/u;
const safeDetail = z.string().trim().min(1).max(500)
  .refine((text) => !INVISIBLE_CONTROLS.test(text), "Invisible control characters are not allowed.");
import { CLASSIFICATION_ENUM } from "./protocol-table.js";
import { DANGER_OBSERVATION_KEYS } from "./danger-observations.js";

export const SEVERITIES = ["EMERGENCY", "URGENT", "ROUTINE", "SELF_CARE", "UNKNOWN"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const PatientAgeSchema = z.object({
  value: z.number().finite().nonnegative(),
  unit: z.enum(["months", "years"]),
}).strict().superRefine((age, context) => {
  const maximum = age.unit === "years" ? 130 : 1560;
  if (age.value > maximum) context.addIssue({
    code: "too_big", origin: "number", maximum, inclusive: true,
    path: ["value"], message: `Patient age must not exceed ${maximum} ${age.unit}.`,
  });
});

const DangerObservationRequestValueSchema = z.enum(["PRESENT", "ABSENT", "NOT_ASSESSED"]);
const dangerObservationShape = {
  cannotDrinkOrBreastfeed: DangerObservationRequestValueSchema.default("NOT_ASSESSED"),
  vomitsEverything: DangerObservationRequestValueSchema.default("NOT_ASSESSED"),
  convulsions: DangerObservationRequestValueSchema.default("NOT_ASSESSED"),
  lethargicOrUnconscious: DangerObservationRequestValueSchema.default("NOT_ASSESSED"),
  chestIndrawing: DangerObservationRequestValueSchema.default("NOT_ASSESSED"),
  stridorWhenCalm: DangerObservationRequestValueSchema.default("NOT_ASSESSED"),
  lowOxygenOrCentralCyanosis: DangerObservationRequestValueSchema.default("NOT_ASSESSED"),
};

const DEFAULT_DANGER_OBSERVATIONS = Object.fromEntries(
  DANGER_OBSERVATION_KEYS.map((key) => [key, "NOT_ASSESSED"]),
) as Record<(typeof DANGER_OBSERVATION_KEYS)[number], "NOT_ASSESSED">;

export const DangerObservationsRequestSchema = z.object(dangerObservationShape).strict().default(DEFAULT_DANGER_OBSERVATIONS);
export const RespiratoryAssessmentRequestSchema = z.object({
  coughOrDifficultBreathing: DangerObservationRequestValueSchema,
  respiratoryRatePerMinute: z.number().int().min(1).max(200).optional(),
  rateCountQuality: z.enum(["ONE_MINUTE_WHILE_CALM", "NOT_CONFIRMED"]),
}).strict();
export const StructuredDangerRequestSchema = z.object({
  patientAge: PatientAgeSchema.optional(),
  dangerObservations: DangerObservationsRequestSchema,
  respiratoryAssessment: RespiratoryAssessmentRequestSchema.optional(),
}).strict();

export const MedicationSafetyReviewStateSchema = z.enum(["CONFIRMED_NONE", "PRESENT", "NOT_ASSESSED"]);
export const MedicationSafetySchema = z.object({
  allergiesReviewed: MedicationSafetyReviewStateSchema.default("NOT_ASSESSED"),
  contraindicationsReviewed: MedicationSafetyReviewStateSchema.default("NOT_ASSESSED"),
  allergyDetails: z.array(safeDetail).max(20).default([]),
  contraindicationDetails: z.array(safeDetail).max(20).default([]),
}).strict().superRefine((value, context) => {
  if (value.allergiesReviewed === "PRESENT" && value.allergyDetails.length === 0) {
    context.addIssue({ code: "custom", path: ["allergyDetails"], message: "Record known allergies." });
  }
  if (value.contraindicationsReviewed === "PRESENT" && value.contraindicationDetails.length === 0) {
    context.addIssue({ code: "custom", path: ["contraindicationDetails"], message: "Record known contraindications." });
  }
});

export const ProtocolApplicabilitySchema = z.object({
  status: z.enum(["CONFIRMED_APPLICABLE", "NOT_APPLICABLE", "NOT_ASSESSED"]).default("NOT_ASSESSED"),
  details: z.array(safeDetail).max(20).default([]),
}).strict();

export const ClinicalAssessmentRequestSchema = z.object({
  caseText: z.string().max(2000)
    .refine((text) => text.trim().length > 0, "Case description is required.")
    .refine((text) => !INVISIBLE_CONTROLS.test(text), "Invisible control characters are not allowed."),
  patientAge: PatientAgeSchema.optional(),
  patientWeightKg: z.number().finite().min(0.5).max(300).optional(),
  dangerObservations: DangerObservationsRequestSchema,
  respiratoryAssessment: RespiratoryAssessmentRequestSchema.optional(),
  medicationSafety: MedicationSafetySchema.default({
    allergiesReviewed: "NOT_ASSESSED",
    contraindicationsReviewed: "NOT_ASSESSED",
    allergyDetails: [],
    contraindicationDetails: [],
  }),
  protocolApplicability: ProtocolApplicabilitySchema.default({ status: "NOT_ASSESSED", details: [] }),
}).strict();
export type ClinicalAssessmentRequest = z.infer<typeof ClinicalAssessmentRequestSchema>;

/** A citation injected from a real retrieved chunk (never model-authored). Used by every plan line. */
export const PlanCitationSchema = z.object({
  doc: z.string().min(1), // e.g. "WHO IMCI Chart Booklet (2014)"
  page: z.union([z.number().int(), z.string()]),
});
export type PlanCitation = z.infer<typeof PlanCitationSchema>;

/**
 * The grounded WHO management plan (Task #22). Assembled from MULTIPLE retrieved chunks, each line
 * carrying the page it was grounded against. Built by triage.ts: the model proposes verbatim, non-
 * numeric phrases; a deterministic guard validates each line against a retrieved chunk and injects the
 * citation from that chunk. Dose is never a model number — it is the protocol's weight-band guidance.
 * Any component with no clearing chunk is omitted (graceful partial plan), so every array is optional.
 */
export const ManagementPlanSchema = z.object({
  medicines: z
    .array(
      z.object({
        name: z.string().min(1),
        strength: z.string().optional(), // e.g. "250 mg tablet or 250 mg per 5 ml syrup"
        dose: z.string().optional(), // legacy "By weight band" fallback when no `bands`
        frequency: z.string().optional(), // e.g. "give two times daily for 5 days"
        duration: z.string().optional(),
        bands: z // real per-weight-band amounts (sourced from the WHO dosing tables, never fabricated)
          .array(z.object({ band: z.string().min(1), dose: z.string().min(1) }))
          .optional(),
        citation: PlanCitationSchema,
      }),
    )
    .default([]),
  supportive: z.array(z.object({ item: z.string().min(1), citation: PlanCitationSchema })).default([]),
  home_care: z.array(z.object({ advice: z.string().min(1), citation: PlanCitationSchema })).default([]),
  return_now: z.array(z.object({ sign: z.string().min(1), citation: PlanCitationSchema })).default([]),
  follow_up: z
    .object({ when: z.string().min(1), detail: z.string().optional(), citation: PlanCitationSchema })
    .nullable()
    .default(null),
  referral: z.object({ criterion: z.string().min(1), citation: PlanCitationSchema }).nullable().default(null),
});
export type ManagementPlan = z.infer<typeof ManagementPlanSchema>;

export const ReviewStateSchema = z.enum(["DETERMINISTIC", "PROVISIONAL", "CONFIRMED", "REJECTED", "UNAVAILABLE"]);
const ReviewCitationSchema = PlanCitationSchema.strict();
const ReviewFactsSchema = z.array(z.string().min(1)).max(50);
const ConfirmationMetadataSchema = z.object({
  eligible: z.boolean(),
  token: z.string().min(1).nullable(),
  expiresAt: z.string().datetime().nullable(),
  missingFields: z.array(z.string().min(1)),
}).strict();

const ProvisionalAssessmentShape = {
  classification: z.string().min(1),
  protocol: z.enum(["IMCI", "mhGAP"]),
  recordedFacts: ReviewFactsSchema,
  inferredFacts: ReviewFactsSchema,
  uncertainty: z.string().min(1),
  basis: z.string().min(1),
  citations: z.array(ReviewCitationSchema).min(1),
  confirmation: ConfirmationMetadataSchema,
};

export const ProvisionalAssessmentSchema = z.object({
  reviewState: z.literal("PROVISIONAL"),
  ...ProvisionalAssessmentShape,
}).strict();

export const DoseStateSchema = z.object({
  status: z.enum(["NOT_APPLICABLE", "LOCKED_MISSING_INPUTS", "LOCKED_SAFETY_REVIEW", "AVAILABLE_REFERENCE_BAND"]),
  missingFields: z.array(z.string().min(1)),
}).strict();

export const ConfirmedAssessmentSchema = z.object({
  reviewState: z.literal("CONFIRMED"),
  ...ProvisionalAssessmentShape,
  referenceActions: ManagementPlanSchema,
  doseState: DoseStateSchema,
}).strict();

/** The triage card surfaced to the health worker. `protocol_citation` always resolves to a real
 *  ingested WHO chunk (never invented). `plan` is the grounded management plan (Task #22), attached
 *  after the classification; absent on the abstain path. */
export const TriageCardSchema = z.object({
  severity: z.enum(SEVERITIES),
  action: z.string().min(1),
  protocol_citation: z.object({
    doc: z.string().min(1), // e.g. "WHO IMCI Chart Booklet (2014)"
    page: z.union([z.number().int(), z.string()]), // page number or label
    section: z.string().min(1), // verbatim snippet / section anchor
  }),
  reasoning: z.string().min(1),
  red_flags: z.array(z.string()).default([]),
  /** 1D: the model's self-reported classification confidence, surfaced for the UI + telemetry (and the
   *  future adaptive-thinking / self-consistency tail). Absent on the abstain path. */
  confidence: z.enum(["high", "medium", "low"]).optional(),
  plan: ManagementPlanSchema.optional(),
  /** Phase 4 multilingual: set post-hoc (never model-authored) when the case was non-English. `translated`
   *  true = action/reasoning/red_flags/plan are machine-translated to `source_language` (banner shows
   *  "translated — not verbatim WHO"); the English `protocol_citation` is always kept for provenance. */
  source_language: z.enum(["en", "fr", "es"]).optional(),
  translated: z.boolean().optional(),
});
export type TriageCard = z.infer<typeof TriageCardSchema>;

/**
 * What the model EXTRACTS in the json_schema pass — only fields the model produces reliably:
 * the classification it concluded, the action on that classification's protocol line, its reasoning,
 * and any danger signs. NO severity (derived in severity.ts) and NO citation (injected from retrieval).
 */
export const TriageExtractSchema = z.object({
  classification: z.string().min(1), // WHO classification name, e.g. "PNEUMONIA"
  action: z.string().min(1),
  reasoning: z.string().min(1),
  red_flags: z.array(z.string()).default([]),
  // 1D: the model's self-reported confidence in the classification. Near-free (no token logprobs in QVAC).
  // Drives adaptive thinking (spend a full reason pass only on low/medium) and flags the tail for optional
  // self-consistency. Defaulted so the belt-and-braces regex-parse path never fails on its absence.
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
});
export type TriageExtract = z.infer<typeof TriageExtractSchema>;

/**
 * JSON Schema literal handed to completion({ responseFormat: { type:"json_schema", json_schema:{schema} } }).
 * Verified live: llama.cpp converts this to GBNF and constrains generation, so the output is always a
 * shape-valid object. (Full nesting/items ARE honoured here — unlike the flat native tool schema.)
 */
export const TRIAGE_EXTRACT_JSON_SCHEMA = {
  type: "object",
  properties: {
    // ENUM-CONSTRAINED (the highest-leverage accuracy lever). llama.cpp compiles this enum into the GBNF
    // grammar, so the model can ONLY emit a valid WHO classification — it cannot invent a vague class
    // ("fever, follow-up in 2 days") that would silently mis-aim routing. This string is THE table key
    // (protocol-table.ts). UNKNOWN is the abstain escape hatch for a case that fits no listed class.
    classification: { type: "string", enum: CLASSIFICATION_ENUM, description: "The single WHO classification that best matches the case, chosen from the allowed list. Use UNKNOWN if no listed classification fits." },
    action: { type: "string", description: "The exact treatment / next step on the matched classification's protocol line." },
    reasoning: { type: "string", description: "Brief justification citing the matched signs." },
    red_flags: { type: "array", items: { type: "string" }, description: "Danger signs present in the case, if any." },
    confidence: { type: "string", enum: ["high", "medium", "low"], description: "Your confidence that this classification is correct for the case: high (signs unambiguously match one class), medium (a plausible best of two), low (signs are sparse, conflicting, or out of scope)." },
  },
  required: ["classification", "action", "reasoning", "red_flags", "confidence"],
  additionalProperties: false,
} as const;

/**
 * Per-request extract schema: the same shape, but with `classification.enum` restricted to the classes
 * allowed for THIS case's detected main symptom(s) (protocol-table.ts allowedClassesFor). This is the
 * hard, grammar-level constraint that stops a 1.7B model from drifting across symptoms (an ear case to a
 * dehydration class). Falls back to the full enum when no symptom is detected.
 */
export function buildExtractJsonSchema(allowedClasses: string[]) {
  return {
    type: "object",
    properties: {
      classification: { type: "string", enum: allowedClasses, description: "The single WHO classification that best matches the case, from the allowed list. Use UNKNOWN if none fit." },
      action: TRIAGE_EXTRACT_JSON_SCHEMA.properties.action,
      reasoning: TRIAGE_EXTRACT_JSON_SCHEMA.properties.reasoning,
      red_flags: TRIAGE_EXTRACT_JSON_SCHEMA.properties.red_flags,
      confidence: TRIAGE_EXTRACT_JSON_SCHEMA.properties.confidence,
    },
    required: ["classification", "action", "reasoning", "red_flags", "confidence"],
    additionalProperties: false,
  };
}

/**
 * What the model proposes in the plan-assemble pass (Task #22). NO citations (injected in code from the
 * matched chunk), NO doses/numbers (dose is the protocol's weight-band guidance, built in code). Every
 * string MUST be copied verbatim from the supplied PROTOCOL EXCERPTS; the deterministic groundPlan()
 * guard drops anything that does not match a retrieved chunk, so an empty field is always safe.
 */
export const PlanExtractSchema = z.object({
  medicines: z.array(z.string()).default([]),
  supportive: z.array(z.string()).default([]),
  home_care: z.array(z.string()).default([]),
  return_now: z.array(z.string()).default([]),
  follow_up: z.string().default(""),
  referral: z.string().default(""),
});
export type PlanExtract = z.infer<typeof PlanExtractSchema>;

// FLAT schema only (strings + arrays-of-strings) — the same shape the main triage extract uses, which
// MedPsy-1.7B fills reliably. A nested object array (medicines:[{name,dose,...}]) makes the GBNF grammar
// too hard for a 1.7B model and it returns empty. So medicines are verbatim LINES here; triage.ts
// derives name/frequency/duration/dose from each grounded line deterministically.
export const PLAN_EXTRACT_JSON_SCHEMA = {
  type: "object",
  properties: {
    medicines: { type: "array", items: { type: "string" }, description: "One line per medicine/fluid the excerpts prescribe for this classification, copied VERBATIM (e.g. 'Give oral Amoxicillin for 5 days', 'Give zinc supplements', 'Give fluid (Plan B)'). Include antibiotics, ORS, zinc, antimalarials, antidepressants. Do NOT add mg/ml/weight numbers." },
    supportive: { type: "array", items: { type: "string" }, description: "Supportive/symptomatic care lines copied verbatim (paracetamol for high fever, vitamin A, continue breastfeeding, psychosocial support). Empty if none." },
    home_care: { type: "array", items: { type: "string" }, description: "Home-care counselling lines copied verbatim (give extra fluids, continue feeding, soothe the throat). Empty if none." },
    return_now: { type: "array", items: { type: "string" }, description: "Signs/instruction that mean return immediately, copied verbatim (e.g. 'Advise mother when to return immediately'). Empty if none." },
    follow_up: { type: "string", description: "Verbatim follow-up instruction, e.g. 'Follow-up in 3 days'. Empty if none." },
    referral: { type: "string", description: "Verbatim referral instruction if required, e.g. 'Refer URGENTLY to hospital'. Empty if none." },
  },
  required: ["medicines", "supportive", "home_care", "return_now", "follow_up", "referral"],
  additionalProperties: false,
} as const;
