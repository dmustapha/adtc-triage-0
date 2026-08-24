# Phase 6 Security Results

## Verdict

PASS WITH CLAIM-LIMITED BLOCKS.

## Fixed under TDD

Commit `354d773`:

- Bound the production server to IPv4 loopback only.
- Removed inline-script permission from CSP.
- Added `object-src 'none'`, `frame-ancestors 'none'`, and `base-uri 'none'`.
- Added `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer`.
- Added two focused debug security tests.

Commit `503b7a3`:

- Kept the single-inference queue owned by underlying work after a client-facing timeout.
- Added a focused concurrency regression proving the next inference cannot start early.

## Scans and controls

- `npm audit --omit=dev --audit-level=high --json`: 0 vulnerabilities at every severity.
- Secret-pattern scan outside dependencies, Git internals, and historical evidence: 0 files.
- Tracked `.gguf`, `.part`, or `.partial`: 0.
- `config/release-public-key.pem` is a public verification key, not a private key.
- Perf rows contain timing, model ID, counts, and backend device. They do not contain patient text or prompt text.
- Browser dynamic values are escaped or assigned through `textContent`; 11 sink lines and 23 escape-call lines were reviewed.
- JSON body size is capped at 256 KB and case text at 2,000 characters.
- Debug routing is environment-gated and loopback-only.

## Remaining risks

- `style-src 'unsafe-inline'` remains because two imported inline style attributes are still present. Script execution does not receive the same exception.
- Global `uncaughtException` and `unhandledRejection` handlers continue serving after unknown errors. This is a reliability risk that should be replaced with supervised fail-fast restart before a clinical release.
- Live no-egress and injection suites require the absent ingested store/model and therefore remain unproved locally.

## Evidence

```text
node --import tsx --test tests/debug-inference-queue.test.ts tests/debug-localhost-security.test.ts tests/integration/http-validation.test.ts
# 13 pass, 0 fail

npm run typecheck
# exit 0

npm audit --omit=dev --audit-level=high --json
# 0 total vulnerabilities
```
