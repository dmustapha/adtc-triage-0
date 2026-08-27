# Triage-0: offline supervised WHO assessment

Triage-0 is a local healthcare review tool for trained or supervised community health workers. It combines deterministic pediatric respiratory rules, local WHO retrieval and a bounded MedPsy workflow on an 8 GB laptop. Structured observations control escalation. Model output cannot diagnose, prescribe or override the fixed safety policy.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![QVAC SDK](https://img.shields.io/badge/QVAC_SDK-0.13.3-111827)](https://docs.qvac.tether.io/reference/release-notes/v0.13.x/)
[![Tests](https://img.shields.io/badge/latest_full_gate-574%2F574-brightgreen)](#testing)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

This is an offline localhost product. There is no hosted inference service.

## What is Triage-0?

Frontline health workers often operate with weak connectivity, limited hardware and strict privacy constraints. Triage-0 presents one visible local workflow: one textarea, one **Get guidance** action and one shared result region. It routes internally without exposing assessment/model modes:

1. Explicit clinical narratives open a compact structured review. Emergency and respiratory decisions remain deterministic; eligible records may explicitly continue to provisional WHO classification and a human-confirmed, complete cited source plan.
2. General questions use the original bounded two-pass MedPsy path and render their validated answer in the same result region.

Both internal routes share one serialized QVAC inference queue. Ambiguous text gets one inline route choice for that input revision only. The product uses one checksum-locked GGUF and makes no inference-time network calls after startup prewarming.

## Why it is different

- **Clinical authority is explicit:** recorded observations and fixed policy control emergency escalation.
- **Respiratory thresholds are computed, not generated:** 2 to 11 months uses 50 breaths/minute or more; 12 to 59 months uses 40 breaths/minute or more.
- **Model assistance is subordinate:** MedPsy may support a supervised review but cannot change a deterministic public finding.
- **Source actions require confirmation:** eligible respiratory records require an explicit continuation first; provisional WHO classes do not unlock the complete frozen, cited management plan until the same browser owner confirms the exact record.
- **Ordinary prompts are genuine:** general input runs a 1,024-token reasoning pass, then a 512-token schema-constrained extraction and deterministic validation.
- **Everything runs locally:** QVAC SDK 0.13.3 loads MedPsy and performs semantic WHO retrieval on the development machine.
- **The official evidence path stays separate:** pinned direct `llama.cpp` uses the identical model bytes for participant profiling and prompt evidence.

## Screenshots

Task 11 Playwright passed 58/58 behavioral assertions across desktop, 375-by-812 and 320-pixel viewports. Retained current PNGs cover desktop provisional and confirmed pneumonia, desktop broad mhGAP provisional, two desktop lifecycle-regression states, and confirmed pneumonia at 375 by 812. The 320-pixel viewport has browser measurement and trace coverage, not a retained PNG. These ignored local artifacts are not linked or presented as release proof because publication remains a separate explicit action. The older tracked split-mode screenshots are no longer presented as current proof.

## How it works

```text
Browser on 127.0.0.1
  |
  +--> One textarea + Get guidance --> Input router
         |
         +--> Explicit clinical facts --> Structured review
         |      |
         |      +--> Emergency and respiratory policy --> Public result
         |      |
         |      +--> Eligible explicit continuation
         |              |
         |              v
         +--> General prompt --> Shared bounded FIFO queue
                              |
                              v
                       QVAC SDK 0.13.3
                         |           |
                         v           v
                  MedPsy GGUF    WHO HyperDB
                         |           |
                         +-----+-----+
                               v
                    Provisional classification
                              |
                     Human confirmation
                              |
                 Complete frozen WHO source plan

Same GGUF bytes --> pinned direct llama.cpp --> official profiler evidence
```

### Authority order

The browser routes text by general semantic rules, never by exact prompt strings, IDs or hashes. Explicit facts are reviewed before the browser serializes the strict clinical API record. The server validates that record before allocating QVAC work. Any recorded emergency observation returns an emergency result immediately. Missing, conflicting or unsupported inputs fail closed. Complete supported respiratory records use the exact age threshold and return that deterministic result before any inference. Eligible fast-breathing, chest-indrawing and complete below-threshold records enter the native queue only after the worker explicitly continues. MedPsy may then propose a reconciled WHO class; only one-use human confirmation reveals the complete deterministic cited source plan. General prompts use `/assist` internally and render in the same shared region.

### Model and source identity

| Item | Frozen value |
|---|---|
| Model repository | `qvac/MedPsy-1.7B-GGUF` |
| Revision | `fd4cecc90c2de8dce4b112795456a54be9c59363` |
| File | `medpsy-1.7b-q4_k_m-imat.gguf` |
| Size | `1,282,439,360` bytes |
| SHA-256 | `41ee947d9cce72ec657577219fd1798fabeabf0d832217fe23c9d6d3d18d5880` |
| Product runtime | QVAC SDK `0.13.3` |
| Official runtime | direct `llama.cpp` revision `c8ade30036139e32108fee53d8b7164dbfda4bee` |
| WHO IMCI source | 80 pages, SHA-256 `d10fd1d040bdbdb6db4254b8095e1d1722d0a3d2f80c3651b3003301a8a6959f` |
| Citation map | 994 entries, SHA-256 `b3dbe721df0cad19f84e88cbfd82c7e5738ac4becd26f0249b33c865534fbccf` |

The GGUF, WHO PDFs and generated citation map are downloaded or regenerated locally. They are ignored by Git.

## ADTC integration proof

The official ADTC repository contract is load-bearing:

- `metadata.json` freezes the healthcare domain, model identity and exactly two participant prompts.
- `download_model.sh` provisions the anonymous immutable GGUF, verifies size and SHA-256, and remains idempotent.
- `submission.json` records the full participant profiler run on the actual Apple development host.
- Direct CPU-only `llama.cpp` uses four threads and zero GPU layers for official evidence.
- QVAC remains a separate product plane over the same model bytes.

Measured Apple development evidence is reported in [REPORT.md](REPORT.md). It is not organizer-audited Ubuntu performance.

## Testing

The complete serialized suite covers policy boundaries, schema validation, HTTP/SSE behavior, queue ownership, cancellation, timeouts, prompt validation, confirmation binding, QVAC execution, downloader behavior and browser contracts.

```bash
npm run typecheck
npm test
npm run verify-import-manifest

# Fresh Task 12 release gate:
# 574 tests passed, 0 failed, 0 skipped
# 76 imported files verified against Triage-0 commit 74424721bc75f564808eacce42d7f7f42676ae0f
```

Fresh headed-Chrome acceptance also covered desktop, 375-by-812 and 320-pixel layouts. It recorded zero console errors, zero warnings, no horizontal overflow and no visible interaction target below 44 pixels.

## Try it locally (15 to 30 minutes)

The first setup downloads a 1.28 GB model and two checksum-locked WHO documents. Download time depends on the connection. Inference is local after setup.

```bash
git clone https://github.com/dmustapha/adtc-triage-0.git
cd adtc-triage-0
npm run setup:local
npm start
```

Open `http://127.0.0.1:3010/app` after the health endpoint reports ready:

```bash
curl http://127.0.0.1:3010/health
```

### Suggested review cases

1. Select **English example**, choose **Get guidance**, review the extracted record, then choose **Get guidance** again. Verify `32/min is below 40/min`; explicitly continue, review the provisional class and confirm it to inspect the complete cited plan.
2. Mark **Cannot drink or breastfeed** present and verify the deterministic emergency route completes without model assistance.
3. Paste submitted Prompt 1 manually into the same textarea and verify it does not invent a respiratory rate.
4. Paste submitted Prompt 2 manually into the same textarea and verify it says the checklist must be completed before model-assisted review.
5. Cancel an active job, edit the input and retry.

Do not start a second server or ingest worker. The native WHO store has single-writer ownership.

## API reference

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health` | Report model, RAG, egress and queue readiness |
| `POST` | `/triage` | Return a deterministic respiratory result or run a broader supervised assessment over SSE |
| `POST` | `/triage/continue` | Explicitly continue an eligible respiratory result through local WHO retrieval and provisional classification |
| `POST` | `/triage/confirm` | Confirm or reject an owner-bound provisional result |
| `POST` | `/assist` | Run a bounded ordinary prompt over SSE |
| `DELETE` | `/jobs/:id` | Cancel an owned queued or active job |
| `GET` | `/perf-log` | Read bounded local product telemetry |
| `GET` | `/perf-log.csv` | Read the same telemetry as CSV |

See [docs/API.md](docs/API.md) for request schemas, event order, ownership and recovery codes.

## Tech stack

| Layer | Technology |
|---|---|
| Browser interface | HTML, CSS and accessible vanilla JavaScript |
| Local server | Node.js 22, TypeScript, Express |
| Validation | Zod 4 |
| Product inference | QVAC SDK 0.13.3, MedPsy GGUF |
| Retrieval | QVAC embeddings and native HyperDB store |
| Official evidence | Pinned direct `llama.cpp`, CPU-only |
| Clinical sources | WHO IMCI Chart Booklet and mhGAP |
| Tests | Node test runner, jsdom and real local runtime gates |

## Project structure

```text
public/                 Browser application
src/http/               Sessions, SSE and request ownership
src/prompt/             Two-pass ordinary prompt workflow
src/qvac/               Runtime, queue, egress and telemetry adapters
src/rag/                WHO ingestion and retrieval store
src/triage/             Clinical records, policy and confirmation
config/                 Frozen runtime, prompt and source contracts
data/                   Local protocol and citation-map targets
scripts/                Setup, evidence and verification tools
submission/             Submitted-prompt and profiler evidence
tests/                  Unit, integration and real-runtime tests
```

## Privacy and safety boundaries

- The supported server binds to `127.0.0.1`.
- Strict egress blocking is armed after startup prewarming.
- Patient narratives are not persisted by the application.
- Internal reasoning is never returned through the public API.
- The initial respiratory result excludes classifier severity, diagnosis, prescriptions, medicines, doses, treatment and any model-authored plan.
- After explicit continuation and human confirmation, the app may display only the complete deterministic plan frozen in the cited WHO protocol table; model prose never authors its actions or doses.
- A below-threshold respiratory finding does not rule out illness or replace clinical judgment.
- This prototype is for research, education and supervised review. It is not clinically validated medical software.

## Reproducibility and evidence

- [Technical report](REPORT.md)
- [Prior-work provenance](PROVENANCE.md)
- [Local API contract](docs/API.md)
- [Domain guide](DOMAIN-GUIDE.md)
- [Submission contract](metadata.json)
- [Generated participant profiler result](submission.json)
- [Submitted-prompt evidence](submission/profiler/)

The exact submitted prompts match across local metadata, prompt policy, report and generated profiler output. The already-completed Devpost entry cannot be independently exported after submission, so authenticated archival parity remains user-attested. The existing video predates this restored workflow and is not presented as current proof.

Submission identity is complete and consistent across `metadata.json` and `submission.json`. The ADTC Team ID is the verified Devpost project slug `triage-0`; the submitter name, registered email and GitHub handle were supplied and confirmed by the participant.

Built for the [Africa Deep Tech Challenge 2026](https://adtc-2026.devpost.com/) Laptop LLM Challenge.

## License

Repository code is available under the [MIT License](LICENSE). Model, WHO source and imported-code licensing are recorded separately in [PROVENANCE.md](PROVENANCE.md) and [REPORT.md](REPORT.md). This repository does not relicense model or WHO document bytes.
