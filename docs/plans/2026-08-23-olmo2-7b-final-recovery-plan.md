# OLMo-2 7B Final Recovery Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `executing-plans` only inside the conductor-dispatched Build orchestrator. Never run Hackathon Build directly.

**Goal:** Evaluate the approved OLMo-2 7B Q4_K_M artifact under the unchanged Phase 1 gate and either sign one canonical model decision or stop fail-closed.

**Architecture:** The conductor reopens only Build Phase 1 for one authorized attempt. The Build orchestrator extends the existing content-addressed candidate and CI machinery under TDD, freezes all inputs before inference, runs one exact x86 evidence workflow, and advances only after raw, human, and physical-resource gates pass.

**Tech Stack:** TypeScript, Node.js test runner, JSON, GitHub Actions, Shell, pinned CPU-only llama.cpp, Hugging Face immutable artifacts.

---

### Task 1: Resume the conductor and authorize Build attempt 4

**Files:**
- Read: `.conductor-resume.md`
- Read: `.conductor-state.json`
- Read: `PULSE.md`
- Read: `.build-state.json`
- Read: `docs/plans/2026-08-23-olmo2-7b-final-recovery-design.md`
- Modify atomically: `.conductor-state.json`
- Modify: `.conductor-resume.md`

**Step 1: Run the conductor resume gate**

Run:

```bash
bash ~/.codex/skills/utils/dispatch-gate.sh resume /Users/MAC/adtc-2026
```

Expected: `gate=pass`; Intel, Warroom, Forge, Critique, and URL Preverification remain non-dispatchable.

**Step 2: Run the FSM and Build pre-gate**

Run:

```bash
bash ~/.codex/skills/utils/pipeline-fsm.sh /Users/MAC/adtc-2026
bash ~/.codex/skills/utils/dispatch-gate.sh pre build /Users/MAC/adtc-2026
```

Expected: the conductor recognizes the explicit user recovery authorization and permits only Build Phase 1 resume. If the generic retry ledger rejects the user-authorized fourth attempt, the conductor must record the explicit override transparently rather than misclassifying it as an automatic retry.

**Step 3: Write conductor state atomically**

Set Build to `running`, `dispatch_context.mode` to `resume`, `attempt` to `4`, `max_attempts` to `4`, and the approved candidate identity to `olmo-2-1124-7b-instruct-q4-k-m`. Refresh the beacon and phase-ownership checksum.

**Step 4: Dispatch the existing Build orchestrator**

Pass only the design path, this plan path, candidate identity, unchanged gate requirement, and prohibition on Phase 2/UI before a signed decision.

### Task 2: Freeze the exact candidate under TDD

**Files:**
- Modify: `tests/finalist-producers.test.ts`
- Modify: `config/model-finalists.json`
- Modify: `evidence/finalists/replacement-shortlist.json`
- Create: `evidence/finalists/replacement/olmo-2-1124-7b-instruct-q4-k-m-candidate.json`

**Step 1: Write failing identity tests**

Assert the exact repository, revision, filename, `4472020256` bytes, SHA-256 `e08112e5f84aab7c05fa6e713c58e5214cd5d8e32ed773ff3354b006eed41b95`, Q4_K_M quantization, Apache-2.0 license, and output path. Assert historical candidates remain byte-identical.

**Step 2: Verify RED**

Run:

```bash
node --import tsx --test --test-name-pattern='OLMo-2 7B' tests/finalist-producers.test.ts
```

Expected: FAIL because the approved 7B candidate is not frozen yet.

**Step 3: Add the minimal candidate records**

Add only the exact approved identity and decision rationale. Do not change corpus, rubric, generation policy, or historical evidence.

**Step 4: Verify GREEN**

Run the focused test again.

Expected: PASS.

**Step 5: Commit**

```bash
git add tests/finalist-producers.test.ts config/model-finalists.json evidence/finalists/replacement-shortlist.json evidence/finalists/replacement/olmo-2-1124-7b-instruct-q4-k-m-candidate.json
git commit -m "build: freeze OLMo-2 7B recovery candidate"
```

### Task 3: Prove the public lineage chain

**Files:**
- Modify: `config/replacement-lineage-sources.json`
- Create: `evidence/finalists/replacement/olmo-2-1124-7b-instruct-q4-k-m-training-lineage.json`
- Test: `tests/finalist-producers.test.ts`

**Step 1: Add failing lineage coverage**

Require immutable primary records for the official GGUF, final instruct model, RLVR data, DPO model/data, SFT model/Tülu 3 data, base model, Dolma data, Apache-2.0 license, and any upstream restrictions.

**Step 2: Verify RED**

Run the focused lineage test and expect missing-source failures.

**Step 3: Pin every primary source**

Record immutable URLs and content hashes. Do not accept a mutable `main` card, search result, or weight license as a substitute for the full lineage record.

**Step 4: Run the lineage producer**

Use the existing `scripts/run-lineage-gate.ts` interface for candidate `olmo-2-1124-7b-instruct-q4-k-m`.

Expected: verified pass or an immediate fail-closed Build return.

**Step 5: Commit**

```bash
git add config/replacement-lineage-sources.json tests/finalist-producers.test.ts evidence/finalists/replacement/olmo-2-1124-7b-instruct-q4-k-m-training-lineage.json
git commit -m "build: verify OLMo-2 7B lineage"
```

### Task 4: Generalize the evidence producer without changing the gate

**Files:**
- Modify: `tests/finalist-producers.test.ts`
- Modify: `scripts/run-raw-finalist.ts`
- Modify: `scripts/produce-replacement-ci-evidence.ts`
- Create: `.github/workflows/olmo2-7b-recovery-evidence.yml`
- Create: `evidence/finalists/replacement/olmo2-7b-producer-manifest.json`

**Step 1: Write failing producer tests**

Assert that the 7B workflow pins the approved candidate and llama.cpp commit, uses four threads, zero GPU layers, 2,048 context, 128 output tokens, temperature zero, `--jinja --single-turn`, a 120-second per-case kill bound, resumable anonymous download, exact bytes/hash before atomic rename, and evidence-only upload after weight deletion.

**Step 2: Verify RED**

Run the focused workflow and producer tests. Expect failures because the 7B workflow does not exist.

**Step 3: Implement the smallest candidate parameterization**

Reuse the proven OLMo 1B workflow structure. Do not fork the corpus, rubric, raw evaluator, or safety thresholds. Increase only download timeout if required by the larger immutable file; do not change inference semantics.

**Step 4: Freeze all producer hashes**

Generate the new producer manifest before any model response is observed. Confirm the corpus, rubric, split, and policy hashes match the corrected OLMo 1B manifest exactly.

**Step 5: Verify GREEN and the full suite**

Run:

```bash
npm test
npm run typecheck
ruby -e 'require "yaml"; YAML.load_file(".github/workflows/olmo2-7b-recovery-evidence.yml"); puts "YAML_OK"'
```

Expected: all tests pass, strict TypeScript exits zero, and `YAML_OK` prints.

**Step 6: Commit**

```bash
git add tests/finalist-producers.test.ts scripts/run-raw-finalist.ts scripts/produce-replacement-ci-evidence.ts .github/workflows/olmo2-7b-recovery-evidence.yml evidence/finalists/replacement/olmo2-7b-producer-manifest.json
git commit -m "build: add frozen OLMo-2 7B evidence producer"
```

### Task 5: Run the exact remote evidence workflow

**Files:**
- Create after retrieval: `evidence/remote-run-<RUN_ID>/`

**Step 1: Push only the reviewed candidate and workflow commits**

```bash
git push submission main
```

Expected: the public submission remote contains the exact producer commit.

**Step 2: Dispatch the workflow**

```bash
gh workflow run olmo2-7b-recovery-evidence.yml --repo dmustapha/adtc-2026-submission-template --ref main
gh run list --repo dmustapha/adtc-2026-submission-template --workflow olmo2-7b-recovery-evidence.yml --limit 1
```

Record the returned run ID immediately.

**Step 3: Monitor without changing inputs**

```bash
gh run watch <RUN_ID> --repo dmustapha/adtc-2026-submission-template --exit-status
```

Expected: pinned llama.cpp build, 4,472,020,256-byte anonymous download, SHA-256 verification, template extraction, bounded one-turn smoke, 100 serial raw cases, weight deletion, and evidence-only upload all complete.

**Step 4: Retrieve the evidence artifact**

```bash
mkdir -p evidence/remote-run-<RUN_ID>
gh run download <RUN_ID> --repo dmustapha/adtc-2026-submission-template --dir evidence/remote-run-<RUN_ID>
```

Expected: no `.gguf` or `.partial` file exists in the downloaded artifact.

### Task 6: Audit the unchanged raw gate independently

**Files:**
- Create: `evidence/remote-run-<RUN_ID>/independent-raw-gate-review.json`
- Modify: `evidence/finalists/replacement/recovery-status.json`
- Modify: `.build-state.json`
- Modify: `BUILD-REPORT.md`
- Modify: `PULSE.md`
- Modify: `FOR[Dami].md`
- Modify: `tasks/todo.md`

**Step 1: Verify artifact integrity before behavior**

Assert 100 unique frozen IDs, exact candidate/model hash, exact producer flags, raw JSONL hash, no missing/extra rows, and no model weights.

**Step 2: Apply every unchanged fatal gate**

Review danger safety, uncertainty, abstention, medical mimic, invented resources, prompt injection, required JSON, visible reasoning, truncation, and both holdout thresholds. App filtering receives zero credit.

**Step 3: Branch only on evidence**

- If any fatal raw gate fails, write a rejected review, keep `selectedCandidateId` null, do not create `evidence/model-decision.json`, return Build BLOCKED, and stop.
- If all automated raw gates pass, continue to the two independent human reviews and target-laptop resource procedure without changing the producer.

### Task 7: Sign the decision only after human and physical gates

**Files:**
- Create only on complete pass: `evidence/model-decision.json`
- Create only on complete pass: `evidence/model-decision.sig`
- Modify: `config/model-finalists.json`
- Modify: `.build-state.json`
- Modify: `.conductor-state.json` through the conductor only
- Modify: `.conductor-resume.md`

**Step 1: Obtain two independent named reviews**

Each reviewer evaluates the frozen raw artifact and signs the human rubric record. The required mean score is at least 4 with no fatal exception.

**Step 2: Run the frozen target-laptop procedure**

Use Ubuntu 22.04, 8 GB RAM, four CPU threads, zero GPU layers, three cold runs, full process-tree RSS, temperature, and throttling evidence. Require model-process peak RSS below 6.0 GB and full workflow peak below 6.5 GB.

**Step 3: Build and sign the decision**

Use the existing release-key and finalist-gate scripts. Verify the detached signature and tamper rejection.

**Step 4: Run final verification**

```bash
npm test
npm run typecheck
test -f evidence/model-decision.json
jq -e '.selectedCandidateId == "olmo-2-1124-7b-instruct-q4-k-m"' .build-state.json
```

Expected: all commands succeed.

**Step 5: Let the conductor advance**

Run the Build post-gate, atomically mark Build running at Phase 2 or complete as defined by the Build skill, refresh the beacon, and continue the FSM. Never advance when the signed decision is absent.
