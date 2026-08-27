import { createHash } from "node:crypto";
import { DANGER_OBSERVATION_KEYS, normalizePatientAge } from "./danger-observations.js";
import { extractNarrativeAuthority } from "./narrative-authority.js";
import { ClinicalAssessmentRequestSchema, type ClinicalAssessmentRequest } from "./schema.js";

export type CanonicalClinicalRecord = ReturnType<typeof canonicalClinicalRecord>;

export function parseClinicalRequest(input: unknown) {
  return ClinicalAssessmentRequestSchema.safeParse(input);
}

export function canonicalClinicalRecord(request: ClinicalAssessmentRequest) {
  const normalizedAge = request.patientAge ? normalizePatientAge(request.patientAge) : null;
  const threshold = normalizedAge?.supported ? (normalizedAge.months < 12 ? 50 : 40) : null;
  const observations = Object.fromEntries(
    DANGER_OBSERVATION_KEYS.map((key) => [key, request.dangerObservations[key]]),
  );

  return {
    schemaVersion: "clinical-record-v1" as const,
    narrative: { text: request.caseText, trust: "UNTRUSTED_CONTEXT" as const },
    patientAge: request.patientAge ?? null,
    ageMonths: normalizedAge?.months ?? null,
    patientWeightKg: request.patientWeightKg ?? null,
    dangerObservations: observations,
    respiratoryAssessment: request.respiratoryAssessment ? {
      coughOrDifficultBreathing: request.respiratoryAssessment.coughOrDifficultBreathing,
      respiratoryRatePerMinute: request.respiratoryAssessment.respiratoryRatePerMinute ?? null,
      rateCountQuality: request.respiratoryAssessment.rateCountQuality,
      fastBreathingThresholdPerMinute: threshold,
    } : null,
    medicationSafety: request.medicationSafety,
    protocolApplicability: request.protocolApplicability,
  };
}

export function clinicalRecordHash(record: CanonicalClinicalRecord): string {
  return createHash("sha256").update(JSON.stringify(record), "utf8").digest("hex");
}

function narrativeAgeMonths(text: string): number | null {
  const match = text.match(/\b(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*[- ]?(month|months|year|years)(?:\s+old)?\b/i);
  if (!match) return null;
  const wordValues: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
    seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  };
  const token = match[1]!.toLowerCase();
  const value = wordValues[token] ?? Number(token);
  return match[2]!.toLowerCase().startsWith("year") ? value * 12 : value;
}

function narrativeRate(text: string): number | null {
  const match = text.match(/\b(?:breath(?:e|es|ing)?|respiratory\s+rate)(?:\s+(?:is|was|counted\s+at))?\s+(\d{1,3})(?:\s*(?:breaths?|times))?\s*(?:per|\/)\s*min(?:ute)?\b/i);
  return match ? Number(match[1]) : null;
}

export function findNarrativeConflicts(record: CanonicalClinicalRecord): string[] {
  const text = record.narrative.text;
  const conflicts: string[] = [];
  const age = narrativeAgeMonths(text);
  if (age !== null && record.ageMonths !== null && age !== record.ageMonths) conflicts.push("patientAge");

  const authority = extractNarrativeAuthority(text);
  DANGER_OBSERVATION_KEYS.forEach((key) => {
    const narrative = authority.dangerObservations[key];
    const structured = record.dangerObservations[key];
    if (narrative === "CONFLICT" || (narrative !== "NOT_ASSESSED" && structured !== "NOT_ASSESSED" && narrative !== structured)) {
      conflicts.push(`dangerObservations.${key}`);
    }
  });
  const respiratory = authority.respiratoryConcern;
  const structuredRespiratory = record.respiratoryAssessment?.coughOrDifficultBreathing;
  if (respiratory === "CONFLICT" || (structuredRespiratory && respiratory !== "NOT_ASSESSED" && respiratory !== structuredRespiratory)) {
    conflicts.push("respiratoryAssessment.coughOrDifficultBreathing");
  }

  const rate = narrativeRate(text);
  if (rate !== null && record.respiratoryAssessment?.respiratoryRatePerMinute != null
    && rate !== record.respiratoryAssessment.respiratoryRatePerMinute) {
    conflicts.push("respiratoryAssessment.respiratoryRatePerMinute");
  }
  return conflicts;
}
