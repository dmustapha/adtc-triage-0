# Local HTTP and SSE contract

**Status:** local restored-build API. The supported server binds to `127.0.0.1`. `/debug/route` is disabled by the supported profile and is not public API.

All JSON objects are strict and request bodies are capped at 256 KiB. Clinical narrative is 1–2,000 characters; ordinary prompts are 1–4,000 characters. NUL, bidi overrides, and unsafe invisible controls are rejected.

The browser exposes one textarea, one **Get guidance** action and one shared result region. Its semantic input router sends general requests to `/assist`; explicit clinical narratives first open current-revision structured review and are serialized to `/triage` only after that review. An ambiguous input gets one inline route choice for that revision. The router does not use exact prompt strings, prompt IDs or hashes.

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

After validation, the response is `text/event-stream`. Deterministic routes emit `stage`, then either `assessment_required` or `citation` + `card`, an optional `continuation` grant for eligible respiratory records, then exactly one `done`. The initial respiratory route never retrieves or runs the model. Broader non-respiratory model-assisted routes emit `job`, one or more `stage`, optional `citation` and `first_token`, `card`, optional `provisional`, then one `done`. Failure emits one `error`, then `done {"ok":false}`.

The card is allowlisted to: `outcome`, `finding`, `basis`, `nextAssessmentStep`, `matchedCriteria`, `missingFields`, `recorded`, `thresholdComparison`, `emergencyObservations`, `sourceRule`, `assistance`, `uncertainty`, `reviewState`, `recordedFacts`, and `inferredFacts`. Classifier severity, raw red flags, diagnosis, prescription, and model-authored actions are excluded. A `provisional` event may name the human-gated WHO class and protocol.

Pre-SSE failures are JSON: `400` invalid record, `409` narrative/structured conflict, `413` oversized body.

## `POST /triage/continue`

```json
{ "token": "opaque grant from an eligible deterministic respiratory result" }
```

The strict token-only request explicitly continues the server-owned record snapshot. Unknown, expired, foreign-owner, replayed, altered or ineligible grants fail before inference. Queue saturation releases the reservation so the same owner can retry; once inference owns the job, the grant is consumed. Success is SSE: `job`, one or more real `stage`/`citation` events and optional `first_token`, `card`, `provisional`, then exactly one `done`. No management plan is sent before confirmation.

Failures: `400` malformed/extra fields, `403 OWNER_MISMATCH`, `404 NOT_FOUND`, `409 USED` or `BINDING_MISMATCH`, `410 EXPIRED`, and the queue/recovery codes below.

## `POST /triage/confirm`

```json
{ "token": "opaque grant from provisional event", "decision": "CONFIRM" }
```

The decision is `CONFIRM` or `REJECT`. Grants are owner-, record-, class-, citation-, and policy-bound and expire after five minutes. Every decision consumes the grant; an identical replay and a decision flip are both rejected as `USED`. A confirmed response projects severity, cited immediate action and the complete eligible management plan only from the frozen protocol table. Failures: `403 OWNER_MISMATCH`, `404 NOT_FOUND`, `409 USED` or `BINDING_MISMATCH`, `410 EXPIRED`.

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
