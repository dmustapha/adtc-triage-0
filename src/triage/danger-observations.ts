import type { Severity } from "./schema.js";

export const DANGER_OBSERVATION_KEYS = [
  "cannotDrinkOrBreastfeed",
  "vomitsEverything",
  "convulsions",
  "lethargicOrUnconscious",
  "chestIndrawing",
  "stridorWhenCalm",
  "lowOxygenOrCentralCyanosis",
] as const;

export const EMERGENCY_OBSERVATION_KEYS = DANGER_OBSERVATION_KEYS.filter(
  (key) => key !== "chestIndrawing",
);

export type DangerObservationKey = (typeof DANGER_OBSERVATION_KEYS)[number];
export type DangerObservationRequestValue = "PRESENT" | "ABSENT" | "NOT_ASSESSED";
export type DangerObservationInternalValue = DangerObservationRequestValue | "CONFLICT";
export type DangerObservations = Record<DangerObservationKey, DangerObservationInternalValue>;
export type PatientAge = { value: number; unit: "months" | "years" };

export type DangerDecision = {
  route: "DETERMINISTIC_EMERGENCY" | "ASSESSMENT_REQUIRED" | "NON_EMERGENCY_PNEUMONIA" | "QVAC";
  severity: Severity;
  modelInvoked: boolean;
  observations: DangerObservations;
  presentEmergencyKeys: DangerObservationKey[];
  summary: string;
};

const INTERNAL_VALUES = new Set<DangerObservationInternalValue>([
  "PRESENT",
  "ABSENT",
  "NOT_ASSESSED",
  "CONFLICT",
]);

export function normalizePatientAge(age: PatientAge): { months: number; supported: boolean } {
  if (!age || !Number.isFinite(age.value) || age.value < 0) throw new TypeError("patient age must be finite and non-negative");
  if (age.unit !== "months" && age.unit !== "years") throw new TypeError("patient age unit must be months or years");
  const months = age.unit === "years" ? age.value * 12 : age.value;
  return { months, supported: months >= 2 && months < 60 };
}

export function normalizeDangerObservations(
  input: Partial<Record<DangerObservationKey, DangerObservationInternalValue>> = {},
): DangerObservations {
  return Object.fromEntries(DANGER_OBSERVATION_KEYS.map((key) => {
    const value = input[key] ?? "NOT_ASSESSED";
    if (!INTERNAL_VALUES.has(value)) throw new TypeError(`invalid danger observation: ${key}`);
    return [key, value];
  })) as DangerObservations;
}

export function evaluateDangerPolicy(
  patientAge: PatientAge | undefined,
  input: Partial<Record<DangerObservationKey, DangerObservationInternalValue>> = {},
): DangerDecision {
  const observations = normalizeDangerObservations(input);
  const presentEmergencyKeys = EMERGENCY_OBSERVATION_KEYS.filter((key) => observations[key] === "PRESENT");
  if (presentEmergencyKeys.length) return decision("DETERMINISTIC_EMERGENCY", "EMERGENCY", false, observations, presentEmergencyKeys);

  const age = patientAge ? normalizePatientAge(patientAge) : undefined;
  const incomplete = DANGER_OBSERVATION_KEYS.some((key) => ["NOT_ASSESSED", "CONFLICT"].includes(observations[key]));
  if (!age?.supported || incomplete) return decision("ASSESSMENT_REQUIRED", "UNKNOWN", false, observations, []);
  if (observations.chestIndrawing === "PRESENT") return decision("NON_EMERGENCY_PNEUMONIA", "URGENT", false, observations, []);
  return decision("QVAC", "UNKNOWN", true, observations, []);
}

export function summarizeDangerDecision(result: DangerDecision): string {
  return result.summary;
}

function decision(
  route: DangerDecision["route"],
  severity: Severity,
  modelInvoked: boolean,
  observations: DangerObservations,
  presentEmergencyKeys: DangerObservationKey[],
): DangerDecision {
  const summaries = {
    DETERMINISTIC_EMERGENCY: `Structured emergency observations present: ${presentEmergencyKeys.join(", ")}.`,
    ASSESSMENT_REQUIRED: "Structured danger assessment is incomplete or outside the supported age band.",
    NON_EMERGENCY_PNEUMONIA: "Chest indrawing is present in the supported age band; follow the non-emergency pneumonia branch.",
    QVAC: "All seven structured danger observations are absent; proceed to QVAC.",
  };
  return { route, severity, modelInvoked, observations, presentEmergencyKeys, summary: summaries[route] };
}
