# Shared-MedPsy document and blocker review

**Date:** 2026-08-24
**Decision reviewed:** Retain healthcare, reuse the Triage-0 application transparently, and use MedPsy-1.7B Q4_K_M as the single GGUF shared by the product and official profiler.
**Review verdict:** Conditional GO to conductor recovery and legal/provenance phase. NO-GO for direct Build, Phase 2, downstream skills, or submission claims until the gates below pass.

## 1. Review scope

The review covered the complete controlling handoff and active pipeline documents, plus a repository-wide inventory and contradiction scan.

- 158 documentation, state, configuration, and evidence-contract artifacts inventoried.
- 24 active or historical artifacts mention the Triage-01 clean-build identity.
- 15 artifacts contain the former prohibition on importing Triage-0 without organizer approval.
- 7 active artifacts still describe leaving healthcare or a submission pivot.
- 17 artifacts state that no signed model decision exists.
- 7 artifacts record MedPsy as rejected.
- 71 artifacts mention OLMo, predominantly immutable historical evidence.

The audit read the controlling handoff, active ADTC brief, `PULSE.md`, `FORGE-INTAKE.md`, pipeline overrides, conductor beacon and state, Build state, Build report, Postmortem, approved recovery design, root PRD, architecture, plan, observables, critique, pre-Build review, domain guide, provenance decision, model configuration, runtime configuration, submission templates, and Triage-0 baseline manifest.

## 2. Root-cause conclusion

The healthcare migration did not fail because Triage-0 or MedPsy failed.

MedPsy was rejected before raw behavioral inference because the Build converted Critique finding F-08 into an itemized training-lineage prerequisite. That prerequisite was a conservative internal gate, not an express published ADTC requirement. OLMo was then substituted and failed the recorded behavioral gates, including the corrected chat-template run and the constrained product-contract calibration.

The failed OLMo evidence is valid for OLMo and must remain. It does not prove that the already-working Triage-0 MedPsy product fails.

The second root cause was architectural drift. Forge replaced Triage-0's tested QVAC, retrieval, two-pass prompting, schema, retry, and deterministic safety system with a new one-pass direct-llama clean build. The migration therefore discarded the product behavior that had made the original model usable.

## 3. Corrected authority chain

Use this order when documents conflict:

1. Current explicit user decision to retain healthcare and select approach 1.
2. `docs/plans/2026-08-24-healthcare-retention-shared-medpsy-design.md`.
3. This review and the approved implementation plan.
4. Current official ADTC rules, participation agreement, template, profiler contract, and active brief.
5. Existing Forge documents for requirements that do not conflict with the recovery design.
6. Historical Build reports and evidence as immutable records, not current product instructions.

## 4. Artifact disposition

| Artifact group | Disposition | Reason |
|---|---|---|
| Approved shared-MedPsy design | Controlling | Records the user's current product, model, reuse, and runtime decision. |
| New implementation plan | Controlling after approval | Defines exact conductor-safe work and evidence gates. |
| `FORGE-INTAKE.md`, `PRD.md`, `ARCHITECTURE.md`, `PLAN.md` | Superseded where conflicting | They require a new Triage-01 clean build and direct llama.cpp product runtime. |
| `DOMAIN-GUIDE.md`, `FEATURE-OBSERVABLES.md`, `PRE-BUILD-READINESS.md` | Superseded and reusable by mapping | Their narrow respiratory scope and observables contain useful safety requirements, but they do not describe the reused full Triage-0 system. |
| `research/ADTC-PIPELINE-SKILL-OVERRIDES.md` | Amend during conductor recovery | It still bans Triage-0 imports and makes direct llama.cpp load-bearing in the app. |
| `.conductor-state.json`, `.conductor-resume.md`, `.build-state.json` | Conductor-owned stale active state | They correctly record the OLMo stop but do not yet record the approved MedPsy recovery. Update atomically through conductor only. |
| `PULSE.md` | Append only | Preserve earlier phase entries and append the recovery decision and handoff. |
| `BUILD-REPORT.md`, `POSTMORTEM.md`, `CRITIQUE-REPORT.md`, `URL-PREVERIFICATION.md` | Immutable historical truth | They accurately record prior decisions, failures, and missing release evidence. |
| Existing `evidence/` directories | Immutable | Never relabel OLMo or old Phase 1 output as MedPsy evidence. |
| `README.md`, `REPORT.md`, `metadata.json` | Replace before release | They are still official-template placeholders and do not describe the project. |
| `PROVENANCE.json` | Replace before import | It is an empty pending placeholder and cannot prove reuse. |
| `SUBMISSION-CHECKLIST.md`, `FOR[Dami].md` | Update after fresh evidence | They need the shared-MedPsy decision, prior-work disclosure, and platform limitations. |

## 5. Blocker ledger

### A. Must close before implementation dispatch

| ID | Severity | Blocker | Current evidence | Required closure | Owner |
|---|---|---|---|---|---|
| A-01 | Critical | Conductor and Build state still lock OLMo and the failed product-contract cycle. | State says Build blocked, OLMo-only, no model search, and Phase 2 forbidden. | Conductor atomically records the user-authorized healthcare recovery, refreshes beacon and ownership checksum, and runs resume/FSM/pre gates. | Conductor |
| A-02 | Critical | Old Forge artifacts still claim a clean Triage-01 implementation is controlling. | Root PRD, architecture, plan, intake, and overrides conflict with approach 1. | Approved design and implementation plan explicitly supersede conflicts; legal phase writes the minimal addenda before Build. | Legal/docs phase |
| A-03 | Critical | No file-level reuse provenance exists. | `PROVENANCE.json` is empty; source baseline has not been imported. | Freeze commit `74424721...`, enumerate every imported file and SHA-256, preserve Apache-2.0 notices, and label ADTC modifications. | Legal/provenance phase |
| A-04 | Critical | MedPsy was rejected by the obsolete lineage kill gate. | Build report records a pre-inference rejection, not a behavioral failure. | Replace fatal itemized-lineage prerequisite with a truthful documented license, model-card caveat, redistribution, attribution, and competition-risk decision. | Legal/model gate |
| A-05 | Critical | There is no signed canonical MedPsy model decision. | `evidence/model-decision.json` is absent by design. | Run fresh MedPsy contract and profiler evidence, complete required human and physical gates, then sign only if all applicable thresholds pass. | Build plus humans |
| A-06 | Major | The import baseline could drift. | Triage-0 working tree contains later work, while the approved baseline is public commit `74424721...`. | Import only from an isolated archive or worktree of the exact commit and verify a generated source manifest. | Build |
| A-07 | Major | The old implementation plan would rebuild the wrong product. | Root `PLAN.md` maps 53 clean-build files and one-pass behavior. | Use only the new shared-MedPsy implementation plan through conductor. | Conductor/Build |

### B. Must close before a truthful model decision or Phase 2

| ID | Severity | Blocker | Required closure |
|---|---|---|---|
| B-01 | Critical | Same-GGUF parity is not implemented. | `metadata.json`, downloader, QVAC configuration, app health, and profiler must resolve the identical relative path and SHA-256. |
| B-02 | Critical | Fresh MedPsy behavioral evidence is absent in this repository. | Preserve the prior 29/29 Triage-0 quality result as historical evidence, then rerun the frozen baseline tests and the ADTC evidence contract without tuning on holdouts. |
| B-03 | Critical | Human clinical review has not occurred. | Record named reviewers, rubric, conflicts, and signed outcome. Do not substitute agent review. |
| B-04 | Critical | Physical target-laptop proof has not occurred. | Run the final model and full product on target-class Ubuntu hardware with TPS, RSS, thermal, throttle, and offline evidence. CI remains comparative only. |
| B-05 | Major | Triage-0 app platform support is not proven on Ubuntu x86. | Prove QVAC 0.13.3 and app startup on Ubuntu x86 or disclose the product demo platform and limit portability claims. The official profiler remains direct x86 llama.cpp. |
| B-06 | Major | Current `config/generation-policy.json` describes the abandoned one-pass contract. | Separate the official raw profiler prompt contract from the reused Triage-0 two-pass product contract and test that metadata claims do not imply identical orchestration. |
| B-07 | Major | Source rights and clinical adaptation review remain incomplete. | Preserve source provenance, name the clinical and rights reviewers, narrow claims, and fail closed for unreviewed source material. |
| B-08 | Major | Existing test totals are not directly comparable. | Explain 29/29 quality fixtures, the Triage-0 README's 97/97 snapshot, and the later fresh-clone 119 pass, 1 fail, 28 skip result by commit and environment; rerun the imported baseline. |

### C. Release and external-action blockers

| ID | Gate | Status |
|---|---|---|
| C-01 | Real team ID and submitter fields | Missing; user/external input required. |
| C-02 | Public repository updated with reviewed work | Local work is ahead/dirty; publication requires its normal explicit gate. |
| C-03 | Final video at or below 120 seconds | Missing; recording and publication remain gated. |
| C-04 | Devpost form saved and submitted | Not performed; external submission requires explicit checkpoint. |
| C-05 | Spending or paid infrastructure | Not authorized and not required for the first recovery run. |

The repository also contains a local ignored `.release-private-key.pem`. It is not tracked by Git and no GGUF or partial model file is tracked. Keep that boundary verified before every publication action.

## 6. What is already solved

- The domain decision is settled: remain in healthcare.
- The project identity is settled provisionally: Triage-0 ADTC, subject only to submission-field polish.
- The source baseline is frozen: public commit `74424721bc75f564808eacce42d7f7f42676ae0f`.
- The candidate is frozen: MedPsy-1.7B Q4_K_M imatrix. No model search is authorized.
- Exact public artifact identity is already pinned: revision `fd4cecc90c2de8dce4b112795456a54be9c59363`, 1,282,439,360 bytes, SHA-256 `41ee947d9cce72ec657577219fd1798fabeabf0d832217fe23c9d6d3d18d5880`.
- Direct llama.cpp remains deeply integrated through official profiling, model identity, downloader, checksum, resource evidence, and raw prompt evaluation.
- The application may keep QVAC for product inference only when it uses the same GGUF and the runtime distinction is disclosed.
- OLMo is removed from the active product path without deleting its evidence.
- Creative writing is not an active design or implementation path.

## 7. Claims policy

The submission may claim only what the evidence proves.

- Say “offline clinical decision-support prototype for supervised community health workers,” not autonomous diagnosis.
- Say the official scored path uses direct llama.cpp and the product path uses local QVAC over the same GGUF.
- Claim English support. Do not claim unproven African-language clinical support.
- Label Apple, GitHub Actions x86, and physical-laptop results separately.
- Disclose that the application baseline originated in the earlier QVAC hackathon and identify the exact imported files.
- Disclose MedPsy model-card and source-data caveats. Do not convert a publisher license declaration into a guarantee about every upstream datum.
- Do not claim eligibility certainty. State the facts and the risk posture truthfully.

## 8. Gate decision

The documentation is coherent enough to write the implementation plan, but not to start Build directly.

The next authorized operation after user approval is conductor recovery, which closes A-01. The conductor must dispatch a legal/provenance phase next. That phase must close A-02 through A-04 and freeze the import manifest before any application file is imported. Build may then execute the shared-MedPsy plan, but Phase 2 and later skills remain blocked until a truthful signed model decision exists.
