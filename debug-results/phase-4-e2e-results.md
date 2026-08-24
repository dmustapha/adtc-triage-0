# Debug Phase 4: End-to-End Results

## Scope

Browser-free local HTTP E2E over a real ephemeral Express listener. The test deliberately imports `app` instead of calling `startServer`, so it cannot prewarm, download, or invoke absent model/store prerequisites.

## Reproducible command

```text
node --import tsx --test tests/debug-local-e2e.test.ts tests/debug-ui-claims.test.ts
4 total, 4 pass, 0 fail, 0 skip
```

The E2E path verifies:

1. `GET /health` reports the immutable model identity, `residentModels: []`, and an unarmed egress guard.
2. `GET /app` returns the final local UI without a pre-run completed-assessment claim.
3. `POST /triage` with a known structured danger sign returns SSE in the `stage`, `citation`, `card`, `done` path.
4. The returned card is `EMERGENCY` and no QVAC/context boundary is observed.
5. The ephemeral server closes cleanly after the test.

## TDD defect corrections

### Pre-run runtime claim

- RED: `This ran on the device. No network was used.` was visible before an assessment, while health reported no resident model and no armed egress proof.
- GREEN: the panel now says `Run an assessment to populate local runtime evidence. Network policy and model residency are reported below.`

### Browser reachability versus app egress

- RED: bare `Online`/`Offline` reflected `navigator.onLine`, which could be read as application inference behavior.
- GREEN: it now says `Browser online` or `Browser offline`. `On-device` remains reserved for an armed server egress guard.

### Configured model versus resident model

- RED: a configured `h.medpsy` value rendered `runs on this Mac` even when `/health` returned `residentModels: []`.
- GREEN: the model proof chip now requires the actual `medpsy` resident role.

## Limits and verdict

The deterministic local E2E path passes. The all-absent QVAC path, local-RAG retrieval, real completion telemetry, strict armed egress proof during inference, and physical Ubuntu evidence remain unavailable and unclaimed. Full product E2E is therefore blocked, not waived or inferred.
