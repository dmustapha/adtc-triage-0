# Phase 5 API Results

## Verdict

PASS for model-free and deterministic local boundaries. Live QVAC completion remains unavailable and unclaimed.

## Verified behavior

- Empty, whitespace, missing, oversized, malformed, and invalid structured inputs return fixed 400/413 responses before inference.
- Omitted or partial danger assessments fail closed.
- A known structured emergency precedes missing age, routing, and MedPsy.
- Isolated chest indrawing follows the deterministic age-scoped pneumonia branch.
- `/tts` and `/transcribe` are absent.
- `/health` survives malformed requests and exposes explicit store, resident-model, runtime, and egress state.
- Production `startServer` now binds to `127.0.0.1` rather than every interface.
- A response timeout no longer releases the single-inference queue while underlying QVAC work is still running.

## Evidence

```text
node --import tsx --test tests/debug-inference-queue.test.ts tests/debug-localhost-security.test.ts tests/integration/http-validation.test.ts
# 13 total, 13 pass, 0 fail, 0 skip

node --import tsx --test tests/integration/sse-contract.test.ts tests/unit/frontend.test.ts
# 20 total, 17 pass, 0 fail, 3 store-dependent skips

npm run typecheck
# exit 0
```

## Remaining boundary

The three grounded SSE tests self-skipped because the RAG store is not ingested. The canonical GGUF is also intentionally absent. No download, model load, inference, or synthetic replacement was attempted.
