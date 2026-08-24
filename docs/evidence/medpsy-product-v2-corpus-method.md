# MedPsy Product v2 Corpus Method

**Revision:** 2026-08-24 structured danger
**Evidence plane:** supported-platform QVAC product
**Clinical status:** provisional pending named human review

## Purpose

This revision tests the product contract in which structured age and seven recorded respiratory observations own danger decisions. It does not retry the failed direct-`llama.cpp` extraction contract and does not rewrite its 12 expected outputs. The exact MedPsy bytes remain load-bearing only for supported, all-absent cases that reach the real QVAC routing, local RAG, two-pass generation, schema, bounded retry, reconciliation, and source-bound plan path.

## Development calibration

`calibration-corpus.json` contains 27 newly authored cases with revision-specific IDs. The matrix covers each emergency-capable observation, emergency combinations, isolated chest indrawing at and outside the supported age boundaries, every `NOT_ASSESSED` field, omission, internal conflict, supported model-invoked cases, abstention, injection, retry, and citation integrity.

Each case commits its request, expected contract assertions, coverage tags, citations, and provisional review status with `caseSha256 = SHA-256(JSON.stringify(case without caseSha256))`. Source records bind both the registered source hash and the derived-content hash in `config/clinical-sources.json`. These hashes establish immutability and traceability; they do not substitute for clinical or rights review.

Deterministic route expectations come from the approved structured-danger contract. Any clinical classification or severity expectation remains explicitly provisional. No real inference was run while authoring or freezing this corpus.

## Separation from failed historical evidence

The v2 IDs use the `MPCAL2-` namespace. Case prose is not copied from `config/phase1-contract-v1/calibration-corpus.json`, and the old atomic extraction keys (`scope`, `cd`, `ve`, `cv`, `lu`, `ci`, `cs`, `ox`) are not reused as v2 expected outputs. Historical run `32742482642` and its aggregate hash remain untouched. The earlier evidence is diagnostic history only and receives no v2 credit.

## Sealed holdout boundary

No authorized independent holdout producer exists. Build therefore freezes only `holdout-manifest.json`: a disjoint reserved-ID set, required coverage, independence constraints, and reproducible design hashes. It contains no case text, expected label, artifact path, or content commitment. `caseContentSha256` is `null` because inventing a hash for nonexistent unseen content would be false evidence.

An authorized independent producer must create and hash the unseen contents without access to model outputs or calibration expected outputs. Build must not inspect them. The holdout may run only after the frozen calibration passes, and no tuning is permitted after holdout output is observed.

## Human review and fail-closed behavior

`review-rubric.json` requires a named qualified human reviewer and forbids builder or agent self-review. Every case begins as `provisional-pending-named-human-review`. The product evaluator rejects rows with any other status than `reviewed`; an evidence producer must carry the actual review state into each row. Missing or provisional review therefore cannot produce a passing claim-bearing evaluation.

Human review must assess structured authority, emergency precedence, the age-scoped chest-indrawing branch, missing-data abstention, model-path usefulness, clinical labels, citations, adversarial behavior, and disjointness. Hashes, automated tests, remote CI, and unit fixtures cannot satisfy this gate.

## Execution boundary

This method freezes design artifacts only. It authorizes no model download, inference, network call, workflow dispatch, holdout inspection, signed decision, publication, or physical-device claim.
