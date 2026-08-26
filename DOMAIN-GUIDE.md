# Triage-01 Domain Guide

This guide defines the bounded language used by Triage-01. Respiratory rules and source-derived wording remain pending named clinical, rights, currency, and local-adaptation review; this document does not convert pending sources into approved clinical authority.

## Core terms

| Domain term | Definition in Triage-01 | Code identifier/source |
|---|---|---|
| Supported cohort | Child aged 2 through 59 months with cough or difficult breathing | `supportedAgeMonths`, `Complaint` |
| General danger sign | Explicit worker-recorded inability to drink/breastfeed, vomiting everything, convulsion, or lethargy/unconsciousness | `applyPolicy` |
| Calm observation | Respiratory rate and stridor recorded while the child is calm | Intake labels and source locator |
| Referral criterion | Deterministic matched rule requiring urgent locally governed review/referral; not a diagnosis | `REFERRAL_CRITERION_DETECTED` |
| Prompt review criterion | Chest indrawing or age-banded fast breathing requiring prompt clinical review | `PROMPT_CLINICAL_REVIEW` |
| Alternate pathway | Prolonged cough or wheeze needing qualified review outside this pathway | `ALTERNATE_PATHWAY_REVIEW` |
| Insufficient/ambiguous | Missing, unknown, or conflicting required observation | `INSUFFICIENT_OR_AMBIGUOUS` |
| No criterion detected | Complete entered data matched no configured escalation rule; never means safe/normal | `NO_ESCALATION_CRITERION_DETECTED_IN_ENTERED_DATA` |
| Source binding | Final IDs/actions come only from reviewed local records | `bindSources` |
| Raw-model plane | Direct model quality/performance independent of app controls | profiler/holdout evidence |
| Product plane | Full workflow safety, sources, parity, privacy, offline, and resource evidence | app/test evidence |
| Canonical GGUF | One selected model file shared by app and profiler | `ModelLock.outputPath` |

## Invariants

1. Model extraction cannot create or downgrade high-stakes observations.
2. Deterministic referral precedence outranks every lower state.
3. Unknown or unreviewed source IDs fail closed.
4. “No escalation criterion detected in entered data” is not a safety conclusion.
5. No diagnosis, prescription, dose, phone number, facility, or model-authored citation reaches the UI.
6. App and profiler use the same GGUF SHA-256.
7. No inference-time network access and no second medical LLM.

## Source mapping and review state

- Product scope and claims: `PRD.md` Sections 1, 4, 15, and 16.
- Respiratory rules: `WHO-IMCI-RESP-2022` — pending review.
- Digital workflow principles: `WHO-CHILD-DAK-2024` — pending review.
- ADTC runtime/evidence contract: active brief and official profiler source.
- Provenance: `FORGE-INTAKE.md` and `research/TRIAGE-0-PROVENANCE-AND-ADTC-INTEGRATION-DECISION.md` as provenance declarations only, never implementation inputs.
