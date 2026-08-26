import { createHash } from "node:crypto";
import { DANGER_OBSERVATION_KEYS, normalizePatientAge } from "./danger-observations.js";
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

function conflictsWithPresence(text: string, present: RegExp, absent: RegExp, value: unknown): boolean {
  if (present.test(text)) return value !== "PRESENT";
  if (absent.test(text)) return value !== "ABSENT";
  return false;
}

export function findNarrativeConflicts(record: CanonicalClinicalRecord): string[] {
  const text = record.narrative.text;
  const conflicts: string[] = [];
  const age = narrativeAgeMonths(text);
  if (age !== null && record.ageMonths !== null && age !== record.ageMonths) conflicts.push("patientAge");

  if (conflictsWithPresence(text, /\b(?:cannot|can't|unable to)\s+(?:drink|breastfeed)\b/i, /\b(?:(?:can|able to)\s+(?:drink|breastfeed)|alert and drinking|still drinking|drinking well)\b/i, record.dangerObservations.cannotDrinkOrBreastfeed)) {
    conflicts.push("dangerObservations.cannotDrinkOrBreastfeed");
  }
  if (conflictsWithPresence(text, /\b(?:has|with|shows?)\s+chest indrawing\b/i, /\b(?:no|without)\s+chest indrawing\b/i, record.dangerObservations.chestIndrawing)) {
    conflicts.push("dangerObservations.chestIndrawing");
  }

  const rate = narrativeRate(text);
  if (rate !== null && record.respiratoryAssessment?.respiratoryRatePerMinute != null
    && rate !== record.respiratoryAssessment.respiratoryRatePerMinute) {
    conflicts.push("respiratoryAssessment.respiratoryRatePerMinute");
  }
  return conflicts;
}
