# Technical Report: Triage-0 ADTC

**Status:** Post-submission restored-workflow release; Devpost entry and existing video remain unchanged
**Domain:** `healthcare_medical`
**Language scope:** English only
**Team ID:** `triage-0` (verified Devpost project slug)
**Model:** MedPsy-1.7B Q4_K_M imatrix

## Current authoritative gate policy

The current product restores the original useful workflow behind stricter authority gates. It presents one textarea, one **Get guidance** action and one shared result region, then routes internally to supervised WHO clinical review or bounded ordinary-prompt assistance. Structured emergency and respiratory policy remains authoritative; model output may select only a supervised provisional WHO class, and a one-use confirmation can reveal only frozen source actions. The product does not diagnose, prescribe, convert model prose into treatment, or claim clinical validation.

Official submission requirements still include a current public official-template repository and report, completed team metadata and exactly two prompts, a credential-free checksum-verified downloader, no committed model weights, direct CPU-only `llama.cpp` with no inference-time egress and credible 8 GB viability, a full participant profiler run labeled with the actual development host, provenance and license disclosure, accessibility, claim consistency, final screenshots, and a video no longer than 120 seconds.

QVAC and RAG are not official submission artifacts. Real local QVAC/store/model-assisted execution is a product/UAT gate only while that behavior is shown or claimed. A performance CSV is also not an official submission artifact.

Physical target-laptop ownership, three cold boots, thermal soaks, hosted application deployment, named clinical review, signed model decisions, private release keys, organizer signatures, private sealed holdouts, and written reuse approval are not hard blockers under the approved scope. Exact prior-work provenance and transparent disclosure remain mandatory. Video publication, repository push, and any Devpost mutation remain separate actions. The user reports that the Devpost entry has already been submitted.

## Problem and target user

Triage-0 ADTC explores offline, supervised WHO assessment support for community health workers operating where connectivity, privacy, and compute are constrained. Pediatric respiratory cases add age, seven explicit observations, respiratory rate, and count quality so deterministic policy owns emergency escalation and threshold findings. Broader pediatric IMCI and adult mhGAP cases use local retrieval and MedPsy for supervised provisional review. The system is not a diagnostic tool, prescription system, or replacement for clinical judgment.

The current local build proves one visible workflow with internal general/clinical routing, explicit-fact review and structured completion, deterministic respiratory surfaces, explicit eligible respiratory continuation through real local QVAC/WHO/MedPsy, broader IMCI and mhGAP review, provisional human confirmation, complete cited source plans, off-domain abstention, and bounded two-pass ordinary assistance in the shared result. It does not claim validated clinical behavior, named clinical review, organizer-audited performance, or that the already-submitted Devpost entry and existing video were updated.

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

Local verification completed across 2026-08-25 through 2026-08-27 produced:

- `npm run typecheck`: pass.
- Fresh Task 12 release regression: `npm test` 574 total, 574 pass, 0 fail, 0 skips, 0 cancelled, 0 todo (exclusive serialized local run with every locally applicable QVAC/WHO/MedPsy test executed).
- Import provenance: 76 imported objects verified against public Triage-0 commit `74424721bc75f564808eacce42d7f7f42676ae0f`.
- Deterministic emergency, incomplete, outside-scope, chest-indrawing, and fast-rate HTTP/SSE paths pass with fixed source binding and zero QVAC/retrieval/model boundaries.
- Complete supported below-threshold records execute real local WHO retrieval and MedPsy assistance through QVAC SDK 0.13.3 without changing the deterministic public finding.
- Exact 49/50 and 39/40 respiratory threshold boundary tests pass.
- Task 11 Playwright assertions passed 58/58 across desktop, 375-by-812 and 320-pixel viewports: one textarea/action/result; deterministic emergency and below-threshold respiratory results; explicit respiratory continuation; provisional pneumonia and cough/cold review; complete confirmed plans; broad IMCI and adult mhGAP review; off-domain abstention; both exact submitted prompts pasted manually; cancellation/retry; shared-queue ownership; no horizontal overflow; zero console errors/warnings; and effective visible controls at least 44px.
- Retained current PNGs cover desktop provisional and confirmed pneumonia, desktop broad mhGAP provisional, two desktop lifecycle-regression states, and confirmed pneumonia at 375 by 812. The 320-pixel viewport is supported by browser measurement and trace evidence, not a retained screenshot.
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

The generated profiler values are Apple development evidence, not organizer-audited scores. Participant identity is complete and consistent across `metadata.json` and `submission.json`. Task 12 also reran the official participant profiler without altering the release artifact: Apple M1, 8 GB, 50 ARC-Easy samples, `acc_norm` 0.70, 20.09 generated tok/s, 4,757.28 ms first-token latency and 1,082.92 MB peak RSS. The rerun preserved both prompt byte strings exactly.

## Submitted-prompt release gate

Exactly two prompts are byte-identical across `metadata.json`, `config/profiler-prompt-policy.json`, and generated `submission.json` after documented line-ending normalization. Prompt 2 is the comma-punctuation version. Their SHA-256 values are `1bed4182fe62e46bbae10bd6aedf56a2d25fd977fbab1744b55f55d612f8ed29` and `322b4dcff729d2deae7d3662212b0152bb9d123ee6e63f1aed9d785252292d74`.

1. `Summarize, in plain English, the recorded facts in this supervised pediatric respiratory case: a two-year-old has cough for three days; all seven structured danger and breathing observations were recorded absent. Separate observed facts from uncertainty. Do not diagnose, prescribe, or invent missing findings.`
2. `Explain, in plain English for a supervised community health worker, why an incomplete pediatric respiratory danger-sign checklist must be completed before model-assisted assessment review. State that recorded danger observations and deterministic policy, not model output, control escalation. Do not diagnose or prescribe.`

Both exact prompts now pass the restored application workflow without changing their bytes. The product uses the original-strength bounded pattern: a 1,024-token reasoning pass, schema-constrained extraction with a 512-token budget and bounded retries, followed by deterministic semantic validation. Three direct official CPU-only `llama.cpp` application-workflow repeats per prompt pass in `submission/profiler/submitted-prompt-official-product-exact-evidence-20260825T235000Z.json`; six QVAC exact executions pass in `submission/profiler/submitted-prompt-product-exact-evidence-20260825T221500Z.json`; and labeled paraphrase, contradiction, truncation/malformed, forbidden-claim, and prompt-injection checks pass in `submission/profiler/submitted-prompt-product-adversarial-evidence-20260825T223000Z.json`. Earlier failed and intermediate artifacts remain preserved. No submitted prompt was edited or tuned against historical run `32742482642`.

Prompt 1 separates recorded facts from uncertainty and does not invent a respiratory rate or fast-breathing status. Prompt 2 states that the incomplete checklist must be completed and that recorded observations plus deterministic policy, not model output, control escalation. Both remain free of diagnosis and prescription claims. Direct official evidence is pinned to official `llama.cpp` revision `c8ade30036139e32108fee53d8b7164dbfda4bee`, four CPU threads, `-ngl 0`, the exact GGUF hash, and the actual Apple development host label. Repeat wall times were variable: Prompt 1 took 18.916 s, 107.321 s, and 14.728 s; Prompt 2 took 120.622 s, 20.026 s, and 20.124 s. These are observed Apple development results, not a 15-second latency guarantee. QVAC SDK 0.13.3 evidence is reported separately.

## Constraints and unresolved gates

- Authenticated Devpost no longer exposes the saved prompt fields after the deadline redirect, so byte-for-byte Devpost parity, including Prompt 2 comma punctuation, remains externally unverified. The user confirmed the submission is complete and supplied the exact saved strings; this is an external archival-parity gap, not a pending local implementation gate.
- The full participant profiler completed and generated `submission.json`; the verified Devpost project slug and participant-confirmed submitter identity are present in both required JSON artifacts.
- Respiratory remediation is locally complete: the first respiratory result remains deterministic, plan-free and model-free. Eligible respiratory records may enter QVAC/WHO/MedPsy only through explicit continuation; the reconciled class stays provisional until one-use human confirmation reveals the complete deterministic, cited management plan. Model prose cannot author or alter classification authority, severity, action, medicine, dose, referral or follow-up content.
- Known routes called with unsupported methods return explicit JSON 405 responses with exact `Allow` headers, and an empty `/perf-log.csv` returns a truthful 200 header-only CSV.
- Current local PNGs document only their named desktop and 375-by-812 provisional, confirmed, mhGAP and lifecycle-regression states. Broader exact-prompt, queue, cancellation/retry and 320-pixel claims come from the 58/58 Task 11 Playwright assertion matrix and retained trace/measurement evidence, not from those screenshots. All remain local verification artifacts; final submission media and publication remain separate actions.
- The restored repository and report are the authorized GitHub release surface. Devpost and video publication remain separate and unchanged.

## Reproducibility boundary

The repository contains the exact model identity, checksum-aware provisioner, metadata contract, structured-danger tests, separate evidence producers, immutable import ledger, and local application code. A future release can be considered only after the applicable real-runtime product/UAT gate, official profiler, identity, media, public-artifact, and publication gates are completed without weakening deterministic danger ownership or provenance.
