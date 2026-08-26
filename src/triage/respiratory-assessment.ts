import {
  DANGER_OBSERVATION_KEYS,
  EMERGENCY_OBSERVATION_KEYS,
  normalizeDangerObservations,
  normalizePatientAge,
  type DangerObservationKey,
  type DangerObservationInternalValue,
  type DangerObservations,
  type PatientAge,
} from "./danger-observations.js";

export type RespiratoryConcern = "PRESENT" | "ABSENT" | "NOT_ASSESSED";
export type RateCountQuality = "ONE_MINUTE_WHILE_CALM" | "NOT_CONFIRMED";

export type RespiratoryAssessmentInput = {
  coughOrDifficultBreathing?: RespiratoryConcern;
  respiratoryRatePerMinute?: number;
  rateCountQuality?: RateCountQuality;
};

export type RespiratoryOutcome =
  | "EMERGENCY"
  | "ASSESSMENT_REQUIRED"
  | "PROMPT_SUPERVISED_REVIEW"
  | "NO_ESCALATION_CRITERION_RECORDED"
  | "OUTSIDE_SUPPORTED_SCOPE";

type ThresholdComparison = {
  respiratoryRatePerMinute: number;
  thresholdPerMinute: number;
  relation: "AT_OR_ABOVE" | "BELOW";
};

export type RespiratoryDecision = {
  outcome: RespiratoryOutcome;
  modelInvoked: boolean;
  finding: string;
  basis: string;
  nextAssessmentStep: string;
  matchedCriteria: string[];
  missingFields: string[];
  recorded: {
    ageMonths: number | null;
    coughOrDifficultBreathing: RespiratoryConcern;
    respiratoryRatePerMinute: number | null;
    rateCountQuality: RateCountQuality;
    observations: DangerObservations;
  };
  thresholdComparison: ThresholdComparison | null;
  emergencyObservations: DangerObservationKey[];
  sourceRule: {
    doc: "WHO IMCI Chart Booklet (2014)";
    page: 6;
    section: string;
    provenance: "fixed-policy";
  };
  uncertainty: string;
};

const SOURCE_RULE = {
  doc: "WHO IMCI Chart Booklet (2014)" as const,
  page: 6 as const,
  section: "Count breaths for one minute while the child is calm; use the age-banded fast-breathing threshold.",
  provenance: "fixed-policy" as const,
};

const DANGER_SOURCE_RULE = {
  ...SOURCE_RULE,
  section: "Check general danger signs and breathing observations before applying the respiratory assessment pathway.",
};

const CHEST_SOURCE_RULE = {
  ...SOURCE_RULE,
  section: "Look for chest indrawing as a recorded breathing observation.",
};

const OBSERVATION_LABELS: Record<DangerObservationKey, string> = {
  cannotDrinkOrBreastfeed: "cannot drink or breastfeed",
  vomitsEverything: "vomits everything",
  convulsions: "convulsions",
  lethargicOrUnconscious: "lethargic or unconscious",
  chestIndrawing: "chest indrawing",
  stridorWhenCalm: "stridor when calm",
  lowOxygenOrCentralCyanosis: "low oxygen or central cyanosis",
};

export function fastBreathingThreshold(age: PatientAge): 40 | 50 {
  const normalized = normalizePatientAge(age);
  if (!normalized.supported) throw new RangeError("patient age is outside the supported 2-59 month band");
  return normalized.months < 12 ? 50 : 40;
}

function missingDangerFields(observations: DangerObservations): string[] {
  return DANGER_OBSERVATION_KEYS
    .filter((key) => observations[key] === "NOT_ASSESSED" || observations[key] === "CONFLICT")
    .map((key) => `dangerObservations.${key}`);
}

function recordedValues(
  age: PatientAge | undefined,
  observations: DangerObservations,
  respiratory: RespiratoryAssessmentInput | undefined,
): RespiratoryDecision["recorded"] {
  let ageMonths: number | null = null;
  try { ageMonths = age ? normalizePatientAge(age).months : null; } catch { ageMonths = null; }
  return {
    ageMonths,
    coughOrDifficultBreathing: respiratory?.coughOrDifficultBreathing ?? "NOT_ASSESSED",
    respiratoryRatePerMinute: respiratory?.respiratoryRatePerMinute ?? null,
    rateCountQuality: respiratory?.rateCountQuality ?? "NOT_CONFIRMED",
    observations,
  };
}

function decision(
  recorded: RespiratoryDecision["recorded"],
  values: Omit<RespiratoryDecision, "recorded" | "sourceRule" | "uncertainty">,
): RespiratoryDecision {
  return {
    ...values,
    recorded,
    sourceRule: values.outcome === "EMERGENCY"
      ? DANGER_SOURCE_RULE
      : values.matchedCriteria.includes("CHEST_INDRAWING") ? CHEST_SOURCE_RULE : SOURCE_RULE,
    uncertainty: "This limited assessment finding does not rule out illness and does not replace clinical judgment.",
  };
}

function incompleteDecision(
  recorded: RespiratoryDecision["recorded"],
  missingFields: string[],
  finding: string,
): RespiratoryDecision {
  return decision(recorded, {
    outcome: "ASSESSMENT_REQUIRED",
    modelInvoked: false,
    finding,
    basis: "The deterministic respiratory assessment cannot apply the WHO threshold until the required observations are recorded.",
    nextAssessmentStep: "Complete the missing recorded observations before continuing.",
    matchedCriteria: [],
    missingFields,
    thresholdComparison: null,
    emergencyObservations: [],
  });
}

function rateDecision(recorded: RespiratoryDecision["recorded"]): RespiratoryDecision {
  const thresholdPerMinute = recorded.ageMonths! < 12 ? 50 : 40;
  const respiratoryRatePerMinute = recorded.respiratoryRatePerMinute!;
  const fast = respiratoryRatePerMinute >= thresholdPerMinute;
  const ageBand = recorded.ageMonths! < 12 ? "2–11 months" : "12–59 months";
  const comparison: ThresholdComparison = {
    respiratoryRatePerMinute,
    thresholdPerMinute,
    relation: fast ? "AT_OR_ABOVE" : "BELOW",
  };
  return decision(recorded, {
    outcome: fast ? "PROMPT_SUPERVISED_REVIEW" : "NO_ESCALATION_CRITERION_RECORDED",
    modelInvoked: !fast,
    finding: fast
      ? `Fast-breathing criterion recorded: ${respiratoryRatePerMinute}/min is at or above the WHO threshold of ${thresholdPerMinute}/min for ${ageBand}.`
      : "No emergency observation, chest indrawing, or age-banded fast-breathing criterion was detected in the entered data.",
    basis: `${respiratoryRatePerMinute}/min is ${fast ? "at or above" : "below"} the recorded-age threshold of ${thresholdPerMinute}/min; the count was confirmed for one minute while calm.`,
    nextAssessmentStep: fast
      ? "Arrange prompt supervised clinical assessment."
      : "Continue the supervised clinical assessment; this finding alone does not rule out illness.",
    matchedCriteria: fast ? ["FAST_BREATHING"] : [],
    missingFields: [],
    thresholdComparison: comparison,
    emergencyObservations: [],
  });
}

export function evaluateRespiratoryAssessment(
  age: PatientAge | undefined,
  input: Partial<Record<DangerObservationKey, DangerObservationInternalValue>> = {},
  respiratory?: RespiratoryAssessmentInput,
): RespiratoryDecision {
  const observations = normalizeDangerObservations(input);
  const recorded = recordedValues(age, observations, respiratory);
  const emergencyObservations = EMERGENCY_OBSERVATION_KEYS.filter((key) => observations[key] === "PRESENT");
  if (emergencyObservations.length) {
    return decision(recorded, {
      outcome: "EMERGENCY", modelInvoked: false,
      finding: "One or more recorded emergency observations require immediate escalation.",
      basis: `Recorded emergency observations: ${emergencyObservations.map((key) => OBSERVATION_LABELS[key]).join(", ")}.`,
      nextAssessmentStep: "Seek emergency clinical assessment now.",
      matchedCriteria: ["EMERGENCY_OBSERVATION"], missingFields: [], thresholdComparison: null,
      emergencyObservations,
    });
  }

  const dangerMissing = missingDangerFields(observations);
  if (!age || recorded.ageMonths === null || recorded.ageMonths < 2 || recorded.ageMonths >= 60 || dangerMissing.length) {
    const missing = [...(!age || recorded.ageMonths === null || recorded.ageMonths < 2 || recorded.ageMonths >= 60 ? ["patientAge"] : []), ...dangerMissing];
    return incompleteDecision(recorded, missing, "The required age or danger and breathing observations are incomplete or outside the supported age band.");
  }

  if (recorded.coughOrDifficultBreathing === "NOT_ASSESSED") {
    return incompleteDecision(recorded, ["respiratoryAssessment.coughOrDifficultBreathing"], "Cough or difficult breathing was not assessed.");
  }
  if (recorded.coughOrDifficultBreathing === "ABSENT") {
    return decision(recorded, {
      outcome: "OUTSIDE_SUPPORTED_SCOPE", modelInvoked: false,
      finding: "No cough or difficult breathing was recorded, so this respiratory route does not apply.",
      basis: "Triage-0 is limited to supervised pediatric respiratory assessment.",
      nextAssessmentStep: "Use an appropriate supervised clinical assessment for the recorded concern.",
      matchedCriteria: [], missingFields: [], thresholdComparison: null, emergencyObservations: [],
    });
  }

  if (observations.chestIndrawing === "PRESENT") {
    return decision(recorded, {
      outcome: "PROMPT_SUPERVISED_REVIEW", modelInvoked: false,
      finding: "Chest indrawing was recorded and requires prompt supervised clinical review.",
      basis: "Chest indrawing is a recorded breathing observation; it is not labeled as an emergency observation by itself.",
      nextAssessmentStep: "Arrange prompt supervised clinical assessment.",
      matchedCriteria: ["CHEST_INDRAWING"], missingFields: [], thresholdComparison: null, emergencyObservations: [],
    });
  }

  const missingRate = recorded.respiratoryRatePerMinute === null
    ? ["respiratoryAssessment.respiratoryRatePerMinute"] : [];
  const missingQuality = recorded.rateCountQuality !== "ONE_MINUTE_WHILE_CALM"
    ? ["respiratoryAssessment.rateCountQuality"] : [];
  if (missingRate.length || missingQuality.length) {
    const missingFields = [...missingRate, ...missingQuality];
    const finding = missingRate.length
      ? "No emergency observations are recorded, but the breathing rate was not recorded, so fast breathing cannot be assessed."
      : "The breathing count was not confirmed for one minute while the child was calm, so fast breathing cannot be assessed.";
    return incompleteDecision(recorded, missingFields, finding);
  }
  return rateDecision(recorded);
}
