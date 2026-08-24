# Shared-MedPsy healthcare Build handoff

**Saved:** 2026-08-24
**Working directory:** `/Users/MAC/adtc-2026`
**Next session objective:** Resume through `hackathon-conductor`, reconcile the approved healthcare recovery atomically, dispatch the legal/provenance phase, and execute the shared-MedPsy implementation plan only as conductor-authorized gates permit.

## User decision

The user rejected the creative-writing pivot and explicitly selected approach 1:

- retain healthcare;
- reuse the existing Triage-0 application transparently;
- freeze public Triage-0 baseline commit `74424721bc75f564808eacce42d7f7f42676ae0f`;
- use the exact Triage-0 MedPsy-1.7B Q4_K_M GGUF as the single canonical artifact;
- run the product through its existing local QVAC runtime;
- run the official ADTC profiler and fresh raw evidence through direct `llama.cpp` over the same bytes;
- preserve all failed clinical and OLMo evidence;
- do not search for another model;
- retain no GGUF weights in Git or evidence artifacts.

The working project name is `Triage-0 ADTC`.

## Controlling documents

Read these completely before taking action:

1. `docs/context/conversation_2026-08-24_shared-medpsy-build-handoff.md`
2. active ADTC brief
3. `PULSE.md`
4. `docs/plans/2026-08-24-healthcare-retention-shared-medpsy-design.md`
5. `docs/reviews/2026-08-24-shared-medpsy-document-and-blocker-review.md`
6. `docs/plans/2026-08-24-shared-medpsy-healthcare-retention-implementation.md`
7. `FORGE-INTAKE.md`
8. `research/ADTC-PIPELINE-SKILL-OVERRIDES.md`
9. `.conductor-resume.md`
10. `.conductor-state.json`
11. `.build-state.json`
12. `BUILD-REPORT.md`
13. `POSTMORTEM.md`

## Authority and document disposition

The approved shared-MedPsy design supersedes conflicting clean-build, Triage-01, OLMo-only, direct-llama-product, and no-Triage-0-import assumptions in the old Forge documents.

Preserve these as immutable historical evidence:

- `BUILD-REPORT.md` prior sections;
- `POSTMORTEM.md` prior entries;
- all prior `PULSE.md` entries;
- all existing `evidence/` artifacts;
- all OLMo failure verdicts;
- the original pre-inference MedPsy lineage rejection record.

Do not rewrite history. Use append-only correction/recovery entries and a new namespace such as `evidence/medpsy-shared-runtime-v1/`.

## Root cause already established

MedPsy was not behaviorally rejected. Build stopped it before inference because Critique finding F-08 was promoted into a self-imposed fatal requirement for an itemized training-lineage ledger. That is not an express published ADTC rule.

The later OLMo failures are valid for OLMo. They do not prove MedPsy fails. The attempted migration also discarded Triage-0's proven QVAC, local RAG, two-pass prompting, GBNF-constrained output, schema validation, bounded retry, deterministic reconciliation, deterministic safety, and citation system in favor of a new one-pass contract. The recovery restores the working system rather than redesigning it again.

## Exact canonical model

- Candidate ID: `medpsy-1.7b-q4`
- Repository: `qvac/MedPsy-1.7B-GGUF`
- Revision: `fd4cecc90c2de8dce4b112795456a54be9c59363`
- File: `medpsy-1.7b-q4_k_m-imat.gguf`
- Canonical path: `model/medpsy-1.7b-q4_k_m-imat.gguf`
- Bytes: `1282439360`
- SHA-256: `41ee947d9cce72ec657577219fd1798fabeabf0d832217fe23c9d6d3d18d5880`
- Quantization: Q4_K_M imatrix
- Declared weight license: Apache-2.0
- Validated claim language: English only

The model decision must disclose model-card research/education wording, upstream data caveats, provenance uncertainty, and supervised early-PoC limitations. Do not convert incomplete itemized training lineage into an unpublished fatal ADTC rule.

## Current blocker status

The documentation and strategy blockers are resolved and committed. Operational, evidence, human, physical, and publication gates remain open by design.

### Before implementation dispatch

1. Conductor state still records the failed OLMo cycle and must be reconciled atomically.
2. The pipeline override and active state must record that the shared-MedPsy design supersedes conflicting clean-build assumptions.
3. A file-level Triage-0 reuse provenance ledger must be frozen before importing any file.
4. The model license/provenance decision must replace the obsolete fatal lineage gate.
5. The exact import must come from Git object `74424721...`, not the mutable Triage-0 working tree.

### Before a signed model decision or Phase 2

1. Implement identical model path and SHA parity across metadata, downloader, QVAC product, app health, and profiler.
2. Import and rerun the Triage-0 baseline tests, explaining historical 29/29, 97/97, and later 119 pass, 1 fail, 28 skip snapshots by commit/environment.
3. Run fresh remote evidence-only MedPsy evaluation through direct llama.cpp.
4. Retain no model or partial weights.
5. Obtain named human clinical review.
6. Obtain physical target-class Ubuntu hardware evidence for final TPS, RSS, thermal, throttle, offline, and full-product claims.
7. Prove QVAC app support on Ubuntu x86 or narrow the product-platform claim truthfully.
8. Complete source rights and clinical adaptation review.
9. Sign `evidence/model-decision.json` only if every applicable gate passes.

### External release gates

- real team ID and submitter fields;
- public repository publication;
- final video at or below 120 seconds;
- Devpost save and submission;
- any spending or paid infrastructure.

These remain explicit checkpoints. Standing approval for reversible defaults does not waive them.

## Conductor constraints

- Use `hackathon-conductor` first.
- Do not invoke Hackathon Build directly.
- Read the active ADTC brief before any pipeline skill.
- Resume mode only; do not restart Intel, Warroom, Forge, Critique, or URL Preverification.
- Atomically record the healthcare recovery.
- Refresh the beacon and ownership checksum.
- Run resume, FSM, PULSE, active-brief, ownership, and pre-dispatch gates.
- Dispatch the legal/provenance phase first.
- Do not import application files before the provenance gate passes.
- Do not enter Phase 2 or later phases without a truthful signed model decision.
- No model search is authorized.
- Stop honestly if MedPsy fails the approved gates.

## Repository condition

The worktree contains many historical pipeline modifications and untracked artifacts. Preserve them. Do not reset, clean, overwrite, or broadly stage directories. Stage only exact task files after reviewing `git diff` and `git status`.

A local `.release-private-key.pem` exists but is ignored and was verified absent from Git history. No GGUF or partial weight is tracked. Reverify before publication.

## Completed documentation commits

- `c2adbb8` `docs: approve shared MedPsy healthcare retention design`
- `da7e4a3` `docs: audit shared MedPsy recovery blockers`

## Fresh verification before handoff

- `npm test`: 35 passed, 0 failed
- `npm run typecheck`: passed
- all repository JSON parsed with `jq`
- all workflow YAML parsed successfully
- `git diff --check`: passed
- plan invariants and controlling references: passed
- tracked private key/GGUF/partial files: none

These tests verify the current Phase 1 machinery and documents. They do not constitute fresh MedPsy product evidence or a signed model decision.

## Required first action in the new session

After reading the required documents and relevant skill instructions, inspect the current Git and conductor state read-only. Then present a short recovered-state summary and start the conductor-owned recovery transaction. Do not ask the user to repeat already approved design choices.

Proceed autonomously through reversible in-scope work, but stop at human review, physical hardware coordination, external publication, spending, destructive actions, or Devpost submission gates.
