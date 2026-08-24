# Wire Report

**Status:** WIRED-WITH-DEGRADATION
**Date:** 2026-08-24
**Project:** Triage-0 ADTC
**Pipeline position:** After Debug confidence 77, before Verify Milestone

## Scope verdict

The user-authorized local claim-limited graph is wired. The browser, static UI, health contract, deterministic structured emergency policy, fixed citation binding, canonical identity contract, and immutable import provenance all executed successfully. This does not prove the supported all-absent QVAC path, grounding, raw profiler execution, clinical validity, physical Ubuntu performance, a signed model decision, or submission readiness.

## Project topology

| Component | Type | Entry point |
|---|---|---|
| Browser UI | Frontend | `public/app.html` |
| Localhost API | Express backend | `src/server.ts` |
| Structured danger policy | Deterministic domain | `src/triage/danger-observations.ts` |
| Protocol binder | Deterministic source domain | `src/triage/protocol-table.ts` |
| QVAC orchestrator | Local SDK service | `src/qvac/orchestrator.ts` |
| RAG store | Local data service | `src/rag/store.ts` |
| Canonical model contract | Local artifact | `config/canonical-model.json` |
| Provisioner | Setup script | `download_model.sh` |
| Raw profiler plane | Evidence producer | `scripts/medpsy-raw-profiler-v2/run-raw.ts` |
| Import provenance | Evidence ledger | `config/import-manifest.json` |
| Submission report plane | Evidence consumer | `REPORT.md` |

## Credential audit

- Required credentials: 0
- Resolved: 0
- Unresolved: 0
- Active mock flags: 0
- `.env` and `.env.local` are absent.
- The canonical downloader sends no authorization header.
- `HF_TOKEN` is optional and unused by the canonical connection graph; Wire did not inspect or resolve permanent credentials.

## Integration results

| Connection | Result | Executed evidence |
|---|:---:|---|
| UI to static server | PASS | `GET /app` 200; 10,295 bytes; patient input; no login or empty-state wall |
| UI to health | PASS | `GET /health` 200 with exact MedPsy identity |
| UI to deterministic SSE | PASS | `stage`, `citation`, `card`, `done`; `EMERGENCY`; deterministic retrieval |
| API to danger policy | PASS | Known emergency executed with zero QVAC/router/RAG/model boundaries |
| Policy to protocol binder | PASS | Fixed IMCI citation preceded the emergency card |
| Metadata to model contract | PASS | 27/27 focused identity, parity, contract, security, UI, and downloader-fixture tests |
| Provisioner to canonical GGUF | SKIPPED | Exact GGUF absent; no download authorized; fixture tests receive no live-evidence credit |
| QVAC to canonical GGUF | SKIPPED | Exact GGUF absent; no model/cache acquisition attempted |
| QVAC to RAG store | SKIPPED | Citation map and ingested store absent |
| Supported all-absent request to QVAC | SKIPPED | GGUF and store absent; no mock or deterministic substitute credited |
| GGUF to raw/profiler plane | SKIPPED | GGUF absent and external execution unauthorized |
| Provenance to runtime | PASS | 9/9 provenance tests plus 76/76 immutable import verification |
| Evidence to report | PARTIAL | Root `REPORT.md` remains the official template with placeholders and wrong domain |

Totals: 13 mapped, 7 passed, 1 partial, 0 failed, 5 exact prerequisite skips. All seven locally applicable critical connections passed. Fewer than half were skipped, so the result is degraded rather than blocked.

## Live response evidence

The bounded ephemeral server returned:

- Health: `residentModels=[]`, `chunks=0`, `ragLive=null`, and egress `{armed:false, strict:false, violations:0}`.
- Deterministic triage: HTTP 200 SSE, `EMERGENCY`, deterministic citation, zero QVAC boundaries.
- Resilience: malformed JSON returned 400; the next health request still returned 200.
- Security: CSP, `nosniff`, and `no-referrer` were present; focused production-loopback tests passed.

These empty runtime values are truthful prerequisite state, not sentinel failures. Wire did not reinterpret them as offline proof or resident-model proof.

## Judge first-visit evidence

`scripts/seed-demo.ts` does not exist, so no seed output was invented. The current local UI still has real content and visibly reports setup state.

- Screenshot: `output/playwright/wire-landing-claim-limited.png`
- SHA-256: `db1ec906a30fc48134976dcb0c86e1dd30e4fa17832a7e1e6e5332a26fd20232`
- Visible truths: `Browser online`, `Setup needed`, empty guideline store, and pre-run request evidence wording.
- The screenshot is UI/wiring evidence only, not model or clinical evidence.

## Advisory demo flow

The deterministic emergency `/triage` path passed end to end. It is advisory and claim-limited. The controlling QVAC demo flow remains unavailable because the canonical GGUF and ingested store are absent.

## Blockers and downstream recovery

1. Canonical GGUF: absent, and acquisition is unauthorized. Do not substitute fixtures or mocks.
2. QVAC/RAG: no ingested store or citation map. Do not claim grounding or offline inference.
3. Claim boundary: diagnosis-first classifications, medicines, dose bands, and management-plan rendering exceed the controlling PRD. Keep claim-bearing use removed pending revision and independent clinical review.
4. Report plane: `REPORT.md` still contains template placeholders and `coding_assistants`. Deploy/package must not present it as complete.
5. External evidence: run `32742482642` remains an immutable failed historical run, not a passing QVAC or profiler result.

## Conditional audits

- Privacy-contract audit: skipped. No FHE, ZK, encrypted mapping, or contract architecture exists.
- Cross-account isolation: skipped. There is no multi-user or per-account data model.
- Async completion latency: skipped. No external async completion pattern exists; the UI timer is presentation-only.
- Authorization gaps: none. The product is loopback-only and single-user; no persistent multi-user mutation endpoint exists.

## Verification

- Focused tests: 36 total, 36 pass, 0 fail, 0 skip.
- TypeScript: pass.
- Immutable imports: 76/76 pass.
- JSON: 8/8 parse.
- `git diff --check`: pass before final artifact write.
- Canonical GGUF: absent.
- Citation map: absent.
- `submission.json`: absent.
- Owned screenshot server PID 15292: stopped; port 3011 has no listener.

## Summary

- Components discovered: 11
- Connections mapped: 13
- Credentials audited: 0 required
- Integration tests: 7 pass, 1 partial, 5 skipped, 0 fail
- Demo flow: PASS for deterministic emergency path only
- Mock warnings: 0
- Top-level result: WIRED-WITH-DEGRADATION
