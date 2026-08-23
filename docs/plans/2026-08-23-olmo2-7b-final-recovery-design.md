# OLMo-2 7B Final Phase 1 Recovery Design

**Status:** Approved by the user on 2026-08-23 at 19:45 WAT

## Objective

Clear Triage-01's Phase 1 canonical-model blocker with one final, bounded, conductor-owned evaluation of `allenai/OLMo-2-1124-7B-Instruct-GGUF` Q4_K_M. The attempt preserves every frozen lineage, raw-behavior, safety, format, resource, and evidence rule. It does not promise that the model will pass.

## Locked candidate

| Field | Value |
|---|---|
| Candidate ID | `olmo-2-1124-7b-instruct-q4-k-m` |
| Repository | `allenai/OLMo-2-1124-7B-Instruct-GGUF` |
| Revision | `410e0069f64869e4b1d17d8de04810b881fd824b` |
| Filename | `olmo-2-1124-7B-instruct-Q4_K_M.gguf` |
| Bytes | `4472020256` |
| SHA-256 | `e08112e5f84aab7c05fa6e713c58e5214cd5d8e32ed773ff3354b006eed41b95` |
| Quantization | `Q4_K_M` |
| Parameters | `7B` |
| License | `Apache-2.0` |
| Runtime architecture | `olmo2` |
| Immutable URL | `https://huggingface.co/allenai/OLMo-2-1124-7B-Instruct-GGUF/resolve/410e0069f64869e4b1d17d8de04810b881fd824b/olmo-2-1124-7B-instruct-Q4_K_M.gguf?download=true` |

## Why this candidate

OLMo-2 7B is the only screened option that combines a public Base to SFT to DPO to RLVR chain, an official Ai2 GGUF, anonymous download, Apache-2.0 weights, the already supported `olmo2` llama.cpp architecture, and materially more behavioral capacity than the rejected OLMo 1B. Accuracy carries 50 percent of the ADTC score, so the larger model is worth a slower four-thread runtime if it remains under the hard memory and thermal limits.

The 4,472,020,256-byte file is a tight but plausible 8 GB fit. It must prove model-process peak RSS below 6.0 GB and full P0 workflow process-tree RSS below 6.5 GB. Estimates do not earn a pass.

## Rejected alternatives

1. `ggml-org/SmolLM3-3B-GGUF` Q4_K_M is smaller and faster, but its official post-training data documentation retains unresolved TODO links. That risks repeating the frozen lineage failure.
2. `Qwen/Qwen3-4B-Instruct-2507` is a strong non-thinking instruction model, but its official card does not provide the itemized training-data ledger required by the frozen gate, and the screened GGUFs are community artifacts.
3. Olmo 3 7B and Apertus 8B are newer transparent models, but only community GGUFs were found and their architectures postdate the pinned llama.cpp revision. Adopting either would expand runtime risk under deadline.

## Execution boundary

The hackathon conductor owns the recovery. Hackathon Build must not run directly. The new chat runs the conductor resume gate, records the user-authorized fourth Build attempt, and dispatches the existing Build orchestrator in resume mode with this design and its implementation plan.

Build may modify only the Phase 1 candidate, lineage, producer, CI, evidence, report, state, PULSE, task, and educational-document surfaces required for this attempt. It must not reopen PRD, Architecture, PLAN, Critique, URL Preverification, or Warroom. It must not add UI, Phase 2 runtime breadth, QVAC, Triage-0 implementation, or new P0 scope.

## Frozen scientific controls

- The existing 50 pediatric and 50 general-medical cases remain byte-identical.
- Rubric, split identities, host labels, generation limits, context, temperature, four threads, zero GPU layers, timeouts, and fatal thresholds remain byte-identical.
- The producer must use pinned llama.cpp with the GGUF's embedded chat template and `--jinja --single-turn`.
- All candidate identity, lineage sources, commands, output paths, and hashes must be frozen before the first behavioral response is observed.
- Run `32652354894` remains withdrawn and may never support a behavioral conclusion.
- Run `32653499076` remains the authoritative rejection of OLMo 1B and may not be reinterpreted as evidence for OLMo 7B.

## Gate sequence

1. Verify the immutable repository revision, anonymous redirect chain, exact byte count, SHA-256, license, base model, and full post-training lineage.
2. Add the exact 7B identity under TDD without rewriting historical candidate evidence.
3. Verify the pinned llama.cpp build recognizes the `olmo2` GGUF, extracts the embedded template, completes one turn, and exits.
4. Run a technical load and bounded single-response smoke check before the expensive corpus. No producer change is allowed after any behavioral output is observed.
5. Run all 100 frozen cases serially in controlled x86 CI using four threads, zero GPU layers, 2,048 context tokens, 128 generated tokens, temperature zero, `--jinja`, and `--single-turn`.
6. Remove the GGUF before uploading an evidence-only artifact. Verify 100 unique case IDs, exact commands, raw hash, and absence of weights.
7. Apply the unchanged automated fatal gates and two independent human reviews.
8. If raw and human gates pass, run the frozen 8 GB, four-thread target-laptop resource and thermal procedure.
9. Create and sign `evidence/model-decision.json` only after every mandatory gate passes. Then and only then may the conductor advance Build into Phase 2.

## Failure handling

Any lineage, download, identity, load, safety, hallucination, prompt-injection, structured-format, visible-reasoning, truncation, human-review, memory, thermal, or reproducibility failure rejects the candidate. Application filtering cannot rescue a raw failure. If OLMo-2 7B fails, stop model searching and return to the user for an explicit decision to revise the frozen model requirement or pivot the submission.

## Success condition

Success is not a completed CI run. Success is one signed `evidence/model-decision.json` naming the exact OLMo-2 7B artifact, backed by passing raw, human, and target-laptop evidence, followed by conductor authorization to enter Phase 2.
