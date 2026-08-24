# Debug Phase 3: Local Integration Results

## Scope

Claim-limited local Apple development evidence only. No model download, QVAC inference, sealed holdout access, network mutation, workflow dispatch, publication, or physical Ubuntu claim was attempted.

## Actual connection graph

| Boundary | Observed result |
|---|---|
| Browser assets to Express | `/app` serves the compact structured-assessment UI with self-hosted assets. |
| Browser to health | `/health` returns canonical MedPsy identity, resident roles, RAG status, and egress-guard state. |
| Browser to assessment | `POST /triage` accepts the structured age and seven observation fields and returns SSE. |
| Request validation to runtime | Invalid, omitted, and partial structured inputs stop before QVAC/context boundaries. |
| Deterministic danger policy to SSE | Known danger emits `stage`, `citation`, `card`, and `done` with `EMERGENCY`, without QVAC. |
| QVAC and RAG path | Not runnable locally: store is not ingested and no resident model is present. Model-gated tests self-skip truthfully. |

The current imported app uses `/health`, `/triage`, and `/perf-log*`. Legacy `/api/assess*`, `/api/sources*`, and `/api/proof*` rows still present in PRD/architecture are not the actual imported HTTP surface. The browser and current server agree with each other, but this documentation drift remains a Verify concern.

## Commands and results

```text
node --import tsx --test --test-concurrency=1 tests/integration/*.test.ts
38 total, 17 pass, 0 fail, 21 skip

npm run typecheck
pass

node --import tsx --test tests/debug-local-e2e.test.ts tests/debug-ui-claims.test.ts tests/unit/frontend.test.ts tests/integration/http-validation.test.ts tests/integration/sse-contract.test.ts tests/integration/server.test.ts tests/structured-danger-contract.test.ts
44 total, 38 pass, 0 fail, 6 skip
```

The 21 consolidated integration skips reconcile exactly to absent local RAG/model prerequisites: 3 citation-integrity, 6 grounding, 2 injection, 1 full offline-egress, 3 model-gated server, 3 model-gated SSE, and 3 model-gated triage tests. The egress guard negative control passed. These skips do not prove the real QVAC product path.

## Findings

- Canonical health identity is stable at SHA-256 `41ee947d9cce72ec657577219fd1798fabeabf0d832217fe23c9d6d3d18d5880`, QVAC SDK 0.13.3 product runtime, and llama.cpp official runtime.
- Malformed JSON, oversized bodies, excluded audio endpoints, invalid age/observation values, and post-error server survival pass through the real Express boundary.
- Deterministic danger precedence produces a fixed IMCI citation and emergency card with zero observed QVAC, semantic-routing, retrieval, or MedPsy boundaries.
- The current local health state has no resident models and no runnable ingested store. Full supported all-absent QVAC flow, grounded citations, and network-disabled inference remain unavailable and unclaimed.

## Verdict

Local deterministic integration passes. Real QVAC/RAG integration remains truthfully blocked by absent authorized prerequisites and cannot be promoted to product evidence.
