# Debug Report

## Executive Summary

- Generated: 2026-08-24T19:23:01Z
- Mode: full, conductor-dispatched resume
- Scope: claim-limited local verification only
- Confidence score: 77/100
- Recommendation: PROCEED WITH WARNINGS. Recorded demo format is `recorded`, so the applicable threshold is 65.
- Final suite: 286 total, 264 pass, 0 fail, 22 exact prerequisite skips, 0 cancelled
- Security: 0 critical, 0 high, 1 documented medium
- Unresolved: diagnosis-first medicine and management-plan rendering exceeds the controlling PRD claim boundary

The local deterministic and evidence-contract surface is coherent. This report does not claim a supported QVAC clinical run, named clinical review, physical Ubuntu proof, signed model decision, or submission readiness.

## Baseline Snapshot

- Test-to-source ratio: 0.7292, 35 test files / 48 TypeScript source files, PASS.
- Initial Build baseline was 277 total, 255 pass, 0 fail, 22 skips.
- Final Debug suite is 286 total, 264 pass, 0 fail, 22 skips.
- `npm run typecheck`: pass.
- `npm run verify-import-manifest`: 76 completed imports verified from `74424721bc75f564808eacce42d7f7f42676ae0f`.
- `npm run test:e2e`: corrected stale path, then 1 pass, 0 fail, 3 exact store-dependent skips.
- `npm start` fails closed before listening because the canonical GGUF is absent. No download was authorized.
- Coverage instrumentation is not configured. Pass counts are not misreported as line coverage.

## Known Risks Disposition

See `debug-results/phase-2-known-risks-results.md`.

- Physical Ubuntu evidence and named review: accepted only as removed claims.
- Canonical GGUF and QVAC/RAG store: explicit prerequisite blocks, never mocked.
- Fresh-clone path behavior: loader, fixture downloader, path parity, health identity, and missing-model fail-closed tests pass.
- Failed run `32742482642`: preserved and revalidated through 39/39 evidence-contract tests.

## Integration Test Results

See `debug-results/phase-3-local-integration-results.md`.

- 38 integration tests: 17 pass, 0 fail, 21 exact model/store skips.
- Ephemeral local server processes were closed after each check.
- `/health`, `/app`, and deterministic emergency `/triage` SSE work without crossing QVAC boundaries.

## E2E Test Results

See `debug-results/phase-4-e2e-results.md`.

- Four Debug E2E/UI-claim tests pass.
- Pre-run copy no longer claims completed inference or no-network proof.
- Browser reachability is labeled separately from server egress proof.
- A configured model name is not rendered as resident-model proof.

## Edge Case Results

See the Phase 5 files under `debug-results/`.

- Malformed, oversized, missing, and invalid structured requests fail before model access.
- User-controlled HTML is escaped or assigned with `textContent`.
- Mock scan found no available real dependency hidden behind a mock.
- Model-dependent injection, grounding, and no-egress flows remain exact prerequisite skips.

## Security Audit Results

See `debug-results/phase-6-security-results.md`.

- Production server now binds to `127.0.0.1`.
- CSP, frame, object, base, content-type, and referrer boundaries were hardened.
- Timed-out inference no longer releases the single-job queue before underlying work settles.
- Production dependency audit: 0 vulnerabilities.
- Secret, tracked-weight, project-weight, QVAC-cache weight, and partial-file scans: 0 findings.
- Medium: unknown process errors are logged while the server continues; supervised fail-fast restart remains preferable for a clinical release.

## Senior Dev Critique

See the Phase 7 backend and frontend reports.

- Fixed: localhost exposure, timeout queue leak, premature run/network claims, false resident-model proof, stale diarrhoea seed, invented GPU label, and visible 27-class claim.
- Unresolved MUST-FIX for claim-bearing use: the imported card still renders named classifications, medicines, dose bands, and a management plan beyond the narrowed PRD claim.
- This unresolved behavior keeps submission-readiness and validated-clinical-workflow claims removed.

## Fix Round Results

| Finding | Fix | Verification |
|---|---|---|
| Server listened on all interfaces | Explicit IPv4 loopback bind | 12/12 initial security checks |
| Browser response hardening incomplete | CSP/frame/object/base/content/referrer headers | Same focused security checks |
| Timeout advanced queue early | Timeout moved outside lock ownership | 13/13 queue/HTTP/security checks |
| UI made premature runtime claims | Health-driven, conditional proof copy | 4/4 Debug E2E/UI tests |
| UI conflated reachability and egress | Browser online/offline wording; guard owns on-device proof | 4/4 Debug E2E/UI tests |
| Visible scope/runtime labels drifted | Respiratory seed; QVAC 0.13.3 wording; removed GPU/27-class claims | 38 total, 35 pass, 3 exact skips |
| `test:e2e` targeted a missing file | Corrected to `tests/integration/server.test.ts` | 1 pass, 0 fail, 3 exact skips |
| Imported-file hashes drifted after fixes | Regenerated and independently verified 76-entry manifest | 9/9 provenance tests |

## Final Snapshot

- `npm test`: 286 total, 264 pass, 0 fail, 22 skips.
- `npm run typecheck`: pass.
- `npm run verify-import-manifest`: 76/76 pass.
- Focused historical/product/raw evidence: 39/39 pass.
- Tracked JSON: parse pass. Workflow YAML: 6/6 parse pass.
- `git diff --check`: pass.
- No tracked/project/QVAC-cache GGUF, `.part`, or `.partial` files.
- No secret-pattern findings outside excluded dependency/history paths.
- Published evidence head `a366077` remains in HEAD ancestry.

## Unresolved Items

1. `UNRESOLVED-BUG`: diagnosis-first classification, medicine, dose, and management-plan rendering exceeds the controlling PRD. It is not accepted for claim-bearing use.
2. `INFRA-BLOCKED`: canonical GGUF and ingested QVAC/RAG store are absent by current authorization. Real QVAC, grounding, offline-inference, and cancellation proof is unavailable.
3. Claim gates remain absent: sealed holdouts, named review, physical target evidence, submitter identities, signed model decision, and submission readiness.

## Confidence Score Justification

Start at 100. Deduct 8 for one unresolved bug, 5 for one infrastructure block, 3 for one security-medium finding, and 10 because the unresolved claim-boundary issue is MUST-FIX for claim-bearing use. Final: 74. Add 3 because all deterministic safety, security, provenance, historical-integrity, and available E2E checks are green with zero unexplained failures. Final confidence: 77.
