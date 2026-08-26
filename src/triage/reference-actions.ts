import type { Severity, ManagementPlan, DoseStateSchema } from "./schema.js";
import { docFor, emergencyReferral, lookupProtocol, type DoseBand, type ProtocolEntry } from "./protocol-table.js";
import type { z } from "zod";

export type ReferenceEligibility = {
  confirmationState: "CONFIRMED" | "UNCONFIRMED" | "REJECTED" | "EXPIRED" | "REPLAYED";
  patientAgeMonths?: number;
  patientWeightKg?: number;
  allergiesReviewed: "CONFIRMED_NONE" | "PRESENT" | "NOT_ASSESSED";
  contraindicationsReviewed: "CONFIRMED_NONE" | "PRESENT" | "NOT_ASSESSED";
  protocolApplicability: "CONFIRMED_APPLICABLE" | "NOT_APPLICABLE" | "NOT_ASSESSED";
};

export type ReferenceActionResult = {
  referenceActions: ManagementPlan | null;
  doseState: z.infer<typeof DoseStateSchema>;
};

type BandRange = {
  ageMin?: number;
  ageMax?: number;
  weightMin?: number;
  weightMax?: number;
  inclusiveWeightMax?: boolean;
};

const BAND_RANGES: Record<string, BandRange> = {
  "2 months up to 12 months (4 - <10 kg)": { ageMin: 2, ageMax: 12, weightMin: 4, weightMax: 10 },
  "12 months up to 3 years (10 - <14 kg)": { ageMin: 12, ageMax: 36, weightMin: 10, weightMax: 14 },
  "3 years up to 5 years (14-19 kg)": { ageMin: 36, ageMax: 60, weightMin: 14, weightMax: 19, inclusiveWeightMax: true },
  "Less than 6 months": { ageMax: 6 },
  "6 months up to 5 years": { ageMin: 6, ageMax: 60 },
  "2 months up to 6 months": { ageMin: 2, ageMax: 6 },
  "6 months or more": { ageMin: 6 },
  "5 - <10 kg (2 months up to 12 months)": { ageMin: 2, ageMax: 12, weightMin: 5, weightMax: 10 },
  "10 - <14 kg (12 months up to 3 years)": { ageMin: 12, ageMax: 36, weightMin: 10, weightMax: 14 },
  "14 - <19 kg (3 years up to 5 years)": { ageMin: 36, ageMax: 60, weightMin: 14, weightMax: 19 },
  "< 6 kg (up to 4 months)": { ageMax: 4, weightMax: 6 },
  "6 - <10 kg (4 months up to 12 months)": { ageMin: 4, ageMax: 12, weightMin: 6, weightMax: 10 },
  "10 - <12 kg (12 months up to 2 years)": { ageMin: 12, ageMax: 24, weightMin: 10, weightMax: 12 },
  "12 - 19 kg (2 years up to 5 years)": { ageMin: 24, ageMax: 60, weightMin: 12, weightMax: 19, inclusiveWeightMax: true },
  "2 months up to 4 months (4 - <6 kg)": { ageMin: 2, ageMax: 4, weightMin: 4, weightMax: 6 },
  "4 months up to 12 months (6 - <10 kg)": { ageMin: 4, ageMax: 12, weightMin: 6, weightMax: 10 },
  "3 years up to 5 years (14 - 19 kg)": { ageMin: 36, ageMax: 60, weightMin: 14, weightMax: 19, inclusiveWeightMax: true },
};

function rangeMatches(range: BandRange, age: number, weight: number): boolean {
  if (range.ageMin !== undefined && age < range.ageMin) return false;
  if (range.ageMax !== undefined && age >= range.ageMax) return false;
  if (range.weightMin !== undefined && weight < range.weightMin) return false;
  if (range.weightMax === undefined) return true;
  return range.inclusiveWeightMax ? weight <= range.weightMax : weight < range.weightMax;
}

function matchingBand(bands: DoseBand[], age: number, weight: number): DoseBand | null {
  const matches = bands.filter((band) => {
    const range = BAND_RANGES[band.band];
    return range ? rangeMatches(range, age, weight) : false;
  });
  return matches.length === 1 ? matches[0]! : null;
}

function medicineBearingImmediate(entry: ProtocolEntry): boolean {
  if (!entry.medicines.length) return false;
  const text = entry.action.text.toLowerCase();
  const namedMedicine = entry.medicines.some((medicine) => {
    const names = medicine.name.toLowerCase().split(/\s*\+\s*|\s*\(|\//).filter((name) => name.length > 3);
    return names.some((name) => text.includes(name));
  });
  return namedMedicine || /antibiotic|antimalarial|artesunate|quinine|zinc|\biron\b|therapeutic food|antiepileptic|medication/.test(text);
}

function sourcePlan(entry: ProtocolEntry, severity: Severity, selectedBands: Map<string, DoseBand> | null): ManagementPlan {
  const doc = docFor(entry.protocol);
  const cite = (page: number) => ({ doc, page });
  const medicines = selectedBands === null ? [] : entry.medicines.map((medicine) => ({
    name: medicine.name,
    strength: medicine.strength,
    dose: medicine.dose,
    frequency: medicine.frequency,
    bands: medicine.bands?.map((band) => ({ ...band, citation: cite(medicine.page) })),
    ...(medicine.bands && selectedBands.get(medicine.name)
      ? { selectedBand: { ...selectedBands.get(medicine.name)!, citation: cite(medicine.page) } }
      : {}),
    citation: cite(medicine.page),
  }));
  const referral = entry.referral ?? (severity === "EMERGENCY" ? emergencyReferral(entry.protocol) : null);
  return {
    medicines,
    supportive: entry.supportive.map((line) => ({ item: line.text, citation: cite(line.page) })),
    home_care: entry.home_care.map((line) => ({ advice: line.text, citation: cite(line.page) })),
    return_now: entry.return_now.map((line) => ({ sign: line.text, citation: cite(line.page) })),
    follow_up: entry.follow_up ? {
      when: entry.follow_up.text,
      detail: entry.follow_up_detail?.text,
      citation: cite(entry.follow_up.page),
      ...(entry.follow_up_detail ? { detailCitation: cite(entry.follow_up_detail.page) } : {}),
    } : null,
    referral: referral ? { criterion: referral.text, citation: cite(referral.page) } : null,
    ...(!(selectedBands === null && medicineBearingImmediate(entry))
      ? { immediateAction: { text: entry.action.text, citation: cite(entry.action.page) } }
      : {}),
  };
}

function lockedPlan(entry: ProtocolEntry, severity: Severity): ManagementPlan {
  return sourcePlan(entry, severity, null);
}

function missingInputs(eligibility: ReferenceEligibility): string[] {
  return [
    ...(eligibility.patientAgeMonths === undefined ? ["patientAge"] : []),
    ...(eligibility.patientWeightKg === undefined ? ["patientWeightKg"] : []),
  ];
}

function safetyReady(eligibility: ReferenceEligibility): boolean {
  return eligibility.allergiesReviewed === "CONFIRMED_NONE"
    && eligibility.contraindicationsReviewed === "CONFIRMED_NONE"
    && eligibility.protocolApplicability === "CONFIRMED_APPLICABLE";
}

function selectBands(entry: ProtocolEntry, age: number, weight: number): Map<string, DoseBand> | null {
  const selected = new Map<string, DoseBand>();
  for (const medicine of entry.medicines) {
    if (!medicine.bands) continue;
    const band = matchingBand(medicine.bands, age, weight);
    if (!band) return null;
    selected.set(medicine.name, band);
  }
  return selected;
}

export function projectReferenceActions(
  classification: string,
  severity: Severity,
  eligibility: ReferenceEligibility,
): ReferenceActionResult {
  if (eligibility.confirmationState !== "CONFIRMED") {
    return { referenceActions: null, doseState: { status: "LOCKED_SAFETY_REVIEW", missingFields: [] } };
  }
  const entry = lookupProtocol(classification);
  if (!entry) return { referenceActions: null, doseState: { status: "NOT_APPLICABLE", missingFields: [] } };
  if (entry.medicines.length === 0) {
    return { referenceActions: sourcePlan(entry, severity, new Map()), doseState: { status: "NOT_APPLICABLE", missingFields: [], medicineReferenceAvailable: false } };
  }

  const hasDoseBands = entry.medicines.some((medicine) => Boolean(medicine.bands?.length));
  if (!hasDoseBands) {
    if (!safetyReady(eligibility)) {
      return { referenceActions: lockedPlan(entry, severity), doseState: { status: "LOCKED_SAFETY_REVIEW", missingFields: [], medicineReferenceAvailable: true } };
    }
    return { referenceActions: sourcePlan(entry, severity, new Map()), doseState: { status: "NOT_APPLICABLE", missingFields: [], medicineReferenceAvailable: true } };
  }

  const missingFields = missingInputs(eligibility);
  if (missingFields.length) {
    return { referenceActions: lockedPlan(entry, severity), doseState: { status: "LOCKED_MISSING_INPUTS", missingFields, medicineReferenceAvailable: true } };
  }
  if (!safetyReady(eligibility)) {
    return { referenceActions: lockedPlan(entry, severity), doseState: { status: "LOCKED_SAFETY_REVIEW", missingFields: [], medicineReferenceAvailable: true } };
  }

  const selectedBands = selectBands(entry, eligibility.patientAgeMonths!, eligibility.patientWeightKg!);
  if (!selectedBands) {
    return { referenceActions: lockedPlan(entry, severity), doseState: { status: "LOCKED_SAFETY_REVIEW", missingFields: [], medicineReferenceAvailable: true } };
  }
  const status = selectedBands.size ? "AVAILABLE_REFERENCE_BAND" : "NOT_APPLICABLE";
  return { referenceActions: sourcePlan(entry, severity, selectedBands), doseState: { status, missingFields: [], medicineReferenceAvailable: true } };
}
