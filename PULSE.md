# PULSE — Pipeline Rolling Context

## Active Facts
| Fact ID | Skill | What Changed | Old -> New |
|---------|-------|--------------|------------|
| AF-I1 | intel | [SKILL] Current public competitor evidence | 1,764 participants -> identities inaccessible; gallery unpublished; zero publicly observable formal submissions |
| AF-I2 | intel | [SKILL] Current profiler behavior | v0.1.0 forum bugs -> fixed at inspected head ac2e137 |
| AF-I3 | intel | [USER] GPU grant status | expired five-hour application -> optional compute support, not eligibility or submission requirement |
| AF-I4 | intel | [USER] Organizer video messaging | generic offline-AI framing -> judges are explicitly primed for current-hardware proof, local African ground applicability, and constraint-driven engineering |
| AF-T1 | candidate-fit-audit | [SKILL] Triage-0 evaluator fit | QVAC application-only runtime -> standalone llama.cpp/GGUF scored core plus optional QVAC product layer |
| AF-T2 | candidate-fit-audit | [TEST] MedPsy pinned-runtime proof | unverified raw weight -> b10175 loads Q4 GGUF at 21.93 gen TPS and ~1.08 GiB max RSS on M1 CPU-only spot run |
| AF-T3 | candidate-fit-audit | [TEST] Public fresh-clone proof | undocumented status -> typecheck green; 119 pass, 1 fail, 28 skip; production audit zero known vulnerabilities |
| AF-T4 | candidate-fit-audit | [USER] ADTC technology depth | evaluator-only llama.cpp boundary -> direct llama.cpp, metadata, downloader, profiler, and hardware budgets must drive both product and submission |
| AF-T5 | candidate-fit-audit | [OFFICIAL] Prior-work ambiguity | broad early-PoC rules -> manager clarification also says submitted project must be built from scratch for this challenge |
| AF-M1 | component-migration-audit | [TEST] Profiler measurement boundary | assumed full workflow visibility -> throughput, RSS, and thermals wrap llama-bench while accuracy loads the GGUF directly at n_ctx 2048 |
| AF-M2 | component-migration-audit | [USER] Integration hierarchy | QVAC-centered application plus scoring adapter -> ADTC-native spine, clinical control layer, optional QVAC senses |
| AF-M3 | component-migration-audit | [TEST] QVAC version surface | Triage-0 pins SDK 0.13.3 -> public registry latest is 0.17.1, so any new pin requires x86, API, offline, and memory qualification |
| AF-S1 | scope-handoff | [USER] Pipeline posture | normal pipeline defaults -> ADTC-specific phase overrides; no phase resumed and Forge remains unstarted |
| AF-S2 | scope-handoff | [SKILL] Conductor state mismatch | user-selected Approach C -> conductor still records Warroom running and Checkpoint 2 unanswered |
| AF-S3 | scope-handoff | [TEST] Model shortlist | three candidates -> MedPsy Q5 eliminated; Q4 and 4B remain unfrozen finalists |
| AF-S4 | scope-handoff | [USER] Forge input boundary | exact taxonomy, claim, budgets, schemas, and observables listed as pre-Forge unknowns -> now assigned as explicit Forge deliverables under the frozen invariants |
| AF-N1 | conductor-resume | [USER] Final project identity | project name pending -> Triage-01 selected; it is a new ADTC-native implementation, not a Triage-0 code revision |
| AF-F1 | forge | [USER] Architecture completion posture | further semantic re-audits -> Architecture frozen with five mandatory Build/release acceptance gates |
| AF-F2 | forge | [SKILL] Build blueprint | Plan/observables absent -> 53-file emergency-real-P0 plan and 12/12 behavioral observables complete |
| AF-B1 | build | [TEST] Raw finalist gate | two unfrozen MedPsy finalists -> both rejected for insufficient itemized training-lineage/rights evidence; no canonical GGUF selected |
| AF-B2 | build | [USER] Finalist recovery authorization | Build blocked on both MedPsy candidates -> reopen model choice while preserving the complete frozen raw gate and all P0 boundaries |
| AF-B3 | build | [USER] Prior OLMo behavioral verdict | run 32652354894 rejected OLMo -> verdict withdrawn because `-no-cnv` bypassed the embedded GGUF template |
| AF-B4 | build | [TEST] Corrected OLMo raw gate | invalid untemplated evidence -> run 32653499076 uses `--jinja --single-turn`, preserves all frozen inputs, and still fails multiple fatal gates |
| AF-B5 | build | [USER] Final recovery candidate | zero selected models -> lock `allenai/OLMo-2-1124-7B-Instruct-GGUF` Q4_K_M as the single authorized fourth-attempt candidate under the unchanged Phase 1 gate |
| AF-B6 | conductor | [USER] Pipeline continuation target | stopped after attempt 4 -> resume Build through an explicit product-contract requirements revision and continue through Demo Rehearsal only if every FSM gate passes |
| AF-R1 | conductor | [USER] Healthcare recovery authority | failed OLMo clean-build contract -> transparent Triage-0 reuse from commit `74424721` with MedPsy-1.7B Q4 as the sole shared-GGUF candidate |
| AF-R2 | conductor | [USER] Runtime ownership correction | direct llama.cpp-only product -> QVAC product plus direct llama.cpp profiler over identical MedPsy bytes and checksum |

## Decisions Log
| # | Skill | Decision | Why | Affects |
|---|-------|----------|-----|---------|
| 1 | intel | [USER] Preserve no-training baseline and serialize heavy runs | Agents share the M1 host and the deadline is close | warroom, forge, build, stress_test |
| 2 | intel | [SKILL] Use local ARM plus constrained x86 CI as an evidence ladder | Neither environment proves official thermals; each catches different failures | forge, build, stress_test, verify_preflight |
| 3 | intel | [SKILL] Treat accuracy as mandatory in participant profiling | Official FAQ and profiler guidance conflict; missing accuracy may score zero | build, stress_test, package |
| 4 | intel | [USER] Make the proof story mirror organizer language without copying transcript errors | The video frames cloud assumptions as the wall and the 8 GB constraint as the strategic advantage | warroom, forge, demo, package |
| 5 | [USER] | [USER] Pause warroom and audit existing Triage-0 before choosing a winner | Reusing a proven offline healthcare system may dominate a new concept if it satisfies the ADTC evaluator contract | warroom, forge, critique, build |
| 6 | candidate-fit-audit | [SKILL] Select Triage-0 conditionally and combine rather than swap | Product/domain fit is exceptional, but ADTC bypasses QVAC and scores one raw GGUF through llama.cpp | warroom, forge, build, demo, package |
| 7 | candidate-fit-audit | [SKILL] Follow latest checklist for submitted profiler artifact while retaining private accuracy evidence | Latest official update explicitly instructs `--skip-accuracy`; model selection still benefits from a development accuracy run | build, verify_preflight, package |
| 8 | candidate-fit-audit | [USER] Supersede D-T1: start a new ADTC-native template fork and gate Triage-0 code reuse on written approval | A new repo cannot erase QVAC-hackathon provenance; official manager wording creates a material eligibility risk | forge, build, demo, package |
| 9 | component-migration-audit | [USER] Select ADTC-native spine with a narrow clinical workflow and optional QVAC senses | Makes mandatory technology load-bearing while preserving product differentiation and preventing a second LLM runtime | forge, build, debug, demo, package |
| 10 | component-migration-audit | [SKILL] Replace two-pass QVAC reasoning with one direct schema-constrained llama.cpp pass | Cuts latency and context cost; deterministic code owns severity, citations, and treatment facts | forge, build, debug |
| 11 | scope-handoff | [USER] Keep the full pipeline but adapt every phase to the ADTC systems contract | Hosted-app and sponsor-SDK defaults do not fit an offline GGUF competition | conductor, forge, critique, build, debug, wire, verify_milestone, design_forge, stress_test, deploy, livetest, interrogate, demo_rehearsal, demo, package, verify_preflight |
| 12 | scope-handoff | [USER] Do not enter Forge during scoping | The current task is to freeze decisions and caveats for a later Forge dispatch | conductor, forge |
| 13 | scope-handoff | [SKILL] Treat public repo plus credential-free model as deployment | Vercel and Lightsail are not required product hosts | deploy, livetest, package, verify_preflight |
| 14 | scope-handoff | [SKILL] Prohibit emergency mocks in scored and clinical paths | Under deadline pressure, a smaller real system is safer than fake proof | forge, build, debug, wire, verify_milestone, stress_test, livetest, demo, verify_preflight |
| 15 | conductor-resume | [USER] Reconcile the stale Warroom phase without restarting generators | The Triage-0 clinical thesis plus Approach C is already selected; only the final project name remains at Checkpoint 2 | conductor, forge, critique |
| 16 | conductor-resume | [USER] Name the new project Triage-01 | Preserves product-thesis lineage while requiring explicit clean-build provenance separation from Triage-0 | forge, critique, build, demo, package |
| 17 | forge | [USER] End Architecture review loop and proceed | Structural/type/test evidence is strong enough; remaining gaps are executable release-proof obligations, not reasons to redesign the product | critique, build, debug, verify_preflight |
| 18 | build | [USER] Reopen finalist model choice after both MedPsy candidates failed lineage | No sufficient new MedPsy evidence was supplied; replacement candidates may be evaluated only under the unchanged content-addressed raw gate | build, debug, package, verify_preflight |
| 19 | build | [USER] Correct the OLMo producer with pinned llama.cpp `--jinja --single-turn -p` | `-no-cnv` disables conversation/template application, so the prior behavioral verdict was invalid and could not be reused | build, debug, package, verify_preflight |
| 20 | build | [USER] Lock OLMo-2-1124-7B-Instruct Q4_K_M as the final recovery candidate | It is the only screened option combining an official anonymous GGUF, complete public training chain, pinned `olmo2` runtime compatibility, and materially greater capacity than the rejected 1B model | conductor, build, debug, package, verify_preflight |
| 21 | conductor | [USER] Continue the conductor through Demo Rehearsal | Preserve the failed bare-prompt evidence, revise Phase 1 to test the same OLMo-2 7B under the actual constrained product contract, and advance only after a signed passing model decision | build, debug, wire, verify_milestone, design_forge, stress_test, deploy, livetest, interrogate, demo_rehearsal |
| 22 | conductor | [USER] Retain healthcare through the shared-MedPsy Triage-0 recovery | The existing product and exact model are already proven together; the former MedPsy stop was pre-inference and the clean-build migration discarded the working orchestration | build, debug, wire, verify_milestone, stress_test, deploy, livetest, interrogate, demo_rehearsal, demo, package, verify_preflight |

## Downstream Items
<!-- Owner-routed, non-blocking deferred work. Every skill reads on entry, actions rows it owns. See PULSE-PROTOCOL § Downstream Items. -->
| ID | Raised by | Owner phase | Pri | Item | Acceptance | Status |
|----|-----------|-------------|:---:|------|-----------|:------:|
| DI-I1 | intel | stress_test | P1 | Run serialized three-candidate x86 workflow under 4 CPU, 8 GB, offline cgroup | Raw logs and candidate comparison saved; no claim of official-equivalent TPS or thermals | done |
| DI-I2 | intel | verify_preflight | P1 | Run three cold-boot profiler passes on borrowed target-class Ubuntu 22.04 laptop | CPU SKU, governor, ambient, hashes, TPS, RSS, accuracy, and thermals recorded | open |
| DI-I3 | intel | package | P1 | Recheck registered Devpost form and unresolved team-ID field | Form fields and hosting constraints are captured; team-ID semantics still require final confirmation | partial |
| DI-T1 | candidate-fit-audit | build | P0 | Create template-derived ADTC root with one canonical GGUF and optional QVAC app | Required root artifacts validate; model remains runnable if app directory is removed | done |
| DI-T2 | candidate-fit-audit | debug | P0 | Resolve fresh-clone model-path contract failure and distinguish required-asset skips | Full test summary has no unexplained failures; offline default and docs agree | done |
| DI-T3 | candidate-fit-audit | verify_preflight | P0 | Run pinned profiler on target-class Ubuntu x86 | Fresh-clone hash, TPS, RSS, thermals, and submission JSON recorded | open |
| DI-T4 | candidate-fit-audit | build | P0 | Resolve the prior-work boundary through transparent reuse | Freeze commit `74424721`, enumerate imported files and hashes, preserve notices, and disclose the prior QVAC submission | done |
| DI-S1 | scope-handoff | forge | P0 | Freeze the narrow clinical taxonomy, exact claim, resource budgets, and feature observables | PRD and architecture encode real P0 behavior and cuttable QVAC adapters | done |
| DI-S2 | scope-handoff | build | P0 | Reach an early valid Devpost submission-survival checkpoint before P1 work | Required repository, report, prompts, profiler values, video plan, and saved draft are present | open |
| DI-S3 | scope-handoff | verify_preflight | P0 | Close every item in the ADTC-specific Definition of Done | Clean clone, offline app, parity, safety, provenance, physical evidence, and submitted Devpost entry pass | open |
| DI-B1 | build | stress_test | P1 | Clarify the header `Online` badge so it cannot imply internet connectivity | Verified five viewports and live transitions: badge says Browser online/offline and never implies inference | done |
| DI-B2 | build | stress_test | P1 | Hide or qualify pre-run `This ran on the device` copy until inference evidence exists | Removed unconditional network-proof footer; pre-run model and egress proof remain absent until health evidence exists | done |
| DI-W1 | wire | deploy | P1 | Replace the placeholder root REPORT with an evidence-bound healthcare report | Correct domain and identity placeholders remain explicit; no missing QVAC, physical, clinical, signing, or submission proof is promoted | open |

## Skill Sections

---
### intel — 2026-08-22T06:29:33Z
**Status:** COMPLETE
#### Done
- Completed maximum-depth rules, profiler, model, dataset, compute, judge, workshop, and community research.
- Audited all 118 template forks and built a nineteen-entry named competitor registry.
- Produced two density maps, eight HIGH threat analyses, and a four-part kill list.
*[Pruned — full section in .pre-prune.bak]*

### candidate-fit-audit — 2026-08-22T11:12:00Z
**Status:** COMPLETE
#### Done
- Audited public Triage-0 commit `7442472`, local unpublished branches, source architecture, tests, proof artifacts, licensing, model lineage, and QVAC surfaces.
- Reconstructed the latest mandatory submission contract from Devpost, the organizer FAQ/checklist, template, profiler source, schema, and pinned llama.cpp build.
- Downloaded and checksum-verified the exact MedPsy-1.7B Q4 GGUF; proved direct CPU-only loading on pinned build b10175.
*[Pruned — full section in .pre-prune.bak]*

### component-migration-audit — 2026-08-22T15:20:00Z
**Status:** COMPLETE
#### Done
- Inspected every major Triage-0 model, QVAC, orchestration, clinical, retrieval, safety, API, UX, offline, telemetry, and test surface.
- Inspected the official profiler execution boundary, schema, throughput command, memory sampler, thermal sampler, accuracy backend, and audit tolerances at commit `ac2e137`.
- Compared three architectures and selected an ADTC-native spine with optional QVAC speech and retrieval adapters.
*[Pruned — full section in .pre-prune.bak]*

### approach-c-scope — 2026-08-22T16:28:00Z
**Status:** IN PROGRESS
#### Done
- Created the public official-template fork and merged the controlled three-model bakeoff harness.
- Confirmed the exact authenticated five-step Devpost form from the entrant's screenshots.
- Wrote `research/APPROACH-C-SCOPE-AND-SUBMISSION-PLAN.md` with the canonical architecture, exact form contract, no-Vercel decision, feature disposition, QVAC boundary, caveat closures, priorities, evidence tiers, and definition of done.
*[Pruned — full section in .pre-prune.bak]*

### scope_handoff — 2026-08-22T18:40:00+01:00
**Status:** COMPLETE
**Session(s):** 1

#### Done
- Consolidated all approved decisions into `FORGE-INTAKE.md`.
- Audited the full conductor sequence and wrote `research/ADTC-PIPELINE-SKILL-OVERRIDES.md`.
- Added the controlling override pointer to the active ADTC brief.

#### Additions (not in PRD/Architecture)
- [USER] [NEW] Added project-specific execution semantics for every remaining pipeline phase.

#### Deviations
- [USER] Forge and implementation remain unstarted. This work produced only scoping and handoff artifacts.
- [SKILL] Conductor-owned state was not edited despite its stale Warroom status.

#### Verified Facts
- [VF-S1] The conductor still records Warroom running, project name pending, and Checkpoint 2 unanswered.
- [VF-S2] Generic deploy and livetest defaults assume hosted URLs that ADTC does not require.
- [VF-S3] The active brief now routes every downstream phase to the two controlling scope documents.

#### Assumptions
- [A-S1] The user will choose or approve a project name during conductor Checkpoint 2. WILL-BREAK for Forge dispatch.
- [A-S2] A target-class physical laptop can be accessed before preflight. WILL-BREAK for final thermal claims.

#### Blockers for Downstream
- Conductor must reconcile Warroom and Checkpoint 2 before Forge.

#### Key Decisions
- [D-S1] Preserve full pipeline rigor while replacing hosted-app assumptions with public-artifact and offline-local proof.
- [D-S2] Cut optional features instead of using mocks under deadline pressure.

#### For Next Skill
- Conductor must not restart Warroom generators.
- Forge must treat `FORGE-INTAKE.md` and `research/ADTC-PIPELINE-SKILL-OVERRIDES.md` as mandatory inputs.

---
### conductor-resume — 2026-08-23T10:29:45+01:00
**Status:** COMPLETE
#### Done
- Passed the conductor resume gate with no state-integrity blockers.
- Preserved the partial Warroom artifacts and recorded the phase as user-skipped.
- Recorded the Triage-0 clinical thesis plus Approach C as the selected outcome without restarting any generator.
*[Pruned — full section in .pre-prune.bak]*

### forge — 2026-08-23T13:11:52+01:00
**Status:** BLOCKED
**Session(s):** 2

#### Done
- Completed Forge setup, direct-idea elaboration, technical spike, PRD, and independent PRD gate.
- Produced a full root Architecture blueprint and ran five bounded independent Architecture audits.
- Final structural evidence passed: 53/53 authored files, 54/54 tagged blocks, PRD cross-check 4/4, strict TypeScript PASS, and 24 tests PASS with 0 failures and 5 honest release-prerequisite skips.

#### Blockers for Downstream
- Fixed real finalist-gate producers and raw-artifact verification are not fully specified.
- Transactional release-pair rollback still has stage/backup filesystem failure gaps.
- Physical evidence ordering conflicts with clean-worktree offline proof and lacks immutable per-run host aggregation.
- Future organizer approval cannot be trust-pinned from a builder-declared key; safe default remains unavailable.
- Shutdown test coverage does not prove restart suppression.

#### Deviations
- Bounded audit attempt 5 returned a material semantic failure. Forge Phase 3, PLAN, Critique, URL Preverification, and Build were not entered.
- Conductor classified the block as `fundamental` and escalated with zero automatic retry budget.

#### For Next Skill
- Do not enter Plan or any downstream phase until the user chooses whether to authorize one narrowly scoped Architecture repair or accept a reduced/explicitly unavailable evidence claim.

---
### forge-completion — 2026-08-23T14:28:10+01:00
**Status:** COMPLETE
**Session(s):** 3

#### Done
- [USER] Froze `PRD.md` and `ARCHITECTURE.md` exactly as-is and ended the Architecture review loop.
- Created root `PLAN.md` with 53/53 Architecture-file coverage, 13 exact-command tasks, 14 risk decision trees, six gated phases, and a 22-hour emergency-real-P0 schedule.
- Created `FEATURE-OBSERVABLES.md` with one real behavioral observable for each of 12 P0 features.
- Created credential-free `.env.example` and finalized `.forge-state.json` as complete.
- Closed DI-S1: the narrow cohort/claim, resource budgets, and removable QVAC boundary are frozen in PRD/Architecture, and observables are explicit.

#### Verified Facts
- [VF-F1] Mechanical Plan coverage is 53/53 unique authored Architecture files; missing 0, extra 0.
- [VF-F2] All 13 tasks have an Architecture reference, exact command block, expected result, and commit message.
- [VF-F3] Plan contains 14/14 named PRD risk trees, 6/6 phase gates, and 12/12 P0 observables.
- [VF-F4] Canonical runtime needs zero environment variables or product credentials.

#### Blockers for Downstream
- None for Critique or URL Preverification.
- Build/release must close five acceptance gates: raw-artifact-backed fixed finalist producers; transactional release-pair rollback fault tests; offline-before-physical ordering with immutable per-run host aggregation; observed restart suppression; organizer trust unavailable until an external organizer-controlled key exists.

#### Key Decisions
- [D-F1] The five residuals are unproven Build/release acceptance gates, not completed Architecture proof.
- [D-F2] QVAC remains outside P0 and may be added only after submission survival and independent value/resource/license/offline gates.
- [D-F3] No semantic re-review was performed after the user's freeze order; completion checks were mechanical only.

#### For Next Skill
- Critique may assess the frozen blueprint once; it must not reopen an iterative Forge review loop.
- URL Preverification must treat GitHub plus credential-free GGUF as deployment and report unavailable pre-Build URLs honestly.
- Build remains undispatched pending the user's explicit approval after the consolidated pre-Build report.

## Degradations

| tier | phase | downgraded_what |
|---|---|---|
| peer-unavailable | positioning | Claude blind re-derivation unavailable: OAuth token expired (401) |

---
### critique — 2026-08-23T13:47:58Z
**Status:** COMPLETE
#### Done
- Completed one full-depth frozen-blueprint Critique with 16 dispositioned findings.
- Rated positioning differentiated, ADTC integration deep-by-design, and narrative compelling.
- Accepted five concrete elevations into Build P0 without editing frozen Forge documents.
*[Pruned — full section in .pre-prune.bak]*

### url_preverify — 2026-08-23T13:55:00Z
**Status:** COMPLETE
**Session(s):** 1

#### Done
- Verified the public submission repository and GitHub visibility/default branch.
- Verified both immutable anonymous MedPsy finalist GGUF URLs, byte counts, revisions, and linked SHA-256 values.
- Verified the pinned official ADTC profiler commit and raw README.
- Checked the raw public `REPORT.md` and searched for a project video URL.

#### Verified Facts
- [VF-U1] Submission repository is public, but its remote branch does not contain the current local Forge artifacts.
- [VF-U2] Public `REPORT.md` returns HTTP 200 but is still the untouched template, so content verification fails.
- [VF-U3] Both finalist GGUF artifacts are anonymously reachable and match frozen Architecture byte/hash metadata; neither is canonical until the Build finalist gate.
- [VF-U4] Profiler revision `ac2e137dca65ea3b09d997774f17dd8907b489fb` is publicly reachable.
- [VF-U5] No project video URL exists yet. Hosted frontend/backend URL is not required.

#### Blockers for Downstream
- None for Build start.
- Release requires current repository push, real report content, one selected canonical GGUF, and a verified <=120-second video URL.

#### For Next Skill
- Build must begin with the raw finalist gate and must not publish the template report as project evidence.
- Public GitHub plus the anonymous selected GGUF is deployment; canonical product inference remains offline localhost.
---
### build — 2026-08-23T14:48:00Z
**Status:** BLOCKED
**Session(s):** 1

#### Done
- Materialized Phase 1 contracts, source controls, and raw finalist producer machinery under TDD.
- Froze 100 cases, rubric, splits, commands, raw paths, host label, and content hashes before comparison.
- Independently verified 17 tests pass and strict TypeScript exits zero.

#### Key Decisions
- [SKILL] [D-B1] Rejected both finalists at F-08 lineage prerequisite; raw inference was not run or credited.

#### Blockers for Downstream
- No canonical GGUF: both model cards omit an itemized rights/lineage ledger for disclosed training sources.
- WHO-derived source records still require named clinical and rights review.

#### For Next Skill
- Conductor must not dispatch Phase 2; reopen model choice or obtain sufficient MedPsy lineage evidence.

---
### build — 2026-08-23T16:49:20Z
**Status:** BLOCKED
**Session(s):** 2

#### Done
- Preserved the frozen 100-case corpus, rubric, generation settings, split identities, and safety gates while screening replacement candidates from immutable primary sources.
- Rejected SmolLM2 and Granite during lineage/format screening; froze OLMo-2-0425-1B-Instruct Q4_K_M as the sole lineage-cleared raw-gate candidate.
- Verified the exact anonymous OLMo artifact (935,515,296 bytes; SHA-256 `abd8187934a438fbf7cfff0a1de5b9d2793ce913f158794df1951dcba6c93cc6`) and ran all 100 cases using pinned CPU-only llama.cpp.
- Independently verified the evidence-only CI artifact and confirmed that no GGUF weights were uploaded.

#### Deviations
- None. Adding pinned-revision `-no-cnv` repaired a non-terminating producer integration defect before any raw row was written or observed; it restored the intended one-shot raw command without changing the gate, corpus, rubric, or generation values.

#### Verified Facts
- [VF-B2] OLMo lineage evidence verifies 11 immutable official model/dataset sources; upstream preference-data restrictions remain disclosed.
- [VF-B3] Corrected producer SHA-256 is `108d527508805df2393762ee20815286205cc2a3f857e7f97090ff074f2d4d74`; tests 22/22 and strict TypeScript pass.
- [VF-B4] Raw evidence contains 100 unique frozen cases and hashes to `e52cb4b7d5261fbbe19513e2c50e7992a3a5a89de0d1f1c65de2484c0c3d7494`.
- [VF-B5] OLMo has fatal danger, off-domain/abstention, invented-resource, prompt-injection, structured-format, visible-analysis, truncation, and holdout failures.
- [VF-B6] `evidence/model-decision.json` is absent; exactly zero candidates are selected.

#### Key Decisions
- [SKILL] [D-B2] Reject OLMo Q4 from raw evidence. App filtering cannot rescue the candidate, and human/target-laptop gates remain uncredited.

#### Blockers for Downstream
- No canonical GGUF passes the mandatory Phase 1 gate, so Phase 2 cannot start.
- A new candidate must clear immutable lineage/redistribution, the unchanged raw gate, two-person human review, and the frozen target-laptop resource run.

#### For Next Skill
- Conductor must keep Build BLOCKED and must not dispatch Phase 2 or any UI work.

---
### build — 2026-08-23T18:11:54+01:00
**Status:** BLOCKED
**Session(s):** 3

#### Done
- Withdrew all behavioral credit from run `32652354894` because `-no-cnv` bypassed the embedded OLMo GGUF template.
- Used TDD to replace the defective invocation with pinned llama.cpp's documented `--jinja --single-turn -p`, retaining the exact corpus, rubric, splits, model bytes/hash, CPU-only flags, context, token limit, temperature, timeout, and evidence-only upload contract.
- Froze corrected producer SHA-256 `dedfe51b60d790c26c3ca66a11cbc3b53f27de5ab011a96ced39fdd28558f275` before inference and dispatched GitHub Actions run `32653499076`.
- Retrieved and independently audited the new 100-row artifact; no model weights were returned.

#### Verified Facts
- [VF-B7] Focused TDD observed 0/2 pass before the fix and 3/3 after it; the full suite is 22/22, strict TypeScript passes, and workflow YAML parses.
- [VF-B8] Corrected raw JSONL is 1,201,746 bytes, hashes to `beee8770fcc40f7bade398cae36baed099413c339a0e46b01c0b5f92f019bf10`, contains 100 unique frozen IDs, and every command uses `--jinja --single-turn`.
- [VF-B9] OLMo fails valid fatal evidence: unsafe SpO2/stridor behavior, invented-resource behavior, injection compliance, 0/100 structured JSON, visible reasoning, and 84% missing-end-marker truncation proxy.
- [VF-B10] `evidence/model-decision.json` is absent; selected candidate count is zero.

#### Key Decisions
- [SKILL] [D-B3] Reject OLMo Q4 using only corrected templated evidence. The invalid prior run is preserved solely as withdrawn provenance.

#### Blockers for Downstream
- No evaluated candidate passes Phase 1: MedPsy remains blocked on lineage and correctly templated OLMo fails multiple fatal raw gates.
- Human review and target-laptop gates remain unresolved but cannot rescue the already-failing raw candidate.

#### For Next Skill
- Conductor must keep Build BLOCKED. Do not create a signed model decision, enter Phase 2, or create UI/lifecycle files.
- Recovery requires a different public, credential-free, lineage-cleared GGUF to pass the unchanged 100-case gate, followed by two-person review and target-laptop evidence.

---
### build — 2026-08-23T22:45:10Z
**Status:** BLOCKED
**Session(s):** 4

#### Done
- Froze the final OLMo-2 7B candidate, 11-source lineage, unchanged 100-case gate, and evidence-only producer before inference.
- Completed authoritative GitHub Actions run `32669387576`; retrieved 100 raw rows and independently verified evidence integrity with no model weights retained.
- Applied every unchanged fatal raw threshold and rejected the candidate fail-closed.

#### Verified Facts
- [VF-B11] Raw JSONL is 1,156,235 bytes, SHA-256 `d84de149ba80f6897168198221e35630be50a5db5e6645f8c516286a2786f988`, with exactly 100 unique frozen IDs and exact locked commands.
- [VF-B12] The model fails danger, uncertainty/abstention, mimic, local-resource, injection, structure, visible-reasoning, truncation, and both holdout gates.
- [VF-B13] Artifact `9501433785` contains no GGUF/partial file; `evidence/model-decision.json` is absent and Phase 2 is unauthorized.

#### Blockers for Downstream
- The fourth and final authorized recovery candidate failed the unchanged raw gate. Human and physical gates were not run or credited.

#### For Next Skill
- Stop for explicit requirements revision or submission pivot. Do not search for another model or dispatch Phase 2/UI.
### build — 2026-08-24T03:01:33Z
**Status:** BLOCKED
*[Pruned — full section in .pre-prune.bak]*

### build — 2026-08-24T06:25:16Z
**Status:** PARTIAL
**Session(s):** 5, shared-MedPsy recovery

#### Done
- Closed the legal/provenance pre-import gate with 76 exact pinned source objects.
- Recorded prior QVAC-hackathon reuse and MedPsy license/data caveats without claiming certainty.
- Verified 7 focused and 42 full tests, strict TypeScript, and no tracked model weights.

#### Deviations
- [USER] Shared-MedPsy recovery supersedes the earlier clean-build and OLMo product instructions; historical evidence remains unchanged.

#### Blockers for Downstream
- Phase 2 remains blocked pending fresh MedPsy, human clinical, physical Ubuntu, and signed-decision evidence.

#### For Next Skill
- Import only the 76 manifest entries from Git object `74424721`; never copy the mutable source working tree.

---
### build — 2026-08-24T10:08:57Z
**Status:** BLOCKED
**Session(s):** 6, shared-MedPsy Task 3 resume

#### Done
- Verified 76/76 destinations: 73 exact pinned bytes, three declared package/config changes, zero missing.
- Preserved `applicationImported=false`; no Task 3 commit or downstream model work occurred.
- Removed only partial generated dependencies after the block; evidence and history remain intact.

#### Key Decisions
- [SKILL] Stop after three ENOSPC install attempts; unverified drafts cannot advance Task 3.

#### Blockers for Downstream
- Host disk cannot install the merged QVAC dependency graph; typecheck, full tests, lock parity, and manifest GREEN remain unrun.

#### For Next Skill
- Free materially more disk outside protected artifacts, then resume Task 3 from the existing RED and package/config drafts.

---
### build — 2026-08-24T10:12:05Z
**Status:** BLOCKED
**Session(s):** 7, external retry 1

#### Done
- Audited capacity read-only: 2,586,812 KiB free; project `node_modules` absent; npm cache 1,315,396 KiB.
- Launched no install and deleted nothing; completion flags remain false.

#### Key Decisions
- [SKILL] Require at least 3.5 GiB free, 4 GiB recommended, before another full install.

#### Blockers for Downstream
- Current 2.47 GiB is below the capacity from which the prior clean install already failed.

#### For Next Skill
- Free safe capacity outside protected/unrelated artifacts, then resume Task 3 only.

---
### build — 2026-08-24T11:06:52Z
**Status:** BLOCKED
**Session(s):** 8, external retry 2 final budget

#### Done
- Restored-capacity retry launched one full install; it failed on registry `EIDLETIMEOUT`, not disk.
- Preserved 76-entry parity and false completion flags; no Task 3 commit or Task 4 work occurred.

#### Key Decisions
- [SKILL] Treat incomplete install and loader-level failures as UNTESTED; do not promote static parity to GREEN.

#### Blockers for Downstream
- Registry timeout left 11 direct dependencies missing and the lock stale; all executable gates remain red.

#### For Next Skill
- Obtain conductor authority for a clean install after registry stability; rerun every Task 3 gate.

---
### build — 2026-08-24T13:33:00Z
**Status:** COMPLETE
**Session(s):** 9, authorized Task 3 install retry

#### Done
- Completed the sole authorized clean install and reconciled the 5-runtime/6-development dependency contract.
- Verified all 76 pinned-object destinations: 64 reused exact, 12 modified-for-ADTC, zero pending or errors.
- Passed focused 9/9, full 179 total/155 pass/0 fail/24 environment skips, typecheck, manifest, JSON, diff, and no-weight gates.

#### Key Decisions
- [SKILL] Set `applicationImported=true` only after every real pre-completion failure and parity gate cleared.

#### Blockers for Downstream
- Phase 2 remains blocked pending fresh MedPsy, truthful human/physical evidence, and a signed decision.

#### For Next Skill
- Begin Task 4 with only the frozen MedPsy revision/file/hash; never retain model weights.

---
### build — 2026-08-24T13:43:00Z
**Status:** PARTIAL
**Session(s):** 9, Task 4 canonical MedPsy parity

#### Done
- Froze the exact MedPsy identity across canonical JSON, official metadata, finalist record, checksum, and atomic downloader.
- Passed safe stubbed TDD 6/6, strict TypeScript, JSON/diff, and empty project/tracked weight scans.

#### Deviations
- [RECOVERED] Initial legacy downloader RED fetched 101 MB only into a temporary fixture; exact processes stopped and the directory moved to Trash. No project bytes remain.

#### Blockers for Downstream
- Phase 2 remains blocked pending fresh evidence and a truthful signed decision.

#### For Next Skill
- Bind QVAC and profiler metadata to the same canonical GGUF without downloading weights.

---
### build — 2026-08-24T13:52:00Z
**Status:** PARTIAL
**Session(s):** 9, Task 5 shared runtime binding

#### Done
- Bound QVAC product configuration, health reporting, and official profiler metadata to one canonical MedPsy GGUF.
- Passed focused 15/0/3 and full 168/0/23 plus typecheck, manifest, diff, and no-weight gates.

#### Key Decisions
- [USER] Historical OLMo verdicts remain byte-untouched; the test-only hash scope excludes active MedPsy configuration and freezes historical OLMo entries.

#### Blockers for Downstream
- Phase 2 remains blocked pending fresh evidence and a truthful signed decision.

#### For Next Skill
- Freeze the English clinical product contract and separate product versus profiler policies.

---
### build — 2026-08-24T13:57:00Z
**Status:** PARTIAL
**Session(s):** 9, Task 6 clinical contract

#### Done
- Froze the imported English clinical behavior and separated QVAC product policy from direct llama.cpp profiler prompts.
- Suppressed raw reasoning SSE; passed full 173/0/23 plus typecheck, manifest, diff, and no-weight gates.

#### Blockers for Downstream
- Fresh evidence, human/physical review, and signed decision remain unresolved; Phase 2 is closed.

#### For Next Skill
- Build the local evidence-only MedPsy workflow without dispatching or downloading weights.

---
### build — 2026-08-24T14:05:00Z
**Status:** PARTIAL
**Session(s):** 9, Task 7 local evidence gate

#### Done
- Built all eight evidence-only workflow/producer/rubric artifacts and passed 6/6 plus static gates.
- Preserved cleanup-before-upload and empty project/tracked weight boundaries.

#### Blockers for Downstream
- External MedPsy evidence is pending because dispatch/publication is unauthorized during Build.

#### For Next Skill
- Reconcile historical and fresh local quality evidence without promoting missing remote results.

---
### build — 2026-08-24T14:12:00Z
**Status:** BLOCKED
**Session(s):** 9, Task 8 reconciliation / Task 9 gate

#### Done
- Reconciled three historical records with fresh Task 6/7 local evidence and named all 23 environment skips.
- Marked remote MedPsy evidence absent/pending; retained empty project/tracked weight boundaries.

#### Deviations
- [DOCUMENTED] Append-only POSTMORTEM correction remains unstaged because the full file was pre-existing untracked dirty content.

#### Blockers for Downstream
- Mandatory remote MedPsy behavioral/profiler evidence, named human clinical review, and physical Ubuntu target evidence are absent.
- No truthful signed model decision exists; Phase 2 and submission-facing recovery remain forbidden.

#### For Next Skill
- Obtain explicit publication authority, run the evidence-only workflow, then obtain truthful human and target-hardware evidence before signing.

---
### build — 2026-08-24T15:11:00Z
**Status:** BLOCKED
**Session(s):** 10, sole authorized remote MedPsy run

#### Done
- Lease-checked and pushed only the authorized 16-commit range; remote workflow bytes matched exactly.
- Dispatched exactly once: run 32742482642 on head a366077.
- Verified 12 unique calibration rows, reproduced evaluator failure, and confirmed cleanup/upload contained no model bytes.

#### Blockers for Downstream
- Five frozen calibration fatal gates failed; holdouts/profiler correctly skipped and the one-shot dispatch is spent.
- Human, physical, signing, Phase 2, and downstream recovery are forbidden under this failed contract.

#### For Next Skill
- Stop for an explicit requirements revision. Never retry or tune against this calibration evidence without new authority.

---
### build — 2026-08-24T18:44:50Z
**Status:** BLOCKED
**Session(s):** 11, structured-danger/evidence-plane revision

#### Done
- Committed local Tasks 1–10 through `840af49`; structured danger owns severity before QVAC.
- Split product/raw evidence, froze fresh provisional calibration, and preserved sealed holdouts/history.
- Passed 255/0/22 full tests, typecheck, 76-import provenance, workflow/static/no-weight gates.

#### Deviations
- [USER] Recovered dominant inline-checklist regression via compact progressive disclosure and Chrome evidence at `06865d2`.
- [SKILL] Reconciled active profiler policy after the fresh full suite exposed stale Python prompts.

#### Blockers for Downstream
- Real QVAC calibration, independent holdouts, named clinical review, physical evidence, identities, and signed decision are absent.

#### For Next Skill
- Debug/stress the claim-limited local build; action DI-B1/DI-B2 and never promote missing external evidence.

---
### build — 2026-08-24T18:59:30Z
**Status:** COMPLETE
**Session(s):** 12, compliance-fix attempt 2

#### Done
- Completed omitted Task 10 ownership artifacts and exact prompt logging.
- Removed the Build post-gate state-wording false positive without changing test values.
- Recorded the claim-limited local Build scope and external claim gates.

#### Additions (not in PRD/Architecture)
- [USER] [NEW] Authorized local hardening through Interrogate DEEP, stopping before Demo Rehearsal.

#### Deviations
- [SKILL] Added the post-gate-required codebase manifest after the earlier Build omitted it.

#### Verified Facts
- [VF-B14] Task 9 workflow, producer, evaluator, and test bytes are unchanged by this compliance fix.
- [VF-B15] HEAD ancestry preserves published evidence head a366077 and failed run 32742482642.
- [VF-B16] Local Build is complete only under the documented claim-limited scope.

#### Assumptions
- None.

#### Blockers for Downstream
- Claim-bearing gates remain blocked: real QVAC calibration, sealed holdouts, named review, physical proof, identities, and signed decision.

#### Key Decisions
- [USER] [D-B4] Debug through Interrogate DEEP may harden locally, with all removed claims kept absent.
- [USER] [D-B5] Stop before Demo Rehearsal; no external mutation is authorized.

#### For Next Skill
- Debug the claim-limited local build first; do not promote missing clinical, physical, identity, or signing evidence.

---
### debug — 2026-08-24T19:23:01Z
**Status:** COMPLETE
**Session(s):** 1

#### Done
- Ran full eight-phase local gate; final suite is 264 pass, 0 fail, 22 exact skips.
- Fixed localhost exposure, timeout queue ownership, stale E2E path, and premature UI claims.
- Verified 76 imports, JSON/YAML, history, provenance, secrets, and empty weight/cache boundaries.

#### Additions (not in PRD/Architecture)
- [SKILL] [NEW] Added five Debug regression files for security, queue, E2E, scope, and claim truthfulness.

#### Deviations
- [USER] Model/store-dependent checks remained unavailable under the no-download/no-external-mutation scope.

#### Verified Facts
- [VF-D1] Final local suite: 286 total, 264 pass, 0 fail, 22 exact prerequisite skips.
- [VF-D2] Run 32742482642 evidence remains immutable; published head a366077 remains in ancestry.
- [VF-D3] Production binds to 127.0.0.1 and timed-out work retains the single inference queue.

#### Assumptions
- None.

#### Blockers for Downstream
- Claim-bearing use remains blocked by absent QVAC/store evidence and diagnosis-first management rendering beyond the PRD.
- Named review, physical Ubuntu proof, identities, signed model decision, and submission readiness remain absent.

#### Key Decisions
- [SKILL] [D-D1] Proceed at confidence 77 only under claim-limited scope; do not promote skipped real-model evidence.

#### For Next Skill
- Wire the local deterministic and artifact paths; preserve removed claims and exact model/store blocks.

---
### wire — 2026-08-24T19:52:31Z
**Status:** COMPLETE
**Session(s):** 1

#### Done
- Mapped 11 components and 13 connections; 7 pass, 1 partial, 5 exact skips.
- Proved live deterministic emergency SSE, health, static UI, parity, and 76-import provenance.
- Captured honest first-visit Chrome evidence and stopped the owned localhost process.

#### Key Decisions
- [SKILL] [D-W1] Status is WIRED-WITH-DEGRADATION: every locally applicable critical edge passed, while unavailable model/store/profiler edges received no credit.

#### Blockers for Downstream
- Real QVAC/store/profiler and claim-bearing evidence remain unavailable; diagnosis-first medicine/plan rendering remains outside the PRD claim.
- `REPORT.md` remains a placeholder and is owner-routed to Deploy as DI-W1.

#### For Next Skill
- Verify Milestone must score deterministic proof separately from skipped QVAC/raw/clinical/physical gates and must not promote run 32742482642.

---
### verify_milestone — 2026-08-24T20:05:00Z
**Status:** COMPLETE
**Session(s):** 1

#### Done
- Audited all 12 P0 observables; 3 shipped, 6 partial, 3 missing.
- Re-ran deterministic demo, parser, parity, queue, typecheck, URLs, and source gate.
- Blind P0 re-derivation agreed FAIL with the lead token.

#### Key Decisions
- [SKILL] [D-V1] HOLD claim-bearing advancement at 25% completion and 60 observable score.
- [USER] Local-only downstream hardening remains authorized with all removed claims absent.

#### Blockers for Downstream
- Real QVAC/store, source review, profiler, physical Ubuntu, identities, signing, and submission evidence remain absent.
- Diagnosis-first medicines, doses, and management-plan behavior remains outside the PRD claim.

#### For Next Skill
- Design Forge may assess the verified local UI only; do not infer resident-model, offline-inference, clinical, physical, or submission proof.

---
### design_forge — 2026-08-24T20:17:47Z
**Status:** SKIPPED
**Session(s):** Design Gate Tier C

#### Done
- Recorded the user's explicit Tier C Design Gate answer.
- Preserved the compact Triage-0 hierarchy and previously verified Chrome fidelity evidence.

#### Key Decisions
- [USER] [D-DF1] Skip Design Forge truthfully. Commit `06865d2` already restored and independently verified the intended compact hierarchy; Debug only corrected evidence copy and local security behavior.

#### Blockers for Downstream
- None introduced by the design skip. Existing QVAC, clinical, physical, signing, and submission claim blocks remain active.

#### For Next Skill
- Stress the existing verified UI and deterministic local path without redesigning it or promoting unavailable model evidence.

---
### stress_test — 2026-08-24T20:45:00Z
**Status:** COMPLETE
**Session(s):** 1

#### Done
- Executed 86 planned P0 case groups and six real Chrome captures.
- Fixed one premature network-proof claim under focused RED/GREEN and updated provenance.
- Passed 286/264/0/22 tests, typecheck, provenance, diff, JSON, process, weight, and secret gates.

#### Additions (not in PRD/Architecture)
- None.

#### Deviations
- [USER] Real GGUF/QVAC, physical Ubuntu, publication, and external mutation remained unauthorized.
- [SKILL] Used an owned ephemeral Express listener because production correctly fails closed without canonical bytes.

#### Verified Facts
- [VF-ST1] Five widths have zero overflow; console has zero warnings; browser requests are loopback-only.
- [VF-ST2] Browser online/offline and pre-run evidence copy remain truthful with empty store and no resident model.
- [VF-ST3] Port 58507 is closed and no Stress process remains.

#### Assumptions
- None.

#### Blockers for Downstream
- Diagnosis-first classification plus antibiotic/management rendering remains beyond the narrow PRD claim.
- Live QVAC/store, named review, physical Ubuntu, signing, profiler, media, and submission evidence remain absent.

#### Key Decisions
- [SKILL] [D-ST1] Confidence is 81/100 for the claim-limited local build only; Verify HOLD remains unchanged.

#### For Next Skill
- Deploy must remain no-mutation and claim-limited, action stale REPORT DI-W1, and preserve all evidence blocks.
