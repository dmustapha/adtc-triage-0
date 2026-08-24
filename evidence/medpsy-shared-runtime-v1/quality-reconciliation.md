# MedPsy shared-runtime quality reconciliation

This record separates historical Triage-0 evidence from the current ADTC recovery. It does not promote an old total into current proof and does not claim remote MedPsy evidence that has not run.

## Historical records

| Record | Exact source | Reported result | Evidence class |
|---|---|---:|---|
| Development quality fixture | Triage-0 commit `74424721bc75f564808eacce42d7f7f42676ae0f`, `tests/quality/results-after-textbook.json` | 29 passed of 29, 0 failed, 0 errors | Historical development regression |
| README snapshot | Same commit, `README.md` test section | Claims 97/97 passing | Historical documentation claim, not a retained runner artifact |
| Later fresh-clone audit | `research/TRIAGE-0-ADTC-FIT-AUDIT.md` | 119 passed, 1 failed, 28 skipped of 148 | Historical fresh-clone audit |

The fresh-clone failure was documented precisely: the test expected a local default model path while the source configuration defaulted to a remote Hugging Face URL. The 28 skips depended on generated citations, an ingested WHO store, or cached speech/model assets.

These totals are not comparable. They differ by commit and test inventory, dependency lock and resolution, Node/platform environment, generated fixtures, cached assets, and product scope. The 29-case file is a development quality fixture rather than the Node test suite; 97/97 is a README claim; and the 148-test audit predates the ADTC import and English-only adaptation. A skipped test is never counted as passing proof.

## Fresh local ADTC evidence

Environment: macOS 26.0.1 build 25A362, arm64, Node v24.10.0. Evidence tier: local development, static and model-free. The RAG store was not ingested and no GGUF was present.

Task 6 produced commit `5ee2766961660b31ce9516723b7ff800e652e781`:

- Focused product/SSE contract: 8 total, 5 passed, 0 failed, 3 skipped.
- Broader clinical target: 20 total, 5 passed, 0 failed, 15 skipped.
- Full `npm test`: 196 total, 173 passed, 0 failed, 23 skipped, 0 todo.
- Typecheck and the 76-entry immutable import verifier passed.

All 23 full-suite skips are named in `baseline-test-summary.json`; each is tied to the absent local citation map or uningested RAG/model store.

Task 7 produced commit `f5532fc9f3b1b28209df2b2ca92edc341079e9b2`:

- Focused evidence scaffold: 6 total, 6 passed, 0 failed, 0 skipped.
- Typecheck passed and the workflow parsed as YAML.
- Only the unauthorized-candidate and absent-raw fail-closed paths executed. The valid raw runner and workflow were not invoked.

Commands, exact counts, skip names, environment fields, tree IDs, and content hashes are recorded in `baseline-test-summary.json`.

## Remote and decision status

Fresh remote MedPsy evidence is absent and pending the approved publication gate. There is no workflow run ID, downloaded artifact, evaluator result, profiler result, target-laptop result, or human clinical review in this namespace. Consequently, this reconciliation does not select a model, certify clinical safety, claim Ubuntu product support, or report official performance.

Historical OLMo failures remain valid within their original namespaces and contracts. The shared-MedPsy recovery corrects the earlier inference that a self-imposed itemized-lineage block was a MedPsy behavioral failure; it does not rewrite those OLMo verdicts.

## Authorized remote run 32742482642

The exact 16-commit range through `a3660776681e597257d7f5f8a390089cb76e21bc` was published after a lease-checked remote-drift preflight. The published workflow SHA-256 matched the authorized local file: `4e37e97053a1b23410de3d11eb19e38de18df4e974070e1662b417eaf67f2904`. Exactly one workflow dispatch occurred; it is terminal and will not be retried without new authority.

The remote job verified the immutable 1,282,439,360-byte MedPsy file with SHA-256 `41ee947d9cce72ec657577219fd1798fabeabf0d832217fe23c9d6d3d18d5880`, captured all 12 frozen calibration rows through pinned llama.cpp with the embedded template and `--jinja --single-turn`, then failed calibration. Independent review reproduced evaluator exit 2 and verified raw SHA-256 `c930bcc9636be678f2305f22f4c078febd1fb6a97da44855774f6c7edd8e3e53`.

Five fatal gates failed: danger ownership (12 mismatches), uncertainty fidelity (0/5 exact), injection resistance (2 mismatches), complete validity (0%), and routine truncation (100%). Untouched holdouts and profiler prompts correctly did not run. Cleanup and evidence-only upload succeeded; the artifact contains only three JSON/JSONL evidence files and no GGUF or partial file. This is a terminal rejection for the frozen MedPsy contract, not a human or physical pass. Human review, physical Ubuntu evidence, signing, and Phase 2 were not entered.
