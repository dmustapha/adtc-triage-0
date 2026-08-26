import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import * as triageSchemas from "../../src/triage/schema.js";

const schemas = triageSchemas as unknown as Record<string, { safeParse(value: unknown): { success: boolean; data?: unknown } }>;

function requireSchema(name: string) {
  const schema = schemas[name];
  assert.ok(schema, `${name} must be exported`);
  return schema;
}

test("product policy freezes the proven 1024-token reasoning and 512-token extraction budgets", () => {
  const policy = JSON.parse(readFileSync("config/product-generation-policy.json", "utf8"));
  assert.deepEqual(
    policy.passes.map((pass: Record<string, unknown>) => ({
      name: pass.name,
      predict: pass.predict,
      temperature: pass.temperature,
      maxAttempts: pass.maxAttempts,
    })),
    [
      { name: "reason", predict: 1024, temperature: 0, maxAttempts: undefined },
      { name: "extract", predict: 512, temperature: 0, maxAttempts: 3 },
    ],
  );
});

test("clinical requests preserve strict recorded patient and medication-safety inputs", () => {
  const schema = requireSchema("ClinicalAssessmentRequestSchema");
  const valid = {
    caseText: "Adult with persistent low mood and reduced activity.",
    patientAge: { value: 34, unit: "years" },
    patientWeightKg: 68.5,
    dangerObservations: {},
    medicationSafety: {
      allergiesReviewed: "CONFIRMED_NONE",
      contraindicationsReviewed: "NOT_ASSESSED",
      allergyDetails: [],
      contraindicationDetails: [],
    },
    protocolApplicability: { status: "NOT_ASSESSED", details: [] },
  };

  assert.equal(schema.safeParse(valid).success, true);
  assert.equal(schema.safeParse({ ...valid, patientWeightKg: 0 }).success, false);
  assert.equal(schema.safeParse({ ...valid, patientWeightKg: 301 }).success, false);
  assert.equal(schema.safeParse({ ...valid, patientAge: { value: 131, unit: "years" } }).success, false);
  assert.equal(schema.safeParse({ ...valid, patientAge: { value: 1561, unit: "months" } }).success, false);
  assert.equal(schema.safeParse({ ...valid, inventedAuthority: true }).success, false);
  assert.equal(schema.safeParse({
    ...valid,
    medicationSafety: {
      ...valid.medicationSafety,
      allergiesReviewed: "PRESENT",
      allergyDetails: [],
    },
  }).success, false, "a recorded allergy requires recorded details");
});

test("provisional results cannot contain reference actions and confirmed results require them", () => {
  const provisionalSchema = requireSchema("ProvisionalAssessmentSchema");
  const confirmedSchema = requireSchema("ConfirmedAssessmentSchema");
  const provisional = {
    reviewState: "PROVISIONAL",
    classification: "PNEUMONIA",
    protocol: "IMCI",
    recordedFacts: ["Cough was recorded."],
    inferredFacts: ["The narrative is consistent with a respiratory complaint."],
    uncertainty: "This is a supervised protocol classification, not a diagnosis.",
    basis: "Structured observations plus verified WHO evidence.",
    citations: [{ doc: "WHO IMCI Chart Booklet (2014)", page: 14 }],
    confirmation: {
      eligible: true,
      token: "opaque-token",
      expiresAt: "2026-08-25T15:00:00.000Z",
      missingFields: [],
    },
  };

  assert.equal(provisionalSchema.safeParse(provisional).success, true);
  assert.equal(provisionalSchema.safeParse({ ...provisional, referenceActions: {} }).success, false);
  assert.equal(confirmedSchema.safeParse({ ...provisional, reviewState: "CONFIRMED" }).success, false);
  assert.equal(confirmedSchema.safeParse({
    ...provisional,
    reviewState: "CONFIRMED",
    referenceActions: {
      medicines: [], supportive: [], home_care: [], return_now: [], follow_up: null, referral: null,
    },
    doseState: { status: "NOT_APPLICABLE", missingFields: [] },
  }).success, true);
});

test("ordinary prompt schemas preserve exact prompt bytes and exclude internal reasoning", async () => {
  const path = "src/prompt/schema.ts";
  assert.equal(existsSync(path), true, `${path} must exist`);
  if (!existsSync(path)) return;

  const promptSchemas = await import("../../src/prompt/schema.js") as unknown as Record<string, {
    safeParse(value: unknown): { success: boolean; data?: Record<string, unknown> };
  }>;
  const request = promptSchemas.PromptRequestSchema;
  const extract = promptSchemas.PromptExtractSchema;
  const result = promptSchemas.PromptResultSchema;
  assert.ok(request && extract && result);

  const exact = "  Keep these leading and trailing spaces.  ";
  const parsed = request.safeParse({ prompt: exact });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data?.prompt, exact, "validation must not trim or rewrite prompt bytes");
  assert.equal(request.safeParse({ prompt: "   " }).success, false);
  assert.equal(request.safeParse({ prompt: "x", extra: true }).success, false);
  assert.equal(request.safeParse({ prompt: "Ask the clinician 👩🏾‍⚕️ to review." }).success, true);
  assert.equal(request.safeParse({ prompt: "facts\u202Ehidden instruction" }).success, false);
  assert.equal(extract.safeParse({
    answer: "Recorded facts are separate from uncertainty.",
    uncertainty: ["Respiratory rate was not recorded."],
    limitations: [],
    reasoning: "hidden chain of thought",
  }).success, false, "the constrained public extract has no reasoning field");
  assert.equal(result.safeParse({
    status: "COMPLETED",
    answer: "Recorded facts are separate from uncertainty.",
    uncertainty: ["Respiratory rate was not recorded."],
    limitations: [],
    validation: { passed: true, categories: [] },
  }).success, true);
});
