# Triage-0 ADTC shared-MedPsy healthcare retention design

**Date:** 2026-08-24
**Status:** Approved by user
**Selected approach:** Shared MedPsy runtime with transparent Triage-0 application reuse
**Working directory:** `/Users/MAC/adtc-2026`
**Source project:** `/Users/MAC/triage-0` at public baseline commit `74424721bc75f564808eacce42d7f7f42676ae0f`

## 1. Decision

Retain the healthcare submission. Do not implement the creative-writing pivot.

Use the exact MedPsy-1.7B Q4_K_M GGUF already used by Triage-0 as the single canonical model for both:

1. official ADTC profiling through direct `llama.cpp`; and
2. the reused Triage-0 clinical application through its local QVAC runtime.

The application reuse is transparent. The submission must identify every reused file, its source commit, its original license, and the ADTC-specific work added after reuse. It must not claim that the entire application was created during ADTC.

## 2. Corrected problem statement

The prior Build block did not prove that MedPsy or Triage-0 failed. MedPsy was stopped before behavioral inference by a self-imposed itemized training-lineage prerequisite. That prerequisite came from Critique finding F-08 and is not stated in the published ADTC repository contract or rules.

The later OLMo failures remain valid for OLMo under their recorded contracts, but they do not establish that MedPsy fails the Triage-0 product contract. They must remain preserved as historical evidence and must not be used as the reason to abandon healthcare.

## 3. Product identity and claim

**Working name:** Triage-0 ADTC

**Claim:** Offline, source-grounded clinical decision support for supervised community health workers using one medical GGUF on commodity hardware.

The product:

- supports supervised decision support;
- does not claim autonomous diagnosis or prescription;
- uses English as the scored and required language scope;
- may retain existing optional language features only if they do not endanger the submission-critical path;
- cites local protocol sources;
- abstains when the case is unsupported, ambiguous, malformed, or insufficiently grounded;
- makes no claim of emergency-grade autonomous reliability.

## 4. Architecture

```text
public immutable MedPsy GGUF URL
                |
                v
        download_model.sh
                |
                v
model/medpsy-1.7b-q4_k_m-imat.gguf
        |                      |
        |                      +--> official ADTC profiler
        |                           direct llama.cpp, CPU only
        |
        +--> Triage-0 application
             same path and SHA-256
             local QVAC runtime
                    |
                    +--> local protocol retrieval
                    +--> fenced two-pass reasoning
                    +--> GBNF-constrained extraction
                    +--> schema validation and bounded retry
                    +--> deterministic classification reconciliation
                    +--> deterministic severity and safety controls
                    +--> source-bound citations
                    +--> localhost UI
```

The canonical model is load-bearing. Removing the MedPsy GGUF breaks both the official profiler and the clinical product. OLMo is not an active product dependency.

## 5. Canonical model contract

The initial canonical candidate is the prior Triage-0 model:

- repository: `qvac/MedPsy-1.7B-GGUF`;
- file: `medpsy-1.7b-q4_k_m-imat.gguf`;
- quantization: Q4_K_M imatrix;
- immutable revision, byte count, and SHA-256: reuse the already pinned ADTC finalist record after independent parity verification;
- public access: credential-free;
- declared license: Apache-2.0;
- language: English;
- runtime: GGUF compatible with direct `llama.cpp`.

No new model search is part of this design. Restoring MedPsy is a user-authorized reconsideration of the original finalist and exact Triage-0 model.

The model decision must disclose:

- the publisher's research and educational use wording;
- the disclosed Genesis I and II CC-BY-NC source caveat;
- the distinction between publisher weight licensing and independent training-data provenance completeness;
- the model card's limitations for rare, complex, emergency, and unsupervised clinical use;
- the submission's supervised, early-PoC scope.

## 6. Triage-0 reuse contract

Reuse is authorized by the user as owner of Triage-0. Eligibility risk is controlled through truthful disclosure rather than a false clean-build claim.

Create a file-level provenance ledger containing:

- source repository URL;
- source commit `74424721bc75f564808eacce42d7f7f42676ae0f` unless a later exact approved baseline is selected before import;
- original creation dates;
- original Apache-2.0 license;
- each reused file and its source SHA-256;
- each ADTC modification and its purpose;
- files created solely for ADTC;
- third-party model, QVAC, WHO, llama.cpp, and profiler dependencies;
- explicit statement that Triage-0 previously appeared in the QVAC hackathon.

The official ADTC template remains the repository root. The combined distribution must retain Apache notices for reused material and comply with the template's GPLv3 license.

## 7. Product data flow

1. `download_model.sh` downloads the immutable MedPsy file to a temporary path, verifies exact bytes and SHA-256, then renames it atomically into the metadata-defined model path.
2. `metadata.json` names MedPsy, `llama.cpp`, GGUF Q4_K_M, English, healthcare, the exact model path, and the two final prompts.
3. The official profiler loads that path directly through `llama.cpp` and writes `submission.json`.
4. The Triage-0 application resolves the same metadata-relative path rather than its former `.models/` fallback URL.
5. Local retrieval selects protocol excerpts and rejects insufficient grounding.
6. The first MedPsy pass reasons over fenced case data and retrieved excerpts.
7. The second pass emits GBNF-constrained JSON over a bounded classification enum.
8. Schema validation retries a bounded number of times and otherwise fails closed.
9. Deterministic code owns severity, danger precedence, treatment routing, citation binding, and abstention.
10. The localhost UI displays the final reviewed card and model identity without exposing chain-of-thought.

## 8. Runtime and resource budgets

### Official scored path

- four CPU threads;
- zero GPU layers;
- official profiler context and token settings;
- reference target: Ubuntu 22.04, x86-64, 8 GB RAM;
- canonical model only;
- zero inference-time network calls.

### Product path

- existing Triage-0 3,072-token context initially;
- one active inference job;
- MedPsy reasoning model resident only when safe;
- optional support models lazy-loaded or cut;
- no second reasoning LLM;
- process-tree memory must remain below the 7 GB scoring budget when measured on the relevant host;
- Apple Silicon product measurements must never be presented as official x86 results.

Prior controlled x86 evidence for MedPsy Q4 is comparative evidence only: 6.23 generation tokens per second and 1,414.48 MB profiler peak RSS. It must be rerun or clearly labeled before final submission claims.

## 9. Evidence and model-decision gate

Create a new isolated namespace such as `evidence/medpsy-shared-runtime-v1/`. Do not rewrite or delete MedPsy lineage blocks, OLMo failures, or clinical recovery evidence.

Before inference, freeze:

- candidate identity;
- source and license records;
- model URL, revision, filename, bytes, and SHA-256;
- direct `llama.cpp` command;
- Triage-0 product prompt contract;
- calibration cases;
- evaluation cases;
- human rubric;
- resource thresholds;
- evaluator code;
- producer code;
- GitHub Actions workflow;
- expected artifact paths and hashes.

Evidence classes must remain distinct:

1. Historical Triage-0 regression evidence: the committed 29 of 29 clinical audit result and application test history. Label it as prior-developed, not untouched.
2. ADTC direct-model evidence: fresh direct `llama.cpp` load, template, output, profiler, and domain behavior.
3. ADTC complete-product evidence: fresh application regression, same-model hash, grounding, deterministic safety, no-egress, and lifecycle behavior.
4. Human clinical review: mandatory before strong safety claims.
5. Physical target-laptop evidence: mandatory before reference-hardware performance or thermal claims.

A signed `evidence/model-decision.json` may select MedPsy only when the revised, approved gate passes. The decision must say exactly what passed and what remains unproven.

## 10. Error handling

- Download interruption: preserve a resumable partial file, never expose it as canonical, and verify before rename.
- Hash mismatch: delete or quarantine only the exact invalid candidate and fail closed.
- Missing model: show a setup error with the required command.
- Runtime startup failure: report the exact process error and do not fabricate a response.
- Retrieval miss: abstain and escalate to supervised review.
- Fence collision or injection: reject before model access or treat the input strictly as untrusted data.
- Invalid model JSON: bounded retry, then fail closed.
- Unsupported classification: return `UNKNOWN` and supervised escalation.
- Citation mismatch: remove the unsupported claim or fail closed.
- Timeout or cancellation: terminate the active job, release the global lock, and permit a clean retry.
- Optional QVAC failure: remove only that modality; the English text workflow must remain functional.
- Network access during inference: release blocker.

## 11. Testing strategy

### Static and deterministic

- strict TypeScript typecheck;
- existing Triage-0 unit and integration suite;
- protocol-table and citation integrity;
- provenance ledger verification;
- metadata schema and prompt parity;
- downloader path, byte, and hash tests;
- application and profiler model-hash parity.

### Model and product

- fresh run of the historical 29-case regression, labeled accurately;
- fresh frozen ADTC calibration and evaluation sets;
- supported routine case;
- danger-sign case;
- negated danger-sign case;
- ambiguity and uncertainty;
- medical mimic;
- off-domain input;
- prompt injection;
- malformed output;
- fabricated local-resource trap;
- repeated cold and warm inference;
- stop, timeout, retry, and restart suppression.

### Environment

- evidence-only GitHub Actions with no retained GGUF;
- direct Ubuntu x86 `llama.cpp` compatibility;
- official profiler smoke and full run;
- no-egress proof;
- clean clone and idempotent download;
- physical target-class laptop before final thermal claims.

## 12. Submission narrative

The submission must state:

- Triage-0 began as a non-commercial QVAC hackathon proof of concept in June 2026;
- this ADTC submission transparently reuses identified components owned by the entrant;
- ADTC work adds the official template contract, one canonical checksum-locked GGUF, direct `llama.cpp` profiling, x86 evidence, constrained-hardware optimization, reproducible packaging, and ADTC-specific evaluation;
- old and new files are enumerated in `PROVENANCE.md`;
- MedPsy is not a substitute for professional judgment;
- evidence tiers and hardware labels are not mixed.

Do not claim “built entirely from scratch for ADTC.” Do not conceal the earlier QVAC submission.

## 13. Scope and cut order

### Submission-critical

- official template root;
- exact MedPsy downloader and hash;
- metadata and two prompts;
- direct official profiler path;
- existing English text clinical workflow;
- RAG, constrained extraction, deterministic safety, and citations;
- provenance and license disclosure;
- report, screenshots, video, and submission evidence.

### Cut before risking submission

1. Translation.
2. Text-to-speech.
3. Speech-to-text.
4. Optional QVAC retrieval replacement or enrichment.
5. Visual redesign.
6. Direct `llama-server` application adapter.

The existing QVAC application runtime is accepted for the Gate 1 product path if it uses the exact canonical model file and the platform limitation is disclosed. A direct `llama-server` adapter is a post-checkpoint enhancement, not a prerequisite.

## 14. Pipeline transition

After this design is committed:

1. invoke `writing-plans` and write the exact healthcare-retention implementation plan;
2. audit all controlling documents and state artifacts for stale clean-build, OLMo, pivot, and exhausted-gate assumptions;
3. review the design and implementation plan before code;
4. resume only through `hackathon-conductor`;
5. atomically record the user-approved healthcare-retention recovery;
6. preserve all historical phase evidence;
7. refresh the conductor beacon and ownership checksum;
8. run resume, FSM, and pre-dispatch gates;
9. dispatch the legal phase;
10. stop at every mandatory human or external-action checkpoint.

Do not invoke Hackathon Build directly.

## 15. Approval record

The user approved this approach on 2026-08-24 with: “go with 1”.

