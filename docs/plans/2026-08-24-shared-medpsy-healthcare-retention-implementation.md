# Shared-MedPsy healthcare retention implementation plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Execution must be dispatched through `hackathon-conductor`; do not invoke Hackathon Build directly.

**Goal:** Recover the existing Triage-0 healthcare product inside the official ADTC template, transparently preserve its provenance, and make one pinned MedPsy GGUF load-bearing across the QVAC product and direct llama.cpp profiler paths.

**Architecture:** The official template remains the repository root. The Triage-0 application is imported from exact public commit `74424721bc75f564808eacce42d7f7f42676ae0f` with a file-level provenance ledger. `metadata.json` and one model manifest own the canonical MedPsy path and SHA-256. QVAC runs the product workflow; direct llama.cpp runs the official profiler and raw evidence. Historical OLMo evidence remains immutable in a separate namespace.

**Tech stack:** Node.js 22.17+, TypeScript, Express, QVAC SDK 0.13.3, Zod, local RAG, Shell, JSON Schema, GGUF, direct llama.cpp, official ADTC profiler, GitHub Actions evidence-only jobs.

**Execution boundary:** No code task begins until the user approves this plan and the conductor passes recovery, FSM, ownership, and legal pre-gates. Human review, physical hardware, publication, Devpost submission, spending, and destructive actions remain explicit checkpoints.

**Model boundary:** No model search is authorized. MedPsy-1.7B Q4_K_M is the only recovery candidate; a truthful failure stops the pipeline for a new explicit user decision.

---

## Task 1: Conductor-owned recovery transaction

**Files:**
- Modify: `.conductor-state.json` through conductor state handling only
- Modify: `.conductor-resume.md` through conductor beacon writer only
- Modify: `.build-state.json` through conductor phase handling only
- Modify: `PULSE.md` by append-only protocol
- Modify: `pipeline-log.md` by append-only protocol
- Modify: `research/ADTC-PIPELINE-SKILL-OVERRIDES.md`
- Reference: `docs/plans/2026-08-24-healthcare-retention-shared-medpsy-design.md`
- Reference: `docs/reviews/2026-08-24-shared-medpsy-document-and-blocker-review.md`

**Step 1: Acquire conductor ownership safely**

Run the conductor resume entry point in resume mode. Resolve any live lock read-only first. Archive only a provably stale lock using the conductor's normal recovery behavior.

Expected: one active ownership record for `build`; no direct manual state edit.

**Step 2: Record one atomic recovery event**

Record:

- healthcare retained;
- creative-writing pivot superseded before implementation;
- project identity `Triage-0 ADTC`;
- exact MedPsy candidate and Triage-0 source commit;
- prior OLMo and MedPsy evidence preserved;
- no new model search;
- legal/provenance phase required before import;
- Phase 2 requires a truthful signed model decision.

Expected: state, beacon, Build state, and log agree on the same recovery ID and timestamp.

**Step 3: Refresh integrity records**

Run conductor ownership checksum, resume gate, FSM gate, PULSE pre-gate, active-brief gate, and pre-dispatch gate.

Expected: legal/provenance phase is the only legal next dispatch. Build implementation remains unopened.

**Step 4: Commit**

Commit only the conductor-produced recovery files:

```bash
git add .conductor-state.json .conductor-resume.md .build-state.json PULSE.md pipeline-log.md research/ADTC-PIPELINE-SKILL-OVERRIDES.md
git commit -m "conductor: authorize shared MedPsy healthcare recovery"
```

## Task 2: Freeze legal and provenance contracts before import

**Files:**
- Create: `PROVENANCE.md`
- Replace: `PROVENANCE.json`
- Create: `config/import-manifest.schema.json`
- Create: `config/import-manifest.json`
- Create: `config/model-license-decision.json`
- Create: `scripts/build-import-manifest.ts`
- Create: `scripts/verify-import-manifest.ts`
- Create: `tests/import-provenance.test.ts`
- Modify: `package.json`

**Step 1: Write failing provenance tests**

Test that the manifest:

- pins source repository and commit `74424721...`;
- lists every imported file;
- stores source blob SHA-256 and destination path;
- classifies `reused`, `modified-for-adtc`, `adtc-new`, or `third-party`;
- preserves Apache-2.0 notice and prior QVAC-hackathon disclosure;
- rejects files not present at the pinned source commit;
- rejects an empty or placeholder provenance record.

Run:

```bash
node --import tsx --test tests/import-provenance.test.ts
```

Expected: FAIL because the schema, manifest, and verifier do not exist.

**Step 2: Implement the minimal manifest builder and verifier**

Use `git ls-tree` and `git show` against the exact Triage-0 commit. Never read source bytes from its mutable working tree for the import.

**Step 3: Record the model license decision**

The decision must separate:

- declared GGUF license;
- public anonymous artifact access;
- redistribution and attribution basis;
- model-card research/educational wording;
- disclosed upstream data caveats;
- uncertainty about exhaustive training-data provenance;
- supervised early-PoC claim boundary;
- the user's direction to proceed with fully disclosed reuse despite the documented ambiguity.

It must not call incomplete itemized lineage an automatic ADTC failure.

**Step 4: Verify**

```bash
npm test -- tests/import-provenance.test.ts
npm run typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add PROVENANCE.md PROVENANCE.json config/import-manifest.schema.json config/import-manifest.json config/model-license-decision.json scripts/build-import-manifest.ts scripts/verify-import-manifest.ts tests/import-provenance.test.ts package.json
git commit -m "feat: freeze Triage-0 import provenance"
```

## Task 3: Import the exact Triage-0 application baseline

**Files:**
- Import from baseline: `src/**`
- Import from baseline: `public/**`
- Import from baseline: `data/**`
- Import from baseline: `scripts/patch-sdk-zod.mjs`
- Import from baseline: `scripts/ingest-protocols.ts`
- Import from baseline: required runtime and test scripts only
- Import from baseline: `tests/unit/**`
- Import from baseline: `tests/integration/**`
- Import from baseline: `tests/quality/**`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tsconfig.json`
- Modify: `config/import-manifest.json`

**Step 1: Add a failing import-parity test**

Extend `tests/import-provenance.test.ts` to prove each reused destination initially byte-matches the pinned source blob and each modified destination has a recorded patch classification.

Expected: FAIL before files are imported.

**Step 2: Import from the exact Git object**

Use a temporary archive of commit `74424721...`. Do not copy `.git`, prior submission logs, screenshots, cloud worktrees, remote deployment manifests, secrets, or model weights.

Exclude initially:

- speech-to-text;
- text-to-speech;
- translation;
- old screenshots and demo artifacts;
- hybrid-cloud files;
- mutable perf logs;
- optional stress scripts not needed for Gate 1.

**Step 3: Merge package contracts minimally**

Preserve ADTC evidence scripts and dependencies while adding the exact Triage-0 runtime dependencies. Keep Node `>=22.17` and one lockfile.

**Step 4: Run the imported baseline**

```bash
npm install
npm run typecheck
npm test
```

Expected: imported baseline tests pass or every environment-dependent skip/failure is recorded by exact test name. No total from another commit is reused as current evidence.

**Step 5: Commit**

Stage only the exact destination paths listed by the verified import manifest, plus `package.json`, `package-lock.json`, `tsconfig.json`, and `config/import-manifest.json`. Do not use a broad directory add in the dirty worktree.

```bash
npm run verify-import-manifest
git status --short
git commit -m "feat: import disclosed Triage-0 baseline"
```

## Task 4: Make MedPsy the single canonical artifact

**Files:**
- Modify: `metadata.json`
- Modify: `config/model-finalists.json`
- Create: `config/canonical-model.json`
- Create: `config/canonical-model.schema.json`
- Modify: `download_model.sh`
- Create: `evidence/medpsy-shared-runtime-v1/model.sha256`
- Create: `tests/canonical-model.test.ts`
- Create: `tests/downloader.test.ts`

**Step 1: Write failing canonical-model tests**

Assert one identity everywhere:

- candidate `medpsy-1.7b-q4`;
- revision `fd4cecc90c2de8dce4b112795456a54be9c59363`;
- file `medpsy-1.7b-q4_k_m-imat.gguf`;
- canonical path `model/medpsy-1.7b-q4_k_m-imat.gguf`;
- bytes `1282439360`;
- SHA-256 `41ee947d9cce72ec657577219fd1798fabeabf0d832217fe23c9d6d3d18d5880`;
- public credential-free URL;
- English language scope;
- official runtime `llama.cpp`;
- product runtime `QVAC SDK 0.13.3` over the same file.

Run:

```bash
node --import tsx --test tests/canonical-model.test.ts tests/downloader.test.ts
```

Expected: FAIL on template metadata and downloader.

**Step 2: Implement one source of truth**

Make `config/canonical-model.json` the extended model identity and make `metadata.json` carry the official schema subset. The downloader reads or verifies the same identity, downloads to a partial file, checks bytes/hash, then atomically renames.

**Step 3: Prove no weight retention**

Keep `model/*.gguf` and partial files ignored. Tests use fixtures or metadata only. GitHub Actions removes model bytes before artifact upload.

**Step 4: Verify**

```bash
npm test -- tests/canonical-model.test.ts tests/downloader.test.ts
npm run typecheck
git ls-files 'model/*.gguf' 'model/*.part'
```

Expected: tests PASS; final command prints nothing.

**Step 5: Commit**

```bash
git add metadata.json config/model-finalists.json config/canonical-model.json config/canonical-model.schema.json download_model.sh evidence/medpsy-shared-runtime-v1/model.sha256 tests/canonical-model.test.ts tests/downloader.test.ts
git commit -m "feat: lock canonical MedPsy artifact"
```

## Task 5: Bind QVAC and the profiler to the same GGUF

**Files:**
- Modify: `src/config.ts`
- Modify: `src/qvac/engine.ts`
- Modify: `src/qvac/orchestrator.ts`
- Modify: `src/server.ts`
- Create: `src/model-contract.ts`
- Create: `tests/model-parity.test.ts`
- Modify: `tests/unit/config.test.ts`
- Modify: `tests/integration/server.test.ts`

**Step 1: Write failing parity tests**

Assert that:

- product configuration reads the canonical relative path instead of a private default;
- startup fails closed on missing or wrong-hash model;
- health reports name, path, SHA-256, product runtime, and official runtime distinctly;
- the profiler wrapper reads `_runtime.model_path` from `metadata.json`;
- no OLMo identity remains in the active model path.

Expected: FAIL against imported Triage-0 defaults.

**Step 2: Implement the smallest adapter**

Add one model-contract loader. Do not rewrite the working Triage-0 orchestration. Do not add a direct `llama-server` app adapter in Gate 1.

**Step 3: Verify**

```bash
npm test -- tests/model-parity.test.ts tests/unit/config.test.ts tests/integration/server.test.ts
npm run typecheck
```

Expected: PASS.

**Step 4: Commit**

```bash
git add src/model-contract.ts src/config.ts src/qvac/engine.ts src/qvac/orchestrator.ts src/server.ts tests/model-parity.test.ts tests/unit/config.test.ts tests/integration/server.test.ts
git commit -m "feat: share MedPsy across product and profiler"
```

## Task 6: Preserve the proven clinical product contract

**Files:**
- Modify only as needed: `src/triage/**`
- Modify only as needed: `src/rag/**`
- Modify only as needed: `src/qvac/orchestrator.ts`
- Modify: `config/generation-policy.json`
- Create: `config/product-generation-policy.json`
- Create: `config/profiler-prompt-policy.json`
- Create: `tests/product-contract.test.ts`
- Modify: imported clinical and integration tests

**Step 1: Write contract-characterization tests**

Freeze the reused behavior before adapting it:

- local RAG context assembly;
- fenced untrusted input;
- two-pass classification and plan generation;
- GBNF-constrained structured output;
- schema validation and bounded retry;
- deterministic class reconciliation;
- deterministic severity and red-flag ownership;
- source-bound citations;
- abstention and fail-closed error states;
- no visible chain-of-thought.

**Step 2: Separate product and profiler policies**

The official profiler uses the two public metadata prompts and direct llama.cpp. The product uses the documented two-pass QVAC orchestration. Same model bytes do not mean identical orchestration, and the report must say so.

**Step 3: Run targeted and full tests**

```bash
npm test -- tests/product-contract.test.ts tests/integration/grounding.test.ts tests/integration/injection.test.ts tests/integration/citation-integrity.test.ts tests/integration/triage.test.ts
npm test
npm run typecheck
```

Expected: PASS, with environment skips explicitly enumerated.

**Step 4: Commit**

Stage only the files modified by this task, as shown by `git diff --name-only`, and verify that each is in the task file list before committing.

```bash
git diff --name-only
git commit -m "test: freeze shared MedPsy clinical contract"
```

## Task 7: Build a fresh evidence-only MedPsy gate

**Files:**
- Create: `.github/workflows/medpsy-shared-runtime-evidence.yml`
- Create: `scripts/medpsy-shared-runtime/freeze-manifest.ts`
- Create: `scripts/medpsy-shared-runtime/run-raw.ts`
- Create: `scripts/medpsy-shared-runtime/evaluate.ts`
- Create: `config/medpsy-shared-runtime/fatal-gates.json`
- Create: `config/medpsy-shared-runtime/review-rubric.json`
- Create: `tests/medpsy-evidence.test.ts`
- Create: `evidence/medpsy-shared-runtime-v1/README.md`

**Step 1: Write failing workflow and manifest tests**

Require:

- exact candidate identity and pinned llama.cpp revision;
- unchanged holdouts separated from calibration;
- correct embedded chat template;
- raw output retention;
- model weights and partial files deleted before upload;
- no tuning after observing holdout output;
- explicit evidence tier and host;
- license decision included but itemized lineage not used as an unpublished fatal rule.

Expected: FAIL before workflow exists.

**Step 2: Implement the remote evidence producer**

Run direct llama.cpp only. Upload manifests, logs, raw outputs, evaluator output, and hashes. Never upload GGUF bytes.

**Step 3: Verify locally without weights**

```bash
npm test -- tests/medpsy-evidence.test.ts
npm run typecheck
ruby -e 'require "yaml"; YAML.load_file(".github/workflows/medpsy-shared-runtime-evidence.yml"); puts "YAML_OK"'
```

Expected: PASS and `YAML_OK`.

**Step 4: External publication checkpoint**

Push and dispatch only through the approved publication gate. Retrieve evidence-only artifacts and verify their hashes independently.

**Step 5: Commit**

```bash
git add .github/workflows/medpsy-shared-runtime-evidence.yml scripts/medpsy-shared-runtime config/medpsy-shared-runtime tests/medpsy-evidence.test.ts evidence/medpsy-shared-runtime-v1/README.md
git commit -m "feat: add evidence-only MedPsy gate"
```

## Task 8: Reconcile historical and fresh quality evidence

**Files:**
- Create: `evidence/medpsy-shared-runtime-v1/quality-reconciliation.md`
- Create: `evidence/medpsy-shared-runtime-v1/baseline-test-summary.json`
- Create after remote run: `evidence/medpsy-shared-runtime-v1/remote-run-<id>/**`
- Modify: `BUILD-REPORT.md` by append-only recovery section
- Modify: `POSTMORTEM.md` by append-only correction entry

**Step 1: Record historical evidence without promotion**

Document:

- Triage-0 baseline quality result 29/29 at its source commit;
- README snapshot claiming 97/97;
- later fresh-clone audit reporting 119 pass, 1 fail, 28 skip;
- why commit, dependency, platform, and fixture differences prevent direct comparison.

**Step 2: Record the fresh baseline run**

Store exact commit, command, Node version, OS, pass/fail/skip names, and artifact hashes.

**Step 3: Preserve prior failures**

Append a recovery note. Do not edit or overwrite earlier OLMo verdicts.

**Step 4: Commit**

```bash
git add evidence/medpsy-shared-runtime-v1 BUILD-REPORT.md POSTMORTEM.md
git commit -m "docs: reconcile MedPsy quality evidence"
```

## Task 9: Run mandatory human and physical gates

**Files:**
- Create: `evidence/medpsy-shared-runtime-v1/human-review.json`
- Create: `evidence/medpsy-shared-runtime-v1/physical-target.json`
- Create: `evidence/medpsy-shared-runtime-v1/offline-trace.json`
- Create: `evidence/medpsy-shared-runtime-v1/model-decision-input.json`
- Reference: `config/model-decision.schema.json`

**Step 1: Human checkpoint**

Stop for named human clinical review. Record rubric rows, reviewer identity, conflicts, signatures, and limitations. Agent review cannot satisfy this gate.

**Step 2: Physical checkpoint**

Stop for target-class Ubuntu hardware. Record CPU, OS, governor, ambient temperature, model hash, runtime revision, repeated TPS/RSS/temperature, throttle state, app process tree, and networking-disabled full flow.

**Step 3: Platform truth gate**

If the QVAC application does not run on Ubuntu x86, disclose the proven product platform and do not claim Ubuntu product support. The direct llama.cpp profiler evidence remains separately valid.

**Step 4: Decision input verification**

Run schema and cross-artifact parity tests. Any missing human, physical, hash, or raw evidence keeps the decision unsigned and Phase 2 blocked.

## Task 10: Sign the canonical decision only on complete pass

**Files:**
- Create on pass only: `evidence/model-decision.json`
- Create on pass only: `evidence/model-decision.sig`
- Modify: `config/model-finalists.json`
- Modify: `.build-state.json` through Build handling only
- Modify: `PULSE.md` by append-only protocol

**Step 1: Run the complete decision verifier**

```bash
npm run build-finalist-bundle
npm run finalist-gate
npm test -- tests/finalist.test.ts tests/model-parity.test.ts tests/medpsy-evidence.test.ts
```

Expected: all applicable gates PASS. Otherwise stop without creating the decision.

**Step 2: Sign through the existing release mechanism**

The decision names only MedPsy-1.7B Q4_K_M and hashes every input. Never sign with placeholders or builder-only self-attestation where a human/physical record is required.

**Step 3: Conductor transition**

The conductor verifies the signature and changes Phase 2 from forbidden to eligible. If the decision is absent or invalid, Build remains blocked.

**Step 4: Commit**

```bash
git add evidence/model-decision.json evidence/model-decision.sig config/model-finalists.json .build-state.json PULSE.md
git commit -m "build: select canonical MedPsy model"
```

## Task 11: Replace submission-facing placeholders

**Files:**
- Replace: `README.md`
- Replace: `REPORT.md`
- Modify: `metadata.json`
- Modify: `SUBMISSION-CHECKLIST.md`
- Modify: `FOR[Dami].md`
- Create: `docs/PRIOR-WORK-DISCLOSURE.md`
- Create: `docs/EVIDENCE-INDEX.md`
- Create: `tests/submission-contract.test.ts`

**Step 1: Write failing submission-contract tests**

Reject placeholder team data, wrong domain, wrong model, missing provenance link, prompt drift, unsupported platform/language claims, missing profiler fields, and unlabeled evidence tiers.

**Step 2: Write proof-first submission documents**

Include:

- exact shared model identity;
- direct llama.cpp scored path;
- QVAC product path distinction;
- exact prior-work disclosure;
- supervised clinical scope and limitations;
- English-only validated claim;
- source rights and model-card caveats;
- public reproduction steps;
- evidence links with host tiers.

Leave team ID, video URL, and unmeasured numeric fields as explicit blocking checklist items, not fabricated values.

**Step 3: Verify**

```bash
npm test -- tests/submission-contract.test.ts
npm run typecheck
```

Expected: PASS except explicitly external fields that the preflight gate marks unresolved.

**Step 4: Commit**

```bash
git add README.md REPORT.md metadata.json SUBMISSION-CHECKLIST.md 'FOR[Dami].md' docs/PRIOR-WORK-DISCLOSURE.md docs/EVIDENCE-INDEX.md tests/submission-contract.test.ts
git commit -m "docs: prepare truthful Triage-0 ADTC submission"
```

## Task 12: Full verification and conductor handoff

**Files:**
- Modify: `PULSE.md` by append-only protocol
- Modify: `.conductor-resume.md` through conductor only
- Create: `evidence/medpsy-shared-runtime-v1/final-verification.json`

**Step 1: Run local quality gates**

```bash
npm test
npm run typecheck
git diff --check
git ls-files 'model/*.gguf' 'model/*.part' '.release-private-key.pem'
```

Expected: tests and typecheck PASS; diff check clean; no weight, partial, or private key is tracked.

If `.release-private-key.pem` is currently tracked or staged, stop and use the approved secret-remediation procedure before any publication. Do not rewrite history without explicit authorization.

**Step 2: Run clean-clone verification**

In a temporary directory, clone the exact candidate commit, install dependencies, verify metadata, download and hash the GGUF, run direct llama.cpp/profiler, start the app, execute an English text case with egress disabled, and remove model bytes before retaining evidence.

**Step 3: Verify state consistency**

Assert the conductor state, beacon, Build state, PULSE, model decision, metadata, provenance, and evidence index agree on project identity, source commit, model hash, phase, and next legal dispatch.

**Step 4: Stop at the next mandatory checkpoint**

Return control to the conductor. Do not publish, spend, record the final video, or submit Devpost without the applicable explicit gate.

## Phase gate summary

| Gate | Required pass condition | Failure action |
|---|---|---|
| Recovery | Atomic conductor state and ownership checks agree | Stop before legal phase. |
| Legal/provenance | Exact import manifest, notices, disclosures, and model-license decision pass | Do not import application files. |
| Canonical artifact | Downloader, metadata, QVAC, and profiler agree on exact path/hash | Do not run behavioral evidence. |
| Product behavior | Imported baseline and characterization tests pass | Fix only against calibration; do not tune on holdouts. |
| Remote evidence | MedPsy direct llama.cpp evidence passes and retains no weights | Keep model decision absent. |
| Human/physical | Named human review and target-hardware evidence pass | Keep Phase 2 blocked. |
| Signed decision | Signature and every referenced artifact verify | Only then allow downstream phases. |
| Submission | Placeholders removed and all claims map to evidence | Do not publish or submit. |

## Explicitly deferred work

- Model search or model replacement.
- Fine-tuning.
- Translation or African-language claims.
- Speech-to-text and text-to-speech.
- Direct `llama-server` application adapter.
- UI redesign.
- Paid infrastructure.
- Hosted inference.
