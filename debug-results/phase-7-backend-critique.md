# Phase 7 Backend Critique

## Summary

The deterministic structured-danger boundary is the strongest part of the backend. It validates before runtime access, fails closed, keeps model prose from owning the seven safety atoms, and has good fixed-error HTTP behavior. The claim-bearing QVAC path is still blocked by absent evidence and prerequisites.

## Findings

### Fixed: timeout broke single-job serialization

`withTimeout` previously ran inside `withInferenceLock`. When the timer rejected, the queue advanced even though the underlying QVAC promise kept running. A second request could then reach an engine documented as single-job. Commit `503b7a3` reverses the composition: response timeout is outside the lock, so the underlying work owns the queue until settlement.

### Fixed: server was not localhost-only

`app.listen(port)` exposed the service on all interfaces on common Node platforms. Commit `354d773` binds production startup to `127.0.0.1` and strengthens response headers.

### High: imported broad classifier exceeds controlling scope

The QVAC branch still routes against 27 broad WHO classes and can assemble medicines and management plans, while the controlling PRD narrows support to pediatric respiratory review and denies diagnosis/prescription/treatment ownership. This must be reduced or remain explicitly non-claim-bearing.

### Medium: unknown process state is kept alive

Production registers `uncaughtException` and `unhandledRejection` handlers that log and continue. Continuing after an uncaught exception can preserve corrupt global model, queue, or store state. Prefer a supervisor-managed clean restart.

### Truthful block: no supported local runtime

`loadModelContract()` intentionally refuses startup because the 1,282,439,360-byte GGUF is absent. The RAG store is also empty. This is correct fail-closed behavior under the no-download/no-weight authorization, but it means no local QVAC completion, network-disabled end-to-end run, cancellation against real inference, or resident-model proof exists in this phase.

## Evidence

- Queue/HTTP/security: 13/13 pass.
- JSON/safety contract: 63/63 pass.
- SSE/frontend: 17 pass, 0 fail, 3 prerequisite skips.
- TypeScript: clean.
