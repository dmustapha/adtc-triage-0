# Technical Report: Triage-0 ADTC

**Status:** Post-submission restored-workflow release; Devpost entry and existing video remain unchanged
**Domain:** `healthcare_medical`
**Language scope:** English only
**Team ID:** `triage-0` (verified Devpost project slug)
**Model:** MedPsy-1.7B Q4_K_M imatrix

## Current authoritative gate policy

The current product restores the original useful workflow behind stricter authority gates. It provides a supervised WHO clinical-review mode for pediatric IMCI and adult mhGAP cases plus a separate ordinary-prompt mode. Structured emergency and respiratory policy remains authoritative; model output may select only a supervised provisional WHO class, and a one-use confirmation can reveal only frozen source actions. The product does not diagnose, prescribe, convert model prose into treatment, or claim clinical validation.

Official submission requirements still include a current public official-template repository and report, completed team metadata and exactly two prompts, a credential-free checksum-verified downloader, no committed model weights, direct CPU-only `llama.cpp` with no inference-time egress and credible 8 GB viability, a full participant profiler run labeled with the actual development host, provenance and license disclosure, accessibility, claim consistency, final screenshots, and a video no longer than 120 seconds.

QVAC and RAG are not official submission artifacts. Real local QVAC/store/model-assisted execution is a product/UAT gate only while that behavior is shown or claimed. A performance CSV is also not an official submission artifact.

Physical target-laptop ownership, three cold boots, thermal soaks, hosted application deployment, named clinical review, signed model decisions, private release keys, organizer signatures, private sealed holdouts, and written reuse approval are not hard blockers under the approved scope. Exact prior-work provenance and transparent disclosure remain mandatory. Video publication, repository push, and any Devpost mutation remain separate actions. The user reports that the Devpost entry has already been submitted.

## Problem and target user

Triage-0 ADTC explores offline, supervised WHO assessment support for community health workers operating where connectivity, privacy, and compute are constrained. Pediatric respiratory cases add age, seven explicit observations, respiratory rate, and count quality so deterministic policy owns emergency escalation and threshold findings. Broader pediatric IMCI and adult mhGAP cases use local retrieval and MedPsy for supervised provisional review. The system is not a diagnostic tool, prescription system, or replacement for clinical judgment.

The current release proves deterministic respiratory surfaces, real local QVAC/WHO/MedPsy execution across broader IMCI and mhGAP cases, gated source actions after confirmation, off-domain abstention, and a separate two-pass ordinary-prompt workflow. It does not claim validated clinical behavior, named clinical review, organizer-audited performance, or that the already-submitted Devpost entry and existing video were updated.

## Design decisions

### One content-addressed model

The repository binds one public GGUF identity across the product and raw-profiler evidence contracts:

| Field | Frozen value |
|---|---|
| Repository | `qvac/MedPsy-1.7B-GGUF` |
| Revision | `fd4cecc90c2de8dce4b112795456a54be9c59363` |
| File | `medpsy-1.7b-q4_k_m-imat.gguf` |
| Bytes | `1,282,439,360` |
| SHA-256 | `41ee947d9cce72ec657577219fd1798fabeabf0d832217fe23c9d6d3d18d5880` |
| Quantization | GGUF Q4_K_M |
| License recorded by contract | Apache-2.0 |

`download_model.sh` installs only that identity and verifies its byte count and checksum before publishing the final local path. The exact 1,282,439,360-byte GGUF is present locally with the documented SHA-256, ignored and untracked. It has not been committed or uploaded.

### Separate evidence planes

The product contract names QVAC SDK 0.13.3 as the local orchestration runtime. The raw and profiler contract uses a pinned direct official `llama.cpp` path over the identical GGUF bytes. These evidence planes are intentionally separate: a direct raw-model response cannot prove product orchestration or clinical safety, and a local deterministic result cannot prove raw-model accuracy or profiler performance.

### Deterministic high-stakes control

The worker records patient age plus seven tri-state observations. Six observations can establish emergency escalation. Lower chest-wall indrawing is an age-scoped breathing observation and is not an emergency by itself. Missing, unsupported, or conflicting assessment data fails closed. Known structured emergencies complete before QVAC, retrieval, or model access. Model-authored prose and `red_flags` cannot recreate the seven authoritative observations.

## Alternatives and iteration history

Earlier OLMo candidates and an earlier MedPsy calibration failed frozen behavioral gates. Those results remain historical evidence and were not rewritten or tuned against. In particular, GitHub Actions run `32742482642` verified the exact MedPsy bytes but failed danger ownership, uncertainty fidelity, injection resistance, complete validity, and truncation gates. It did not run holdouts or the profiler and receives no passing product or performance credit.

The later structured-danger revision moved respiratory danger ownership into explicit worker observations and deterministic policy, then split QVAC product evidence from direct `llama.cpp` raw evidence. The current local revision has executed both planes without publishing or mutating external release state.

## Local verification at this checkpoint

Local verification completed across 2026-08-25 and 2026-08-26 produced:

- `npm run typecheck`: pass.
- `npm test`: 512 total, 512 pass, 0 fail, 0 skips, 0 cancelled, 0 todo (exclusive serialized post-remediation release run).
- Import provenance: 76 imported objects verified against public Triage-0 commit `74424721bc75f564808eacce42d7f7f42676ae0f`.
- Deterministic emergency, incomplete, outside-scope, chest-indrawing, and fast-rate HTTP/SSE paths pass with fixed source binding and zero QVAC/retrieval/model boundaries.
- Complete supported below-threshold records execute real local WHO retrieval and MedPsy assistance through QVAC SDK 0.13.3 without changing the deterministic public finding.
- Exact 49/50 and 39/40 respiratory threshold boundary tests pass.
- Chrome desktop and mobile: deterministic emergency and below-threshold respiratory results, broad IMCI and adult mhGAP provisional review, confirmed pneumonia source actions, off-domain abstention, both exact submitted prompts, cancellation/retry, two-tab queueing, no horizontal overflow, zero console errors/warnings, and effective visible controls at least 44px.
- The exact GGUF, 80-page WHO PDF, and 994-entry citation map match their frozen hashes. The GGUF remains ignored and untracked.
- Downloader idempotence, checksum, byte-count, resume, wrong-hash, wrong-size, and partial-preservation paths pass.

No repository test is skipped. Historical skip evidence remains historical and is not reused as current proof.

## Benchmarks

| Metric | Current reportable value |
|---|---|
| Official participant profiler result | Full 50-sample ARC-Easy participant run completed; `submission.json` generated locally |
| Actual development host label | MacBook Pro MacBookPro17,1; Apple M1; 8 GB; macOS 26.0.1; Apple development evidence |
| CPU-only performance and peak RSS | 26.54 generated tok/s; 4,274.7 ms first-token latency; 1,081.47 MB peak RSS |
| Accuracy | ARC-Easy `acc_norm` 0.70 over 50 samples |
| No-egress and 8 GB viability | Direct CPU-only runtime used four threads and zero GPU layers; model-backed no-egress and full test gates pass locally |
| QVAC product plane | QVAC SDK 0.13.3 executed real local WHO retrieval and MedPsy assistance; reported separately from official profiler evidence |

The generated profiler values are Apple development evidence, not organizer-audited scores. Participant identity is complete and consistent across `metadata.json` and `submission.json`.

## Submitted-prompt release gate

Exactly two prompts are byte-identical across `metadata.json`, `config/profiler-prompt-policy.json`, and generated `submission.json` after documented line-ending normalization. Prompt 2 is the comma-punctuation version. Their SHA-256 values are `1bed4182fe62e46bbae10bd6aedf56a2d25fd977fbab1744b55f55d612f8ed29` and `322b4dcff729d2deae7d3662212b0152bb9d123ee6e63f1aed9d785252292d74`.

1. `Summarize, in plain English, the recorded facts in this supervised pediatric respiratory case: a two-year-old has cough for three days; all seven structured danger and breathing observations were recorded absent. Separate observed facts from uncertainty. Do not diagnose, prescribe, or invent missing findings.`
2. `Explain, in plain English for a supervised community health worker, why an incomplete pediatric respiratory danger-sign checklist must be completed before model-assisted assessment review. State that recorded danger observations and deterministic policy, not model output, control escalation. Do not diagnose or prescribe.`

Both exact prompts now pass the restored application workflow without changing their bytes. The product uses the original-strength bounded pattern: a 1,024-token reasoning pass, schema-constrained extraction with a 512-token budget and bounded retries, followed by deterministic semantic validation. Three direct official CPU-only `llama.cpp` application-workflow repeats per prompt pass in `submission/profiler/submitted-prompt-official-product-exact-evidence-20260825T235000Z.json`; six QVAC exact executions pass in `submission/profiler/submitted-prompt-product-exact-evidence-20260825T221500Z.json`; and labeled paraphrase, contradiction, truncation/malformed, forbidden-claim, and prompt-injection checks pass in `submission/profiler/submitted-prompt-product-adversarial-evidence-20260825T223000Z.json`. Earlier failed and intermediate artifacts remain preserved. No submitted prompt was edited or tuned against historical run `32742482642`.

Prompt 1 separates recorded facts from uncertainty and does not invent a respiratory rate or fast-breathing status. Prompt 2 states that the incomplete checklist must be completed and that recorded observations plus deterministic policy, not model output, control escalation. Both remain free of diagnosis and prescription claims. Direct official evidence is pinned to official `llama.cpp` revision `c8ade30036139e32108fee53d8b7164dbfda4bee`, four CPU threads, `-ngl 0`, the exact GGUF hash, and the actual Apple development host label. Repeat wall times were variable: Prompt 1 took 18.916 s, 107.321 s, and 14.728 s; Prompt 2 took 120.622 s, 20.026 s, and 20.124 s. These are observed Apple development results, not a 15-second latency guarantee. QVAC SDK 0.13.3 evidence is reported separately.

## Constraints and unresolved gates

- Authenticated Devpost no longer exposes the saved prompt fields after the deadline redirect, so byte-for-byte Devpost parity, including Prompt 2 comma punctuation, remains externally unverified. The user confirmed the submission is complete and supplied the exact saved strings; this is an external archival-parity gap, not a pending local implementation gate.
- The full participant profiler completed and generated `submission.json`; the verified Devpost project slug and participant-confirmed submitter identity are present in both required JSON artifacts.
- Respiratory remediation is locally complete: policy-settled respiratory outcomes keep internal classification private; public diagnosis, medicine, dose, treatment, and management-plan output is suppressed at server and renderer boundaries. The broader supervised workflow retains source-bound provisional classification and one-use human confirmation where deterministic respiratory policy has not already settled the result.
- Known routes called with unsupported methods return explicit JSON 405 responses with exact `Allow` headers, and an empty `/perf-log.csv` returns a truthful 200 header-only CSV.
- Current desktop and mobile screenshots prove deterministic respiratory, broad provisional/confirmed WHO, off-domain, exact-prompt, queue/cancel/retry, and responsive states. Final submission media remain separate artifacts.
- The restored repository and report are the authorized GitHub release surface. Devpost and video publication remain separate and unchanged.

## Reproducibility boundary

The repository contains the exact model identity, checksum-aware provisioner, metadata contract, structured-danger tests, separate evidence producers, immutable import ledger, and local application code. A future release can be considered only after the applicable real-runtime product/UAT gate, official profiler, identity, media, public-artifact, and publication gates are completed without weakening deterministic danger ownership or provenance.
