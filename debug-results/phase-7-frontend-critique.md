# Phase 7 Frontend Critique

## Summary

The compact visual hierarchy and progressive structured assessment are preserved, and the form has solid accessible labels, native controls, focus behavior, fail-closed enablement, cancellation UI, and escaped dynamic rendering. The remaining problem is truthfulness and scope, not layout quality.

## Findings

### Critical: output vocabulary exceeds the product claim

The card is tested as `diagnosis-first` and can show a named classification, medicines, dose bands, supportive care, and follow-up. The controlling PRD says the product does not diagnose, prescribe, or determine treatment. Until reconciled, this UI cannot support a submission-readiness claim.

### Fixed: stale broad-scope entry point

The example button inserted a diarrhoea case although the supported cohort is cough or difficult breathing in children aged 2 through 59 months. Commit `0dafaa2` replaces it with an in-scope respiratory case.

### Fixed: runtime labels were hardcoded

`MedPsy 1.7B · GPU` and `1 of 27 WHO classes` were presentation constants, not observations. Commit `0dafaa2` replaces them with exact QVAC SDK 0.13.3 on-device identity and schema-validation wording. Measured backend remains confined to post-run performance telemetry.

### Fixed by coordinated UI TDD

The original page made a completed-run/no-network claim before a run and could simultaneously display `Online`. Commit `8d7b767` makes pre-run evidence conditional and labels navigator state as browser reachability rather than inference egress proof.

### Low: dormant excluded-modality code

Speech resampling, multilingual dictionaries, translation labels, and TTS configuration remain in imported code even though controls/routes are absent. They do not currently execute, but removal would simplify the English-only baseline and reduce accidental future claims.

## Evidence

- Frontend/SSE focused run: 20 total, 17 pass, 0 fail, 3 model/store skips.
- Existing Chrome fidelity evidence remains the Build-owned 20/20/typecheck/76-entry/screenshot set; this sub-audit did not alter layout.
