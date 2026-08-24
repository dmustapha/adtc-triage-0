# Triage-0 ADTC provenance and prior-work disclosure

**Status:** Pre-import plan. `applicationImported=false`; no Triage-0 application, data, public, or test file has been imported by this phase.

## Prior work

Triage-0 began as a non-commercial proof of concept and previously appeared in the June 2026 QVAC hackathon. This ADTC submission does not claim that the full application was built from scratch for ADTC.

The approved reuse baseline is the public repository `https://github.com/dmustapha/triage-0` at exact commit `74424721bc75f564808eacce42d7f7f42676ae0f`. The mutable working tree at `/Users/MAC/triage-0` is used only as a local Git object store: source bytes must come from `git show` at that commit, never from working-tree files.

## File-level ledger

`config/import-manifest.json` is the authoritative pre-import ledger. Its 76 planned entries record source path, destination path, Git blob object ID, SHA-256 of the bytes returned from the pinned Git object, original creation timestamp, classification, and purpose. The ledger maps the source `LICENSE` to `docs/licenses/TRIAGE-0-APACHE-2.0.txt` so the combined GPLv3 repository retains a readable copy of the reused application's license. `scripts/verify-import-manifest.ts` rejects drift, absent source paths, duplicate destinations, hashes that do not match the pinned object, empty records, and placeholders.

Each file is classified as:

- `reused`: initially copied byte-for-byte from the pinned source object;
- `modified-for-adtc`: based on the pinned source object but requiring a recorded ADTC patch, chiefly to remove optional speech, translation, and legacy model-path behavior;
- `adtc-new`: created specifically for this ADTC submission; or
- `third-party`: externally authored models, runtimes, protocols, or competition infrastructure.

The planned scope includes only the English text product, local RAG, deterministic clinical controls, localhost UI/assets, required tests and quality records, package inputs, protocol ingestion, and the SDK patch. It excludes speech-to-text, text-to-speech, translation, cloud deployment, demo/screenshots, mutable performance logs, and all model weights.

## License and notice preservation

The imported Triage-0 source declares Apache-2.0. Reused material remains subject to the **Apache License, Version 2.0**, including applicable copyright, license, attribution, and NOTICE-preservation obligations. The ADTC template's repository-level licensing does not erase those obligations; imported-file origin remains explicit in the ledger.

MedPsy's publisher declares the GGUF weights Apache-2.0 and the artifact is publicly accessible without credentials. The pinned model card also uses research/educational wording and discloses that CC-BY-NC 4.0 Genesis I and II subsets were used by a teacher model to generate synthetic training data. Exhaustive training-data provenance is not available. `config/model-license-decision.json` records these facts separately instead of converting a publisher license label into certainty about every upstream datum.

## ADTC-specific work

The ADTC work is planned to add the official template contract, a single checksum-locked MedPsy GGUF shared by the QVAC product and direct `llama.cpp` profiler, evidence isolation, x86 profiling, constrained-hardware validation, reproducible packaging, and ADTC-specific evaluation. The exact imported files and later modifications remain auditable rather than being described as a clean build.

## Open reviews and claim boundary

This disclosure is not legal advice and provides no legal certainty or organizer-eligibility certainty. Source-rights review, clinical adaptation review, named human clinical review, physical target-class Ubuntu evidence, and final organizer-facing disclosure remain mandatory. Until those gates close, the product is described only as an English, supervised, early proof-of-concept clinical decision-support system—not autonomous diagnosis or prescription and not a substitute for professional judgment.
