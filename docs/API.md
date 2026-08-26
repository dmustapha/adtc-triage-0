# Local HTTP and SSE contract

**Status:** local restored-build API. The supported server binds to `127.0.0.1`. `/debug/route` is disabled by the supported profile and is not public API.

All JSON objects are strict and request bodies are capped at 256 KiB. Clinical narrative is 1–2,000 characters; ordinary prompts are 1–4,000 characters. NUL, bidi overrides, and unsafe invisible controls are rejected.

## Ownership

The first inference or confirmation request sets `triage0_session=<UUID>; HttpOnly; SameSite=Strict; Path=/`. This cookie owns jobs and confirmation grants. Non-browser clients must retain and resend it. A foreign owner cannot cancel a job or consume a grant.

## `POST /triage`

Send `Content-Type: application/json`:

```json
{
  "caseText": "Two-year-old with cough; breathing counted at 32 per minute while calm.",
  "patientAge": { "value": 24, "unit": "months" },
  "patientWeightKg": 12,
  "dangerObservations": {
    "cannotDrinkOrBreastfeed": "ABSENT",
    "vomitsEverything": "ABSENT",
    "convulsions": "ABSENT",
    "lethargicOrUnconscious": "ABSENT",
    "chestIndrawing": "ABSENT",
    "stridorWhenCalm": "ABSENT",
    "lowOxygenOrCentralCyanosis": "ABSENT"
  },
  "respiratoryAssessment": {
    "coughOrDifficultBreathing": "PRESENT",
    "respiratoryRatePerMinute": 32,
    "rateCountQuality": "ONE_MINUTE_WHILE_CALM"
  },
  "medicationSafety": {
    "allergiesReviewed": "NOT_ASSESSED",
    "contraindicationsReviewed": "NOT_ASSESSED",
    "allergyDetails": [],
    "contraindicationDetails": []
  },
  "protocolApplicability": { "status": "NOT_ASSESSED", "details": [] }
}
```

Age is bounded to 0–130 years or 0–1,560 months; weight to 0.5–300 kg. Observation values are `PRESENT`, `ABSENT`, or `NOT_ASSESSED`. Respiratory rate, when supplied, is an integer from 1 through 200.

After validation, the response is `text/event-stream`. Deterministic routes emit `stage`, then either `assessment_required` or `citation` + `card`, then exactly one `done`. Model-assisted routes emit `job`, one or more `stage`, optional `citation` and `first_token`, `card`, optional `provisional`, then one `done`. Failure emits one `error`, then `done {"ok":false}`.

The card is allowlisted to: `outcome`, `finding`, `basis`, `nextAssessmentStep`, `matchedCriteria`, `missingFields`, `recorded`, `thresholdComparison`, `emergencyObservations`, `sourceRule`, `assistance`, `uncertainty`, `reviewState`, `recordedFacts`, and `inferredFacts`. Classifier severity, raw red flags, diagnosis, prescription, and model-authored actions are excluded. A `provisional` event may name the human-gated WHO class and protocol.

Pre-SSE failures are JSON: `400` invalid record, `409` narrative/structured conflict, `413` oversized body.

## `POST /triage/confirm`

```json
{ "token": "opaque grant from provisional event", "decision": "CONFIRM" }
```

The decision is `CONFIRM` or `REJECT`. Grants are owner-, record-, class-, citation-, and policy-bound and expire after five minutes. An identical owner/decision replay is idempotent and returns `replayed:true`; a decision flip is rejected. Failures: `403 OWNER_MISMATCH`, `404 NOT_FOUND`, `409 USED` or `BINDING_MISMATCH`, `410 EXPIRED`.

## `POST /assist`

```json
{ "prompt": "Explain the recorded facts and uncertainty." }
```

Success order is `job`, `stage`, `answer`, `done`. A policy- or validation-withheld result uses `rejected`; an operational failure uses `error`; each ends with exactly one `done`. Public terminal payloads contain status, answer or bounded reason, uncertainty, limitations, and validation categories. Internal reasoning is never emitted.

## `DELETE /jobs/:id`

Cancels an owned queued or active job. IDs are 1–128 ASCII letters, digits, `_`, or `-`. Returns `200 {"ok":true,"state":"cancelled"}`, `404` for absent/foreign jobs, and `409` for terminal jobs. Cancellation does not release native ownership until QVAC settles.

## Read-only endpoints

- `GET /health`: liveness, exact model identity, readiness atoms, resident roles, RAG/citation state, egress state, queue recovery, and bounded diagnostics.
- `GET /perf-log`: newest 500 local product-performance rows as JSON.
- `GET /perf-log.csv`: the same bounded rows as CSV.

Performance rows are local product telemetry, not official profiler score evidence.

## Recovery codes

| Code | Transport | Recovery |
|---|---|---|
| `QUEUE_BUSY` | HTTP 429, `Retry-After: 2` | Retry after two seconds. |
| `QUEUE_CLOSED` | HTTP 503 | Restart the supported app. |
| `RESTART_REQUIRED` | HTTP 503 or SSE | Restart; native ownership did not recover safely. |
| `TIMEOUT` | SSE | One fresh retry; restart if repeated. |
| `CANCELLED` | SSE or rejected result | Start a fresh run only when the user chooses. |
| `DISCONNECTED` | SSE when writable | Reconnect and start a fresh run. |
| `RUNTIME_UNAVAILABLE` | rejected prompt result | Check `/health`, then retry once. |
| `INFERENCE_FAILED` | HTTP 503 or SSE | Check readiness or restart before a new run. |
| `MALFORMED_RESPONSE` | browser-detected | Do not auto-retry; restart the supported app. |

Public errors exclude raw SDK messages, absolute paths, prompts, stacks, and model output.
