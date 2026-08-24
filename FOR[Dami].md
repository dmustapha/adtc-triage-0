# FOR[Dami]: Triage-0 ADTC Build Handbook

## 1. What This Project Does

Triage-0 ADTC is a local, English-only clinical decision-support prototype for trained or supervised frontline workers. It combines a structured respiratory assessment, deterministic safety rules, local protocol citations, and a bounded MedPsy workflow while keeping the official ADTC raw-profiler path separate. The current local Build is testable, but it is not clinically validated and is not submission-ready.

## 2. Vocabulary

**ADTC**
The Africa Deep Tech Challenge 2026 Laptop LLM competition. Its evaluator downloads one GGUF and runs it through official `llama.cpp` on constrained hardware.

**GGUF**
The model-file format used by `llama.cpp`. This repository locks one MedPsy file by revision, byte count, and SHA-256, but never tracks or retains the weight file.

**MedPsy**
The single locked model, `qvac/MedPsy-1.7B-GGUF`, used by the QVAC product path and official raw-profiler path over identical bytes.

**QVAC SDK 0.13.3**
The pinned local product runtime. It owns model lifecycle, embeddings, retrieval, and the two-pass product orchestration, but it is not the official ADTC profiler runtime.

**Official raw-profiler path**
Pinned direct official `llama.cpp` execution over the locked GGUF. It proves artifact identity, runtime compatibility, and raw telemetry, not product safety or clinical effectiveness.

**Structured danger assessment**
The patient age and seven respiratory observations submitted with a case. Six observations can trigger emergency escalation; lower chest-wall indrawing is a separate age-scoped pneumonia-classification sign.

**Deterministic safety policy**
Pure code that owns assessment-required behavior, emergency precedence, age-scoped chest-indrawing routing, citations, and structured severity. Free text and model-authored `red_flags` cannot override it.

**Assessment required**
The fail-closed result when age is unsupported or a necessary observation is missing, `NOT_ASSESSED`, or internally conflicting and no known emergency observation is present.

**Evidence plane**
A namespace with a narrow proof claim. `medpsy-product-v2` covers the real supported-platform QVAC product path; `medpsy-raw-profiler-v2` covers direct official `llama.cpp`.

**Calibration**
The pre-registered development set that must pass before sealed holdouts can run. The current v2 labels remain provisional until named clinical review.

**Sealed holdout**
An independent unseen evaluation set. Only IDs and coverage requirements exist now; content was not created or inspected during Build.

**Model decision**
The signed release artifact that would authorize claim-bearing Phase 2. It does not exist because product, holdout, human, and physical gates are incomplete.

**Evidence tier**
The hardware and execution class attached to a result. Apple development and GitHub CI evidence cannot be promoted to physical Ubuntu target-laptop proof.

**Import manifest**
The 76-entry provenance ledger tying reused Triage-0 files to exact Git objects from commit `74424721bc75f564808eacce42d7f7f42676ae0f`.

**No-egress guard**
The local runtime boundary that records or blocks unexpected network access after provisioning.

## 3. How the Code Is Organized

`src/server.ts` hosts the localhost app, validates requests, exposes health telemetry, and gates structured cases before any QVAC acquisition. `src/triage/` contains request schemas, structured-danger policy, routing, deterministic severity, source mapping, and the model-backed triage pipeline. `src/qvac/` owns QVAC lifecycle, engine calls, offline guards, and performance logs. `src/rag/` owns protocol ingestion and the local retrieval store.

`config/` contains immutable machine-readable contracts. The canonical model identity lives in `config/canonical-model.json`; structured safety lives in `config/structured-danger-v1/contract.json`; the two v2 evidence planes have separate contracts. `scripts/medpsy-product-v2/` and `scripts/medpsy-raw-profiler-v2/` produce and evaluate different evidence claims. `public/` contains the compact worker UI. `tests/` mirrors safety, integration, evidence, provenance, and UI behavior.

The primary data flow is:

1. The worker enters case text, age, and all seven observations in `public/app.html`.
2. `public/assets/js/triage.js` serializes the structured request to `POST /triage`.
3. `src/server.ts` validates the request and runs `evaluateDangerPolicy` before QVAC, routing, retrieval, or MedPsy.
4. Emergency, assessment-required, and supported chest-indrawing branches return deterministic results with source-bound citations.
5. Only a supported all-absent assessment enters QVAC retrieval and the two-pass MedPsy path.
6. The server reconciles the model output with deterministic policy, emits safe SSE events, and never exposes raw reasoning.

## 4. Prompting Tips for This Codebase

1. Name the evidence plane. Ask about `medpsy-product-v2` for product behavior or `medpsy-raw-profiler-v2` for official-runtime behavior.
2. Include the exact model identity when changing provisioning, parity, or evidence code. Never ask to search for a replacement model.
3. For safety changes, cite `config/structured-danger-v1/contract.json`, `src/triage/danger-observations.ts`, and the relevant focused tests.
4. For UI changes, require comparison with baseline commit `74424721` and preserve compact progressive disclosure.
5. For evidence changes, specify whether remote execution, publication, model download, holdout inspection, or external mutation is authorized. The default here is no.
6. For a bug report, include the request body, deterministic route, HTTP or SSE output, whether QVAC was acquired, and the exact focused test command.
7. Ask for claim review separately from code review. Passing local tests does not create clinical validation, physical proof, or submission readiness.

## 5. Domain Knowledge

### Structured safety ownership

An unmentioned clinical sign is not the same as an assessed-absent sign. The seven explicit observations make that distinction auditable. If this boundary is misunderstood, omitted fields can silently bypass safety checks.

### Chest indrawing versus emergency signs

Lower chest-wall indrawing is age-scoped and does not automatically mean emergency referral in the frozen respiratory policy. The other six listed observations can establish emergency escalation. Treating all seven identically recreates the original critical design defect.

### Product evidence versus profiler evidence

The QVAC product path includes retrieval, two model passes, schema handling, retries, deterministic reconciliation, and citations. The direct `llama.cpp` path does not. A raw-profiler pass therefore cannot prove the product workflow is safe or effective.

### Calibration before holdout

The frozen calibration must pass under its registered contract before sealed holdouts run. Looking at holdouts early or tuning against failed cases destroys the independence of the evidence.

### Hardware evidence tiers

GitHub Ubuntu CI is useful for Linux compatibility and raw execution. It is not a physical target-class Ubuntu laptop and cannot support target thermal, throttling, or official-equivalent throughput claims.

## 6. Gotchas and Non-Obvious Behavior

**A missing checklist does not mean all absent**
What it looks like: An older client sends only `caseText`.
What actually happens: The server normalizes missing observations to `NOT_ASSESSED` and returns assessment-required without invoking MedPsy.
How to avoid it: Always submit supported age plus all seven explicit observations.

**Deterministic cases must not load QVAC**
What it looks like: Initializing QVAC once before the corpus loop seems simpler.
What actually happens: It can download or load large assets before a case that should have short-circuited.
How to avoid it: Keep QVAC acquisition lazy inside the named QVAC branch and test zero boundary events for deterministic routes.

**A valid JSON shape can still be clinically wrong**
What it looks like: Grammar-constrained output parses successfully.
What actually happens: A grammar controls syntax, not semantic fact selection.
How to avoid it: Apply frozen semantic gates, deterministic policy, and independent clinical review.

**`Online` can be misread as internet connectivity**
What it looks like: A badge may mean the localhost service responds.
What actually happens: Users may read it as proof that networking is enabled or required.
How to avoid it: Stress must relabel the status with explicit localhost and offline semantics.

**Pre-run device copy can overclaim**
What it looks like: “This ran on the device” appears before any request completes.
What actually happens: An empty store or absent resident model means no inference has yet run.
How to avoid it: Stress must qualify the copy by pre-run, deterministic-only, and real-inference states.

## 7. Debugging Guide

### Structured request and deterministic policy

Run `node --import tsx --test tests/unit/danger-observations.test.ts tests/unit/severity.test.ts`. Unexpected QVAC activity on missing or emergency inputs usually means validation moved after `triageContext` or a model flag regained authority.

### HTTP and SSE

Run `node --import tsx --test tests/integration/http-validation.test.ts tests/integration/sse-contract.test.ts`. Check status codes, event ordering, deterministic citation behavior, and whether the runtime observer records any forbidden boundary.

### QVAC and RAG

Run `npm run ingest` only when the local protocol sources and store prerequisites are intentionally present, then start the server separately. The server and ingest process must not open the single-writer store at the same time. Store-dependent tests skip truthfully when that prerequisite is absent.

### Evidence producers

Run the focused v2 suites, `npm run typecheck`, JSON parsing, and YAML parsing. Never execute `run-qvac.ts` without real supported-platform evidence and exact GGUF bytes. Never run the sealed holdout stage before a passing, manifest-bound calibration evaluation.

### Provenance and model-byte safety

Run `npm run verify-import-manifest`, `git diff --check`, and scans for `.gguf`, `.partial`, `.part`, QVAC cache paths, and secrets. A clean source diff does not replace the no-weight scan.

## 8. Mistakes Log

**2026-08-24: Live QVAC started during an intended RED test**
What happened: Invalid-request testing reached the legacy runtime and began an incomplete embedding-model download.
Why it happened: Structured validation had not yet been placed before `triageContext`.
How to avoid: Assert the no-runtime and no-network boundary before rerunning invalid-input tests.

**2026-08-24: The first structured form displaced the baseline UI**
What happened: Seven always-visible tri-state controls dominated the compact intake screen.
Why it happened: Safety behavior was tested without screenshot-backed fidelity acceptance.
How to avoid: Preserve the baseline hierarchy and use native progressive disclosure for required detail.

**2026-08-24: Active profiler prompts drifted from metadata**
What happened: Healthcare metadata changed while the active profiler policy retained stale Python prompts.
Why it happened: Focused metadata tests did not bind the separate active policy.
How to avoid: Test prompt parity across every active configuration owner.

## 9. Quizzes

### Conceptual

1. Why can direct official `llama.cpp` evidence not prove the QVAC product is clinically safe?
2. Why must missing danger observations become `NOT_ASSESSED` instead of `ABSENT`?
3. Why is chest indrawing separated from the six emergency-capable observations?

### Practical

1. A known emergency observation is present, but age is missing. Which branch wins and should MedPsy run?
2. A calibration evaluation passes but references a different producer-manifest hash. May the holdout run?
3. GitHub CI reports good throughput. Can `REPORT.md` call it physical Ubuntu target-laptop performance?

### Code reading

1. Read `src/triage/danger-observations.ts` around `evaluateDangerPolicy` at line 56. What branch precedence does it enforce?
2. Read `src/server.ts` around `POST /triage` at line 164. What would break if structured parsing moved below `triageContext`?

### Answer key

1. The product has retrieval, two passes, retries, deterministic reconciliation, citations, and QVAC lifecycle behavior that direct raw execution does not exercise.
2. Not mentioned is not clinically equivalent to assessed absent, so absence would create a silent unsafe default.
3. The frozen protocol treats isolated chest indrawing as an age-scoped pneumonia sign, not automatic emergency referral.
4. Emergency wins, a deterministic referral result is returned, and MedPsy must not run.
5. No. The prerequisite is cryptographically inconsistent and must fail closed.
6. No. CI evidence must stay labeled as CI and cannot be promoted to physical evidence.
7. Emergency present, then assessment required, then supported chest-indrawing routing, then all-absent QVAC.
8. Invalid or deterministic requests could acquire QVAC, touch the network, or load assets before they are allowed to short-circuit.

## Current Build Boundary

Local Tasks 1 through 10 are complete under a claim-limited scope. The local suite last recorded 277 total, 255 pass, 0 fail, and 22 prerequisite skips. Real supported-platform QVAC calibration, independent sealed holdouts, named clinical review, physical Ubuntu proof, real submitter identities, and a signed model decision remain absent. `phase2Authorized=false` and `modelDecisionExists=false` remain mandatory.

Authorized downstream work is limited to local inspection and hardening from Debug through Interrogate DEEP. It must stop before Demo Rehearsal and cannot claim a validated real QVAC clinical workflow, named clinical review, physical Ubuntu proof, a signed model decision, or submission readiness. No push, workflow dispatch, paid spend, video publication, Devpost submission, model download, or other external mutation is authorized.
