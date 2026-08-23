export type TriState = true | false | "unknown";

export type Complaint = "COUGH" | "DIFFICULT_BREATHING" | "OTHER";

export type ReviewState =
  | "REFERRAL_CRITERION_DETECTED"
  | "PROMPT_CLINICAL_REVIEW"
  | "ALTERNATE_PATHWAY_REVIEW"
  | "NO_ESCALATION_CRITERION_DETECTED_IN_ENTERED_DATA"
  | "INSUFFICIENT_OR_AMBIGUOUS"
  | "OUTSIDE_SUPPORTED_SCOPE"
  | "INVALID_OUTPUT_OR_SYSTEM_FAILURE";

export interface AssessmentInput {
  ageMonths: number;
  complaint: Complaint;
  durationDays: number | "unknown";
  canDrinkOrBreastfeed: TriState;
  vomitsEverything: TriState;
  convulsions: TriState;
  lethargicOrUnconscious: TriState;
  respiratoryRatePerMinute: number | "unknown";
  chestIndrawing: TriState;
  stridorWhenCalm: TriState;
  wheeze: TriState;
  recurrentWheeze: TriState;
  observationsConflict: TriState;
  mimicConcern: TriState;
  spo2Percent: number | null;
  note: string;
}

export interface ModelExtraction {
  uncertainties: string[];
  normalizedObservations: string[];
}

export interface SourceRecord {
  id: string;
  title: string;
  publisher: string;
  jurisdiction: string;
  version: string;
  url: string;
  locator: string;
  retrievedAt: string;
  sha256: string;
  bytes: number;
  derivedContentSha256: string;
  rightsStatus: "review-required" | "approved";
  reviewStatus: "pending" | "reviewed";
  rightsReviewedBy: string;
  clinicallyReviewedBy: string;
  attestedAt: string;
  attestationSignature: string;
  facts: string[];
  limitations: string[];
}

export interface ReviewResult {
  state: ReviewState;
  matchedCriteria: string[];
  missingObservations: string[];
  summary: string;
  sourceIds: string[];
  limitations: string[];
  model: { name: string; sha256: string; runtime: string };
  requestMetrics: { elapsedMs: number; warm: boolean; ttftMs: null; generationMs: null };
}

export interface ModelCandidate {
  candidateId: string;
  name: string;
  revision: string;
  url: string;
  filename: string;
  outputPath: string;
  bytes: number;
  sha256: string;
  quantization: string;
  parametersEstimate: string;
  license: "Apache-2.0";
}

export interface ModelLock extends ModelCandidate {
  chatTemplateSha256: string;
  generationPolicySha256: string;
  evidenceBundleSha256: string;
}
