# Triage-01 Product Requirements Document

**Hackathon:** Africa Deep Tech Challenge 2026
**Track:** `healthcare_medical`
**Deadline:** 2026-08-25 06:45 UTC
**Version:** 1.1 requirements revision
**Status:** `structured-danger-v1` frozen; implementation and evidence pending
**Provenance:** Triage-0 is transparently imported from commit `74424721bc75f564808eacce42d7f7f42676ae0f` under the file-level import ledger. This revision supersedes conflicting clean-build language below.

## Controlling structured-danger-v1 revision

The worker supplies structured patient age plus seven descriptive observations: `cannotDrinkOrBreastfeed`, `vomitsEverything`, `convulsions`, `lethargicOrUnconscious`, `chestIndrawing`, `stridorWhenCalm`, and `lowOxygenOrCentralCyanosis`. Request values are `PRESENT`, `ABSENT`, or `NOT_ASSESSED`; omission becomes `NOT_ASSESSED`, never absence, and `CONFLICT` is internal only. The imported 2014 IMCI respiratory band is 2 completed months up to 5 years (2 through 59 months).

Six observations can establish emergency escalation. Chest indrawing is not an emergency by itself: after known emergencies are excluded and the assessment is complete, isolated chest indrawing follows the deterministic, age-scoped non-emergency pneumonia branch. A known emergency runs before missing-age/field handling, semantic routing, embeddings, or MedPsy. Otherwise missing/unsupported age, `NOT_ASSESSED`, or `CONFLICT` fails closed. Only a supported all-absent assessment proceeds through the real QVAC SDK 0.13.3 local-RAG, two-pass, schema, retry, reconciliation, and plan path. `card.red_flags` remains wire-compatible but will be populated from structured observations only.

Evidence is split. `medpsy-product-v2` proves the actual QVAC product path. `medpsy-raw-profiler-v2` uses pinned official llama.cpp for raw compatibility and profiling; raw one-pass extraction does not prove product safety. Both bind the exact MedPsy artifact frozen in `config/structured-danger-v1/contract.json`. Run `32742482642` remains immutable. Submitter/team identity placeholders remain explicit release blockers, as do the signed decision, named human review, physical target evidence, and Phase 2 gate.

## [EMERGENCY REAL-P0 MODE — 0 components mocked]

The remaining schedule permits only real submission-critical work. No mock or stub is allowed in inference, clinical behavior, citations, model download, profiler output, offline proof, or the 120-second demo. The English QVAC product path is retained under the controlling revision above; excluded modalities and broader claims remain cut.

## 1. Project Overview

### One-line description

Triage-01 helps trained frontline health workers review pediatric respiratory observations offline on an 8 GB laptop, using one directly audited GGUF plus deterministic referral and source controls.

### Winning argument

The same CPU-only GGUF audited by ADTC powers a source-bound offline clinical workflow whose deterministic controls prevent the model from owning urgency, citations, or treatment facts.

### Problem statement

Cloud-first clinical assistants can become unavailable where connectivity and API budgets are unreliable, while unconstrained medical model prose can invent high-stakes facts. Triage-01 addresses the narrower, testable problem: a trained or supervised frontline worker has already observed a child aged 2 months to under 5 years with cough or difficult breathing and needs an offline checklist that flags missing observations and source-defined escalation criteria without pretending to diagnose.

### Product claim

> Triage-01 is an offline case-review and escalation-support prototype for trained frontline health workers. It checks worker-recorded observations for children aged 2 months to under 5 years with cough or difficult breathing against a locally adapted, source-traceable respiratory rule set; surfaces missing data and referral criteria; and prepares a source-linked review summary. It does not diagnose, prescribe, determine treatment, replace clinical examination, local protocols, qualified supervision, or emergency referral procedures.

### Supported cohort

| Dimension | P0 boundary |
|---|---|
| User | Trained or supervised frontline health worker |
| Patient age | 2 completed months through 59 months |
| Presenting complaint | Cough or difficult breathing |
| Input | English typed observations only |
| Output | Review state, matched criteria, missing observations, source identifiers, concise review summary |
| Runtime | Localhost, CPU-only, networking disabled during inference |
| Authority | Deterministic policy after validated model extraction |

### Explicit exclusions

- No diagnosis, ranked differential, disease probability, prognosis, prescription, medicine name, dose, oxygen decision, or treatment plan.
- No direct-to-patient or caregiver workflow.
- No infants younger than 2 months, children aged 5 years or older, adults, pregnancy, trauma, poisoning, mental-health, or non-respiratory pathway.
- No claim that absence of a matched escalation criterion means the child is safe, normal, or free of illness.
- No invented facility, hotline, emergency number, or referral destination. Named resources require signed local configuration and are absent from P0.
- No visible chain-of-thought, raw reasoning tokens, or model-authored citations.
- No cloud inference, remote fallback, analytics, CDN, external fonts, second medical LLM, or QVAC completion plugin.

### Why this can win

| Judging signal | Weight | Triage-01 response | Evidence plane |
|---|:---:|---|---|
| Accuracy and quality | 50% | Keeps MedPsy-1.7B Q4 and MedPsy-4B Q4 behind an early pediatric respiratory safety, formatting, and lineage gate | Raw model |
| Throughput | 30% | Direct pinned `llama.cpp`, four threads, zero GPU layers, 2048 context, one active inference | Raw model |
| Efficiency | 20% | One canonical GGUF, bounded queue, process-tree budgets, no concurrent support model | Raw model and product |
| Thermal safety | Penalty | Physical target-laptop gate with repeated cold runs, sensors, governor, ambient, and throttle flags | Release evidence |
| African use case | Bonus/qualitative | Private, offline, supervised frontline respiratory review for low-connectivity settings | Product |
| Integration | Qualitative | Official template, metadata, downloader, GGUF, profiler, direct runtime, clinical controls, and sources form one dependency chain | Full system |

### Success definition

Triage-01 succeeds only when a clean public clone can anonymously download and checksum the final GGUF, run the official profiler, start the localhost product, complete a supported case with networking disabled, prove app/profiler hash parity, and show a deterministic review state with only valid local source identifiers.

## 2. System Architecture Overview

### System diagram

```text
PUBLIC SETUP PLANE                         OFFLINE PRODUCT PLANE
metadata.json                              browser on 127.0.0.1
      |                                             |
      v                                             v
download_model.sh -> canonical GGUF <- manifest/runtime contract
      |                    |                        |
      |                    +-> llama-server CPU-only, one request
      |                                      |
      v                                      v
official profiler                    schema-validated observations
      |                                      |
      v                                      v
submission.json                    deterministic respiratory policy
                                             |
                             +---------------+---------------+
                             v                               v
                       source binder                    review-state UI
                             |                               |
                             +---------- evidence -----------+

RAW-MODEL EVIDENCE: profiler, holdout, format, TPS, RSS, thermals
PRODUCT EVIDENCE: offline trace, safety states, citations, cancellation, parity
```

### Component table

| ID | Component | Type | Purpose | Key dependencies | Priority |
|---|---|---|---|---|:---:|
| C-01 | Submission Contract | JSON/schema | Single truth for model identity, path, domain, prompts, and packaging | Official ADTC schema | P0 |
| C-02 | Model Provisioner | Shell | Anonymous, resumable, checksum-verified canonical GGUF installation | Public Hugging Face artifact | P0 |
| C-03 | Finalist Gate | Evaluation harness | Select Q4 or 4B only after raw-model quality, license, format, resource, and thermal evidence | ADTC profiler, holdout corpus | P0 |
| C-04 | Runtime Supervisor | Node service | Start and supervise one direct CPU-only `llama-server`; expose health and cancellation | Canonical GGUF, pinned llama.cpp | P0 |
| C-05 | Intake and Model Adapter | Validation/inference | Validate structured worker observations, request one bounded model extraction, reject malformed output | Runtime Supervisor, schemas | P0 |
| C-06 | Deterministic Clinical Policy | Pure domain logic | Own scope, negation resolution, thresholds, precedence, abstention, and final state | Validated observations | P0 |
| C-07 | Source Catalog and Binder | Local data/domain logic | Supply approved actions/limitations and reject unknown citation identifiers | Versioned local source manifest | P0 |
| C-08 | Local API and UI | Localhost web app | Collect observations, show real stages, render review state, evidence, identity, and failures | C-04 through C-07 | P0 |
| C-09 | Evidence and Release Pipeline | Scripts/tests | Prove clean clone, offline flow, parity, profiler output, resources, and artifact consistency | All P0 components | P0 |

### Data ownership

| Data | Authoritative owner | Stored? | Rule |
|---|---|:---:|---|
| Model identity/path | `metadata.json` | Yes | No second configuration truth |
| Model bytes/hash | Canonical GGUF plus checksum manifest | Yes, ignored by Git | App and profiler must match |
| Patient observations | Current browser request | No by default | Never written to logs or evidence |
| Candidate observations | Schema-validated model response | Request lifetime | Cannot directly determine final state |
| Final review state | Deterministic Clinical Policy | Request lifetime | Precedence cannot be lowered by model |
| Source records | Versioned local catalog | Yes | Model cannot create IDs or clinical actions |
| Product telemetry | Redacted event trace | Bounded | No patient text or raw model reasoning |
| Profiler telemetry | `submission.json` and raw logs | Yes | Must retain host/evidence-tier labels |

## 3. User Flows

### Flow F-01: Supported respiratory review

1. The worker opens the localhost UI with networking disabled.
2. The header shows offline status, model name, hash prefix, runtime revision, and supported cohort.
3. The worker enters all required observations for a child aged 2 to 59 months with cough or difficult breathing.
4. Input validation confirms the cohort and required fields.
5. The source binder selects the respiratory evidence record before inference.
6. Supported all-absent cases run the actual QVAC local-RAG and two-pass MedPsy workflow; deterministic pre-model branches do not invoke the model.
7. The parser validates the strict schema and discards any extra fields.
8. Deterministic policy computes the final review state.
9. Deterministic code renders the final summary, state, matched criteria, missing fields, source link, limitations, and model identity.
10. No patient text is persisted.

**Happy path result:** `NO_ESCALATION_CRITERION_DETECTED_IN_ENTERED_DATA` only when every required field is complete and no rule matches. The UI explicitly states that this is not a safety or diagnosis conclusion.

**Error cases:** missing fields become `INSUFFICIENT_OR_AMBIGUOUS`; invalid model output becomes `INVALID_OUTPUT_OR_SYSTEM_FAILURE`.

### Flow F-02: Referral criterion and negation safety

1. The worker enters a supported case with a general danger sign, stridor while calm, or a measured SpO2 below 90 percent.
2. The deterministic rule engine matches the source-defined criterion independently of model phrasing.
3. The final state becomes `REFERRAL_CRITERION_DETECTED`.
4. The UI presents reviewed referral language and prohibits generated facility or hotline details.
5. A paired negative fixture such as “no stridor while calm” must not match the positive criterion.
6. If negation is ambiguous, the state is `INSUFFICIENT_OR_AMBIGUOUS`, never referral-clear.

### Flow F-03: Prompt review, alternate pathway, or abstention

1. Fast breathing uses age-banded deterministic thresholds: at least 50/min for 2 to 11 months; at least 40/min for 12 to 59 months.
2. Chest indrawing or fast breathing produces `PROMPT_CLINICAL_REVIEW`.
3. Cough longer than 14 days, recurrent wheeze, conflicting observations, or a plausible mimic produces `ALTERNATE_PATHWAY_REVIEW`.
4. An unsupported age or complaint produces `OUTSIDE_SUPPORTED_SCOPE` without sending the case to the model.
5. Prompt injection text is treated as case text and cannot alter schema, system instructions, policy, or source catalog.

### Flow F-04: Cancel, timeout, crash, and retry

1. The worker submits a valid case; the stage indicator reflects real validation, source selection, inference, policy, and finalization events.
2. The worker may cancel while waiting.
3. Cancellation aborts the loopback request, releases the one active inference slot, and clears request content.
4. A stage timeout or `llama-server` crash produces `INVALID_OUTPUT_OR_SYSTEM_FAILURE` with no clinical result.
5. The supervisor may restart the same canonical model once.
6. Retry starts a new request and never reuses an incomplete model response.
7. A second concurrent submit receives a bounded busy response; it never starts a second model process.

### Flow F-05: Evaluator and release proof

1. A clean environment clones the public official-template repository.
2. `download_model.sh` anonymously downloads, verifies, and atomically installs the finalist GGUF.
3. A second downloader run verifies the existing file and performs no download.
4. The product and official profiler resolve the same metadata-relative path and SHA-256.
5. The full profiler creates schema-valid `submission.json` with raw host labels.
6. The complete product runs in a denied-egress environment and completes F-01 and F-02.
7. The physical target laptop records three cold-boot runs with CPU, OS, governor, ambient, TPS, RSS, temperature, and throttle flags.
8. The report, UI, screenshots, video, metadata, Devpost prompts, `Sperf`, and `Seff` are checked for parity.

## 4. Technical Specifications

### C-01 Submission Contract

- **Purpose:** Make the official ADTC metadata the sole product and evaluation manifest.
- **Inputs:** Builder and finalist-model facts.
- **Outputs:** Schema-valid `metadata.json` with exactly two prompts and `_runtime.model_path`.
- **Constraints:** `domain` is `healthcare_medical`; `runtime` is `llama.cpp`; packaging is allowed by the official schema; no placeholder values at release.
- **Observable:** The official profiler reads the model from the same path shown by product health.
- **Failure behavior:** Startup and release checks fail nonzero on missing, malformed, placeholder, or divergent fields.

### C-02 Model Provisioner

- **Purpose:** Install exactly one public GGUF without credentials.
- **Inputs:** Full immutable model revision, filename, byte count, SHA-256, metadata path.
- **Outputs:** Verified file at `_runtime.model_path`.
- **Constraints:** Partial download, retry, size check, SHA-256, atomic rename, idempotent existing-file verification, no token/header/cookie.
- **Observable:** First run downloads and verifies; second run verifies and prints an idempotent success; corrupt file is rejected and recoverable.
- **Failure behavior:** No final file remains after a failed checksum.

### C-03 Finalist Gate

- **Purpose:** Prevent premature model freeze.
- **Finalists:** MedPsy-1.7B Q4_K_M imatrix and MedPsy-4B Q4_K_M imatrix. MedPsy-1.7B Q5 is eliminated.
- **Raw-model tests:** Pediatric respiratory free-form holdout, danger signs, uncertainty, abstention, medical mimic, local-resource hallucination, prompt injection, formatting, visible-thinking, truncation, two participant prompts, official profiler accuracy.
- **Product-independent rule:** App safety logic cannot convert a failing raw model into a passing candidate.
- **License gate:** Model card, weight license, disclosed training lineage, redistribution, attribution, and organizer suitability.
- **Selection:** Q4 wins if it passes. The 4B wins only for a material rubric improvement that justifies lower TPS, higher RSS, and thermal cost. Neither passing reopens model choice.
- **Observable:** A signed model-decision record names exact URL, revision, bytes, SHA-256, quantization, chat template, generation policy, and evidence.

### C-04 Runtime Supervisor

- **Purpose:** Own one direct `llama-server` process shared by the product contract.
- **Runtime settings:** Pinned commit; `-c 2048`; `-ngl 0`; `-t 4`; loopback host; fixed port; one active request; zero waiting requests; concurrent submissions receive 409.
- **Health:** Model name/path/hash, runtime revision, PID, readiness, offline policy, queue depth, and current-request metrics.
- **Constraints:** No remote bind; no cloud URL; no second medical model; bounded startup and request deadlines.
- **Observable:** Process command line contains the metadata model path, four threads, zero GPU layers, and loopback binding.
- **Failure behavior:** Stop, kill child process tree, clear request, and fail closed. One controlled restart is allowed.

### C-05 Intake and Model Adapter

- **Purpose:** Turn worker observations into one strict candidate extraction without exposing reasoning.
- **Required observations:** age months, symptom duration, drinking/breastfeeding, vomits everything, convulsion, lethargy/unconsciousness, one-minute calm respiratory rate, chest indrawing, calm stridor, wheeze, and SpO2 only if actually measured.
- **Input limits:** JSON body 32 KiB; case note 2,000 characters; enumerated fields; explicit unknown state; no binary upload.
- **Model output:** Candidate normalized-observation tokens and non-authoritative uncertainty telemetry only. Every normalized token must match a deterministic allowlist derived from the explicit worker fields. Model output may not create, negate, downgrade, or summarize any high-stakes criterion.
- **Validation:** JSON schema with `additionalProperties: false` plus independent runtime validation.
- **Observable:** Malformed or extra-field output produces `INVALID_OUTPUT_OR_SYSTEM_FAILURE`.

### C-06 Deterministic Clinical Policy

- **Purpose:** Compute the final state from trusted entered facts and validated observations.
- **Precedence:** invalid/system failure > outside scope > referral criterion > insufficient/ambiguous > alternate pathway > prompt review > no escalation criterion in entered data. Referral precedence intentionally survives unrelated unknown fields; ambiguous danger-sign fields still fail closed.
- **Referral criteria:** general danger sign; stridor while calm; actually measured SpO2 below 90 percent.
- **Prompt review criteria:** chest indrawing; age-banded fast breathing.
- **Alternate pathway:** cough longer than 14 days; recurrent wheeze; conflicting observation; plausible mimic.
- **Negation:** explicit true/false/unknown fields own danger signs; free text cannot silently override them.
- **Observable:** A model-proposed lower state cannot downgrade a deterministic referral state.

### C-07 Source Catalog and Binder

- **Purpose:** Keep clinical action wording, limitations, thresholds, and citations outside generated prose.
- **Source record:** ID, title, publisher, jurisdiction, version/date, URL, retrieval date, SHA-256, rights status, page/section locator, approved derived facts, and review status.
- **P0 sources:** WHO IMCI respiratory guidance and child-health Digital Adaptation Kit, subject to content-rights and local-adaptation review.
- **Constraints:** Only predeclared IDs; no model-authored source; no copied WHO table wholesale; no medicine/dose/resource records.
- **Observable:** Unknown citation ID or unreviewed source causes fail-closed invalid state.

### C-08 Local API and UI

- **Purpose:** Make real system state legible on a 1366 by 768 laptop.
- **Routes:** health, assess, event stream, cancel, source record, and static assets; loopback only.
- **First visit:** Product claim, scope, limitations, model identity, offline state, required observations, and source status are visible without login.
- **Clinical states:** Referral, prompt review, alternate pathway, incomplete/ambiguous, out-of-scope, no criterion detected, and system failure use distinct text and color; color is not the only signal.
- **Privacy:** No patient name, identifier, free-text note, or model output stored by default.
- **Accessibility:** Keyboard complete, visible focus, high contrast, semantic labels, live-region stage updates.
- **Observable:** UI stage order matches server event trace and never shows fabricated progress.

### C-09 Evidence and Release Pipeline

- **Purpose:** Produce auditable proof for the raw-model and complete-product planes.
- **Raw model:** Model identity, license, holdout rubric, official accuracy, TPS, RSS, thermals, format, truncation, and reproducibility.
- **Product:** Offline flow, clinical exact-value cases, citations, parity, cancellation, restart, queue, process-tree RSS, and network trace.
- **Evidence tiers:** official contract; physical target laptop; controlled Linux x86; local Apple development; unverified estimate.
- **Constraints:** GitHub Actions evidence is comparative only; physical-laptop evidence is final for thermal claims.
- **Observable:** Every report metric includes model hash, host, command, timestamp, and evidence tier.

## 5. API Contracts

### External setup API: Hugging Face public artifact

- **Base URL:** `https://huggingface.co`
- **Authentication:** None; authenticated or gated models are ineligible.
- **Endpoint:** `GET /{owner}/{repo}/resolve/{full_commit_sha}/{filename.gguf}`
- **Use:** Setup only. Never called during inference or the offline demo.
- **Success:** HTTP 200 after redirects; expected byte count; expected SHA-256.
- **Errors:** redirect loop, 401/403, 404, content-length mismatch, truncated transfer, checksum mismatch.
- **Unavailable risk:** R-07.

### Internal product contracts

| Route | Request | Success | Fail-closed errors |
|---|---|---|---|
| `GET /api/health` | None | Runtime/model/offline/source status, no patient data | 503 until canonical model and sources are ready |
| `POST /api/assess` | Structured observations | Request ID and accepted stage | 400 invalid; 409 busy; 413 body above 32 KiB; 422 outside scope; 503 runtime unavailable |
| `GET /api/assess/{id}/events` | Request ID | Ordered validation/source/inference/policy/final events | 404 unknown; terminal failure event |
| `DELETE /api/assess/{id}` | Request ID | 202 while process-group restart and slot cleanup are pending; 200 only after terminal cleanup | 404 unknown; idempotent terminal response |
| `GET /api/sources/{id}` | Approved source ID | Public source metadata and reviewed derived facts | 404 unknown or unreviewed |
| `GET /api/proof/current` | None | Current product-plane model/runtime/source/offline/queue evidence | Never substitutes product telemetry for profiler metrics |
| `GET /api/proof/profiler` | None | Committed official `submission.json` with raw-model plane label | 404 until real profiler evidence exists |

### Assessment request schema

| Field | Type | Rule |
|---|---|---|
| `ageMonths` | integer | 2 through 59 |
| `complaint` | enum | `COUGH`, `DIFFICULT_BREATHING`, or `OTHER`; `OTHER` returns outside scope before inference |
| `durationDays` | integer/unknown | 0 through 365 or explicit unknown |
| `canDrinkOrBreastfeed` | true/false/unknown | Required |
| `vomitsEverything` | true/false/unknown | Required |
| `convulsions` | true/false/unknown | Required |
| `lethargicOrUnconscious` | true/false/unknown | Required |
| `respiratoryRatePerMinute` | integer/unknown | Counted one calm minute |
| `chestIndrawing` | true/false/unknown | Required |
| `stridorWhenCalm` | true/false/unknown | Required |
| `wheeze` | true/false/unknown | Required observation |
| `recurrentWheeze` | true/false/unknown | Required to distinguish alternate-pathway review |
| `observationsConflict` | true/false/unknown | Worker records whether structured observations conflict |
| `mimicConcern` | true/false/unknown | Worker records a qualified concern for another pathway; app does not infer a diagnosis |
| `spo2Percent` | number/null | Only if actually measured |
| `note` | string | Optional; maximum 2,000 chars; never overrides fields |

### Final response schema

| Field | Type | Authority |
|---|---|---|
| `state` | seven-value enum | Deterministic policy |
| `matchedCriteria` | string array | Deterministic policy |
| `missingObservations` | string array | Input validator/policy |
| `summary` | string | Deterministic application renderer; model prose is never used |
| `sourceIds` | approved ID array | Source binder |
| `limitations` | fixed string array | Source catalog/application |
| `model` | name/hash/runtime | Submission contract/runtime |
| `requestMetrics` | elapsed time and cold/warm; TTFT/generation fields remain null unless directly measured | Product telemetry only; never substitute profiler metrics |

## 6. 120-Second Demo Script

**Total:** 118 seconds
**Format:** Screen recording of the real localhost product and committed evidence.
**Precondition disclosure:** Model weights are downloaded and the canonical model is preloaded before recording; no response or benchmark is precomputed.

### Scene 1: Constraint and identity, 0 to 14 seconds

**Screen:** Laptop system panel, disabled network, Triage-01 header, offline badge, canonical model name and hash prefix.
**Voiceover:** “Many frontline workers cannot rely on cloud access. Triage-01 runs one audited medical GGUF locally on an 8 gigabyte laptop, with networking disabled.”
**Flows witnessed:** F-05.

### Scene 2: Scope and hard case, 14 to 36 seconds

**Screen:** Supported cohort and required observation form. Enter a 9-month-old child with a calm respiratory rate of 54, with stridor explicitly absent.
**Voiceover:** “This is not diagnosis. A trained worker records observations for one narrow pediatric respiratory pathway. Explicit fields preserve age, uncertainty, and negation.”
**Flows witnessed:** F-01 and F-02.

### Scene 3: One direct model pass, 36 to 61 seconds

**Screen:** Real stages: validation, source selection, QVAC local RAG, two MedPsy passes, schema validation, deterministic policy. Show PID/model path in a compact proof drawer.
**Voiceover:** “The same GGUF used by the official profiler powers the separate QVAC product path. Structured observations and deterministic code own emergency precedence, severity, citations, and every displayed clinical action.”
**Flows witnessed:** F-01.

### Scene 4: Safe result and evidence, 61 to 84 seconds

**Screen:** `PROMPT_CLINICAL_REVIEW`, matched age-banded rule, source identifier and locator, limitations, no diagnosis, facility, or emergency number. Then toggle “cannot drink” to show immediate `REFERRAL_CRITERION_DETECTED` without waiting for model prose.
**Voiceover:** “Deterministic code applies review and referral precedence and binds only reviewed source records. Referral criteria do not wait for model prose. Any unknown source, malformed output, or ambiguity fails closed.”
**Flows witnessed:** F-02 and F-03.

### Scene 5: Failure control, 84 to 99 seconds

**Screen:** Start another request, cancel it, show slot release; briefly show an out-of-scope adult case rejected before inference.
**Voiceover:** “Cancellation releases the single inference slot, and unsupported cases stop before the model. There is no remote fallback and no second medical LLM.”
**Flows witnessed:** F-03 and F-04.

### Scene 6: Two evidence planes, 99 to 118 seconds

**Screen:** Proof view with matching model SHA-256, official profiler JSON, and labeled x86 comparison. Show physical-laptop evidence only if completed; otherwise display “not yet verified” and make no laptop claim. End on public repository URL.
**Voiceover:** “Raw-model accuracy and performance stay separate from product safety evidence. Every claim names its hardware and model hash. The public repository reproduces the download, profiler, and offline workflow.”
**Flows witnessed:** F-05.

### Demo seed and staging requirements

No clinical output is seeded. `scripts/seed-demo.ts` may only verify deterministic prerequisites:

| Item | Exact state | Created by | Real/fabricated |
|---|---|---|---|
| Canonical GGUF | Finalist hash equals manifest | `download_model.sh` | Real artifact |
| Source catalog | Reviewed respiratory source record validates | Build source ingestion | Real source metadata |
| Demo cases | Fresh independently authored input fixtures | `scripts/seed-demo.ts` | Real input, not output |
| llama-server | Ready on loopback with four threads and zero GPU layers | `scripts/start-local.sh` | Real process |
| Offline state | Denied egress with loopback retained | `scripts/verify-offline.sh` | Real OS policy |

### Demo fallback policy

If the live take fails, use a freshly recorded complete local run from the same final commit and model hash. Do not splice another model, prior Triage-0 UI, fake response, CI metric labeled as laptop evidence, or fabricated offline indicator.

## 7. Risk Register

| ID | Category | Risk | Severity | Likelihood | Impact | Mitigation | Plan tree |
|---|---|---|:---:|:---:|---|---|---|
| R-01 | Technical | Neither finalist clears raw clinical safety and format gates | CRITICAL | MEDIUM | No safe model can be frozen | Run gate first; reopen model choice; never hide deficits behind app rules | DT-01 |
| R-02 | Clinical | Danger rule mishandles negation, age, or unknown observations | CRITICAL | MEDIUM | False escalation or false reassurance | Explicit fields, precedence, source review, exact-value adversarial suite | DT-02 |
| R-03 | Clinical | Model invents source, dose, diagnosis, hotline, or facility | CRITICAL | HIGH | Unsafe displayed content | Disallow fields in schema, phrase allowlist/denylist, deterministic binder, fail closed | DT-03 |
| R-04 | Integration | Product and profiler use different model bytes, or submission prompt declarations drift | CRITICAL | MEDIUM | Core ADTC claim is false | One metadata path, SHA parity gate, schema-validated submission prompt equality; raw-profiler and product prompt execution remain explicitly separate evidence planes | DT-04 |
| R-05 | Demo | Inference makes a network call or offline badge lies | CRITICAL | LOW | Disqualification and broken thesis | Loopback-only runtime, OS egress denial, negative control, self-hosted assets | DT-05 |
| R-06 | Performance | Full process tree OOMs, throttles, or is unusably slow | HIGH | MEDIUM | Disqualification or poor score | Hard budgets, one inference, Q4 default rule, cgroup and physical-laptop runs | DT-06 |
| R-07 | External setup | Public GGUF URL fails, changes, or needs credentials | HIGH | MEDIUM | Judge cannot run project | Full revision URL, bytes/hash, retries, anonymous clean-host test | DT-07 |
| R-08 | Provenance | Prior Triage-0 implementation artifact is imported without approval | CRITICAL | LOW | Eligibility/originality challenge | Clean-build inventory, git review, optional approved-port branch disabled | DT-08 |
| R-09 | Time | Optional features delay a valid Devpost checkpoint | HIGH | HIGH | Missed deadline | P0-only scope, early submission survival, serial critical path | DT-09 |
| R-10 | Judging | Product UI is mistaken for raw-model score improvement | HIGH | MEDIUM | Credibility loss | Two evidence planes and explicit labels in UI/report/video | DT-10 |
| R-11 | Source | Clinical source reproduction or adaptation lacks rights/current review | HIGH | MEDIUM | Unsafe or noncompliant content | Minimal derived facts, source manifest, rights review, no wholesale table copying | DT-11 |
| R-12 | Scope | “No criterion detected” is misread as safe or normal | HIGH | MEDIUM | False reassurance | Exact state name, fixed limitation, no green success styling | DT-12 |
| R-13 | Release | Physical target laptop is unavailable | HIGH | MEDIUM | No final thermal proof | Reserve hardware early; block final claims; never promote CI results | DT-13 |
| R-14 | Optional | QVAC fails Linux, offline, memory, license, or value gate | MEDIUM | HIGH | P1 delay or extra risk | Cut adapter; P0 text product has no dependency | DT-14 |

### Risk categories covered

- Technical: R-01, R-04, R-06.
- Clinical/safety: R-02, R-03, R-11, R-12.
- External dependency: R-07, R-13, R-14.
- Time/scope: R-09, R-14.
- Demo: R-05, R-06.
- Judging/competitive: R-10 and the narrow response to Aletheia/ClinicDx.
- Provenance: R-08.

## 7.5 Judge Experience

### First visit

The UI opens without login and immediately shows:

- “Offline pediatric respiratory review for trained frontline workers.”
- Explicit age and complaint boundary.
- “Not diagnosis or treatment” limitation.
- Canonical model name, quantization, hash prefix, QVAC SDK version, and readiness; the separate profiler view names the pinned llama.cpp revision.
- Loopback runtime status from live child health plus a separately labeled measured egress-proof status from the latest verified offline evidence. The UI never infers “offline” from loopback binding alone.
- Source catalog review status.
- Required observation form and two fresh example-input buttons.
- Separate links for “Current request proof” and “Official profiler evidence.”

### Ten-second test

A judge understands that this is offline supervised respiratory escalation support, not a medical chatbot, because the claim, cohort, limitation, model identity, and form are all above the fold.

### Thirty-second test

A judge can load a respiratory case and see explicit observations, real pipeline stages, and source metadata before final guidance.

### Sixty-second test

A judge can complete the primary hard case and inspect a deterministic state, valid source ID, matching model hash, and current-request metrics.

### Seed script requirements

`scripts/seed-demo.ts` verifies prerequisites and writes no generated clinical result. It validates the two independently authored input fixtures, canonical model checksum, reviewed source catalog, and expected local ports. Re-running it produces the same prerequisite report.

### Demo-insurance invariant

Preloading the real model and keeping real input fixtures is allowed and disclosed. Precomputing a response, copying prior output, faking progress, or substituting a fallback model is prohibited.

## 7.6 Judge Proof Artifacts

The generic `/proof` contract is adapted to an offline artifact project.

| Artifact | Proof | Path |
|---|---|---|
| Model identity | URL, full revision, file, bytes, SHA-256, quantization, license | `evidence/model-decision.json` |
| Runtime identity | llama.cpp commit, command, threads, GPU layers, context | `evidence/runtime-identity.json` |
| Raw-model quality | Holdout cases, raw response hashes, rubric, human review | `evidence/raw-model/` |
| Profiler | Command, commit, exit code, raw log, `submission.json` | `evidence/profiler/` and root |
| Product parity | App health hash equals metadata/downloader/profiler hash | `evidence/parity.json` |
| Offline | Denied-egress command, negative control, successful request trace | `evidence/offline/` |
| Product safety | Exact inputs and deterministic final states | `evidence/clinical/` |
| Target laptop | CPU, OS, governor, ambient, run hashes, TPS, RSS, temperature, throttle | `evidence/target-laptop/` |
| Provenance | Signed structured file-level clean-build inventory, dependency/source licenses, and content-addressed approval ledger for any exception | `PROVENANCE.json`, `PROVENANCE.sig`, `LICENSES.md`, `docs/organizer-clarifications/` |

The localhost `/proof` route reads only committed/generated evidence files and current health. It never invents missing evidence. Missing physical-laptop proof is visibly “not yet verified,” not zero or pass.

## 8. Deadline-Aligned Build Plan

### Emergency scope policy

The remaining time is below two full build days. The plan cuts P1/P2 and preserves a real P0. Heavy model work stays serialized.

| Window | Primary objective | Secondary objective | Required deliverable |
|---|---|---|---|
| Aug 23, first block | Finalist safety/format/license gate | Freeze prompt/template policy | Signed model decision or explicit reopen |
| Aug 23, second block | Metadata, downloader, direct runtime, parity | Basic source manifest | Clean anonymous download and direct response |
| Aug 23, third block | Deterministic policy, binder, parser, tests | Minimal local API/UI | Supported, referral, negation, abstention pass |
| Aug 24, first block | Full profiler and early Devpost survival checkpoint | Report skeleton and prompt parity | Valid public root and saved editable submission |
| Aug 24, second block | Offline, clean clone, cgroup, failure/stress | Physical laptop run | Evidence bundle with honest tier labels |
| Aug 24, final block | 118-second video, screenshots, package, preflight | Only safe bug fixes | Submitted project and confirmation before 23:45 PDT |

### Cut order

1. QVAC retrieval.
2. QVAC TTS.
3. QVAC STT.
4. Streaming beyond reliable stage events.
5. Rich telemetry and visual polish.
6. Any extra clinical pathway.

Never cut checksum verification, direct runtime, model/app parity, deterministic safety, source binding, offline proof, provenance, full required profiler evidence, early submission checkpoint, or final submission.

## 9. Dependencies and Prerequisites

### Required tools

| Tool | Pin policy | Purpose | Credential |
|---|---|---|---|
| Ubuntu 22.04 x86-64 | Target release host | Final compatibility and thermals | None |
| Node.js | Exact version in lockfile/toolchain | Local API, UI, tests | None |
| llama.cpp | Exact pinned official revision | Raw/profiler compatibility and benchmark evidence, distinct from the QVAC product runtime | None |
| ADTC profiler | `ac2e137dca65ea3b09d997774f17dd8907b489fb` unless official drift is accepted | Official evidence | None |
| Python | Profiler-supported pin | ADTC profiler and accuracy | None |
| curl, sha256sum | OS packages | Model provisioning and verification | None |
| Git/GitHub | Public repository | Evaluator delivery | Publish credential for builder only; none for judge |

### Model finalist dependencies

| Candidate | Current evidence | Release status |
|---|---|---|
| MedPsy-1.7B Q4_K_M imatrix | 6.23 generation TPS, 1,414.48 MB peak RSS, comparative x86 | Unfrozen finalist |
| MedPsy-4B Q4_K_M imatrix | 2.74 generation TPS, 2,831.22 MB peak RSS, comparative x86 | Unfrozen finalist |

Those numbers are controlled GitHub Actions evidence, not physical-laptop or official audit results.

### Optional QVAC

QVAC SDK 0.17.1 is excluded from P0. Any later adapter must independently pass Ubuntu x86, Node requirement, offline preprovisioning, license, cold/warm/failure/unload memory, network-silence, and value-ablation gates. Failure cuts only that adapter.

### Credentials

Canonical build, download, inference, profiling, and judge use require no secret environment variables. Builder GitHub/Devpost authentication is outside the product runtime and must never enter `.env.example` or committed evidence.

## 10. Concerns Compliance

| ID | Severity | Concern | PRD response |
|---|:---:|---|---|
| CON-01 | C | 120-second demo must use real canonical inference | Demo scenes F-01/F-02 run the QVAC product path; precomputed output is prohibited |
| CON-02 | C | Metadata, downloader, app, and profiler can drift | C-01/C-02/C-04/C-09 share path and SHA parity gate |
| CON-03 | C | Clinical policy must fail closed | Seven-state taxonomy, explicit precedence, schema validation, and source binder |
| CON-04 | I | Optional features can consume deadline | Emergency real-P0 mode and explicit cut order exclude QVAC until P0 |
| CON-05 | I | Evidence planes can be confused | Raw-model, product, CI, local ARM, and physical-laptop labels are mandatory |
| CON-06 | A | UI polish can obscure proof | Proof readability, keyboard access, and distinct clinical states precede aesthetics |

## 11. P0 Feature List

| Feature ID | Feature | Priority | Acceptance summary |
|---|---|:---:|---|
| FTR-001 | Canonical model contract and anonymous provisioning | P0 | Exact metadata path, revision, bytes, SHA-256, idempotent second run |
| FTR-002 | Mandatory finalist model gate | P0 | No model freeze before raw safety, format, license, resource, and thermal decision |
| FTR-003 | Direct CPU-only llama.cpp runtime | P0 | One loopback process, four threads, zero GPU layers, bounded context |
| FTR-004 | Supported pediatric respiratory intake | P0 | Age/complaint boundary and all required observations validate |
| FTR-005 | Strict model schema and fail-closed parsing | P0 | Extra/malformed output cannot reach final UI |
| FTR-006 | Deterministic referral/review/abstention policy | P0 | Exact precedence and negation fixtures pass |
| FTR-007 | Reviewed local source binding | P0 | Every displayed action maps to an approved source ID |
| FTR-008 | Offline localhost workflow and real stages | P0 | Full supported case passes with denied egress |
| FTR-009 | Cancellation, timeout, queue, and recovery | P0 | Slot/process resources release and retry starts clean |
| FTR-010 | Raw-model/product evidence separation and parity | P0 | Same hash; every metric has host and evidence tier |
| FTR-011 | Early submission-survival checkpoint | P0 | Valid public root, report, prompts, profiler values, video plan, saved editable Devpost draft |
| FTR-012 | 118-second proof-led demo path | P0 | Timed final video proves offline inference, safety, sources, parity, and honest metrics |

## 12. Product Quality Gates

1. **Model gate:** one finalist passes raw-model clinical, formatting, truncation, visible-thinking, license, reproducibility, and physical-resource gates.
2. **Contract gate:** metadata validates, two prompts are exact, and downloader verifies the final path and hash twice.
3. **Clinical gate:** all mandatory release cases return exact deterministic states with valid sources and no prohibited content.
4. **Offline gate:** complete workflow succeeds under OS-level denied egress; negative control proves the denial is real.
5. **Resource gate:** model, full text workflow, and repeated requests remain inside internal/hard budgets without OOM or process leak.
6. **Profiler gate:** required participant command exits zero and creates schema-valid `submission.json`.
7. **Physical gate:** target-class laptop evidence records thermals and throttle status; absent evidence blocks final hardware claims.
8. **Provenance gate:** clean-build audit finds no imported Triage-0 implementation artifact without approval.
9. **Submission gate:** Devpost fields, prompts, values, URLs, media, and acceptance are complete and actually submitted.

## 13. Resource Budgets

| Resource | Internal target | Hard cut/fail condition |
|---|---:|---:|
| Canonical model-process peak RSS | Q4 under 1.8 GB; 4B under 3.3 GB on comparable x86 | 6.0 GB |
| Full P0 text workflow process-tree peak RSS | Under 4.0 GB | 6.5 GB |
| Optional support stage process-tree peak RSS | Not in P0 | 7.0 GB; cut adapter |
| Context | 2048 tokens | No increase without measured safe need |
| Threads | 4 | No final claim from different thread count |
| GPU layers | 0 | Any nonzero value fails canonical mode |
| Active generations | 1 | Never more than one |
| Waiting requests | 0 | Any concurrent request receives 409; the queue is bounded at zero |
| Case note | 2,000 characters | Reject larger input |
| Assessment JSON | 32 KiB | Reject larger body |
| Startup readiness | 120 seconds | Controlled failure and cleanup |
| Assessment deadline | 90 seconds | Cancel child request and fail closed |
| Preferred target temperature | Below 80 C | 85 C or throttle flag fails release |
| Demo video | 118-second script target | Over 120 seconds fails submission |

## 14. Raw-Model and Product Evidence Planes

| Claim | Raw-model plane | Product plane | Forbidden inference |
|---|---|---|---|
| Medical response quality | Direct holdout and participant prompts | Reviewed summary in supported workflow | App rules improved official accuracy |
| Safety | Free-form hallucination/format review | Deterministic exact-state suite | Safe app proves safe raw model |
| Throughput/RSS | Official profiler and labeled host | Current-request latency/process tree | CI TPS equals target laptop |
| Offline | Model invocation with no network | Full browser-to-result denied-egress trace | Offline model implies offline product |
| Sources | Not evaluated by raw profiler | Approved binder and exact source IDs | Model citation text is valid evidence |
| Parity | GGUF path/byte identity and submitted prompt declarations | Health/path/hash plus exact metadata↔submission prompt equality | Same model name implies same bytes or profiler prompt execution implies product prompt behavior |

## 15. Release Case Matrix

| Case | Input characteristic | Required state |
|---|---|---|
| RC-01 | Complete supported case, no escalation criterion | `NO_ESCALATION_CRITERION_DETECTED_IN_ENTERED_DATA` |
| RC-02 | General danger sign | `REFERRAL_CRITERION_DETECTED` |
| RC-03 | Explicitly negated danger sign | Must not match the positive danger criterion |
| RC-04 | Missing respiratory rate or ambiguous danger sign | `INSUFFICIENT_OR_AMBIGUOUS` |
| RC-05 | Recurrent wheeze or cough over 14 days | `ALTERNATE_PATHWAY_REVIEW` |
| RC-06 | Child aged 9 months with fast breathing threshold met | `PROMPT_CLINICAL_REVIEW` |
| RC-07 | Adult or non-respiratory complaint | `OUTSIDE_SUPPORTED_SCOPE` before inference |
| RC-08 | Prompt injection in note | Policy/schema/source boundaries unchanged |
| RC-09 | Malformed model JSON | `INVALID_OUTPUT_OR_SYSTEM_FAILURE` |
| RC-10 | Model text invents local resource | Prohibited phrase rejected; no resource displayed |
| RC-11 | Low confidence or conflicting facts | `INSUFFICIENT_OR_AMBIGUOUS` or alternate review, never false reassurance |
| RC-12 | Cancel or timeout | `INVALID_OUTPUT_OR_SYSTEM_FAILURE`; slot released |

## 16. Final Scope Freeze

P0 is exactly the twelve features in Section 11. There are no P1 or P2 implementation obligations for Gate 1. QVAC adapters, translation, broad respiratory diagnosis, additional syndromes, longitudinal records, FHIR integration, medicine/dose logic, and a hosted site are explicitly absent. Any proposal to add one must first prove all nine P0 quality gates green and must be cut automatically if it threatens the submission checkpoint.
