# Phase 2 Known-Risks Triage

## Dispositions

| Risk | Class | Disposition | Evidence or mitigation |
|---|---|---|---|
| No target-class Ubuntu 22.04 physical evidence | EXTERNAL | ACCEPTED, claim removed | User-authorized claim-limited scope forbids promoting Apple or CI evidence to physical proof. |
| No named clinical/content-rights reviewers | EXTERNAL | ACCEPTED, claim removed | Clinical review and submission-readiness claims remain absent. Existing provisional source rows continue to fail closed. |
| Canonical GGUF absent locally | EXTERNAL | ACCEPTED, explicit startup block | `TRIAGE0_NO_PREWARM=1 npm start` exits 1 with `Missing canonical model`, before listening or loading QVAC. No download is authorized. |
| QVAC/RAG store not ingested | STRUCTURAL | ACCEPTED, explicit skip class | Full suite names 22 store/citation-dependent skips. UI and server expose the empty-store condition; no fake inference is substituted. |
| Fresh-clone model-path contract | TESTABLE | CLEARED under claim-limited scope | Loader, downloader fixture, profiler-path, health identity, and missing-model fail-closed tests pass; real bytes remain unavailable by policy. |
| Failed remote run 32742482642 | HISTORICAL | PRESERVED | Debug does not mutate, rerun, tune against, or reinterpret the failed calibration evidence. |

Every Build risk has a truthful disposition. None is treated as passing external or clinical evidence.
