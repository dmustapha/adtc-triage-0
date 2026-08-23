# FOR[Dami]: Why Triage-0 Fits ADTC 2026

> For the complete file-by-file explanation of ADTC itself, read `docs/ADTC-CONTRACT-EXPLAINED.md` first.

## The one idea to remember

ADTC does not score the application process. It downloads one GGUF and runs that file directly through `llama.cpp`.

That changes both the architecture boundary and the provenance decision:

```text
Official ADTC template
└── MedPsy GGUF
    ├── official profiler scores quality, speed, and RAM
    └── direct llama.cpp powers the new clinical product
        └── optional QVAC adds supporting local capabilities
```

QVAC can stay because it is local, open-source, and useful. It cannot be the canonical LLM runtime because the organizer's evaluator never starts it. Direct llama.cpp should power both the official evaluation path and the product's reasoning path.

## Why the repository decision changed

The public rules do not expressly ban prior work, but an official community manager told another entrant that eligibility depended on the submitted project being built from scratch for this challenge. Triage-0 was built for the QVAC hackathon. Creating a new repository cannot reset that fact.

The safe path is:

1. Fork the official ADTC template into a new project repository.
2. Build the model, direct llama.cpp runtime, profiler loop, packaging, and minimal clinical workflow specifically for ADTC.
3. Ask the organizer whether disclosed Triage-0 components may be imported.
4. Import prior code only if written approval arrives.

This preserves eligibility safety without wasting model or profiler work. If reuse is approved, one canonical GGUF can still serve the official evaluator and the richer product.

## What is already valuable

- A 1.28 GB public medical GGUF.
- Offline community-health workflow.
- Deterministic WHO protocol decisions and dose citations.
- Abstention and danger-sign gates.
- Voice, translation, local retrieval, and polished UX.
- Real regression history rather than a last-day wrapper.

## What must change

- Add the official template root and exact metadata contract.
- Provide an idempotent, credential-free model downloader.
- Run the pinned profiler on Ubuntu 22.04 x86.
- Fix the fresh-clone offline model-path mismatch.
- Separate raw-model claims from application claims.
- Replace the old three-minute QVAC video with a sub-120-second ADTC video.
- Make the official profiler a continuous model-selection and acceptance gate.
- Ask for written approval before importing Triage-0 code or artifacts.
- If reuse is approved, add `PROVENANCE.md` with the exact prior commit and ADTC delta.

## What not to do

- Do not merge the cloud branch.
- Do not copy Triage-0 into a new repository and describe it as contest-created work.
- Do not call QVAC the official runtime.
- Do not claim that RAG or deterministic app logic improved profiler accuracy.
- Do not upgrade the SDK or fine-tune merely to look busy.
- Do not claim production clinical validation.

## Current evidence

The exact MedPsy Q4 file loads under the profiler's pinned llama.cpp build. On an Apple M1 CPU-only compatibility run it generated 21.93 tokens/sec with about 1.08 GiB maximum RSS. This is encouraging, but only the Ubuntu x86 run can support the final submission telemetry.

The public fresh clone typechecks. Its full test run is 119 pass, 1 fail, and 28 skips. The failure exposes a real contract mismatch between a remote default model URL and the test's local-offline expectation; the skips expose missing external WHO/RAG and speech assets.

## Strategic conclusion

Triage-0's clinical thesis should become the ADTC candidate. The submitted implementation should be ADTC-native unless the organizer explicitly approves prior-code reuse. Its winning message is that the official template, GGUF, llama.cpp, profiler, and standard-laptop budgets are the operating system of a private, auditable community-health workflow, while optional QVAC capabilities remain supporting technology.

## The component decision in plain language

The right answer is not “QVAC or ADTC.” It is a hierarchy:

1. ADTC's manifest, downloader, GGUF, direct llama.cpp runtime, profiler, and laptop limits form the spine.
2. A narrow clinical layer makes the model safe and useful for community health workers.
3. QVAC adds local speech and retrieval around that spine.

QVAC should act like the product's ears, voice, and evidence finder. It should not act as a second medical brain. The exact GGUF judged by ADTC must also be the model answering inside the product.

The existing two-pass model flow should become one direct, schema-constrained llama.cpp pass. Emergency severity, citations, treatment facts, and dose information should then be bound deterministically from verified sources. This improves latency and prevents the language model from inventing the most safety-sensitive facts.

The profiler and the application create different evidence. The profiler measures the raw model. The application demonstrates clinical usefulness and safety. A winning report must show both without pretending that app-level RAG or rules improved the raw-model score.

## What the Devpost screenshots changed

The form itself is now part of the engineering contract. It requires a direct GitHub URL to the Markdown report, exactly two test prompts, the selected problem domain, and plain numeric `Sperf` and `Seff` values. Those values cannot be improvised at submission time. They must come from the same frozen model, metadata, and final profiler run.

The form does not require a deployed web application. The canonical product should remain a localhost app that proves offline inference. The public repository and two-minute video cover the try-it-out and media surfaces, while a Vercel showcase would add work without proving the scored system.

## What happens to each feature

- Text triage, citation-first results, deterministic urgency, abstention, and a narrow source-backed plan are rebuilt as P0.
- QVAC speech-to-text, text-to-speech, and retrieval are P1 only after Ubuntu x86, memory, offline, and license tests.
- French and Spanish translation are P2 because clinical meaning must survive translation testing.
- QVAC LLM completion, P2P inference, cloud fallback, a second medical model, and Vercel as the canonical app are excluded.
- The 4B model is not automatically better. It must offset lower TPS and higher RSS with enough measured quality gain.
- `african_alpha_claim` is currently ambiguous. The template calls it an African Use Case Bonus claim, but the organizer FAQ ties African Alpha to meaningful African-language functionality. Keep it `false` for English-only Triage-0 unless the organizer clarifies or we validate a real African-language path.
- Current QVAC documentation lists Ubuntu 22+ and Linux x64 with CPU fallback. That makes QVAC support plausible on the ADTC laptop, but each native speech or retrieval adapter still has to pass `qvac doctor`, clean-host, offline, memory, and unload tests.

The complete decision and feature ledger is in `research/APPROACH-C-SCOPE-AND-SUBMISSION-PLAN.md`.

## Why our pipeline is different for ADTC

The usual pipeline treats deployment as putting a frontend on the public internet. ADTC treats deployment as making the repository and exact GGUF publicly reproducible while inference stays local. That changes the proof objects, but not the quality bar.

- Deploy publishes the GitHub repository and credential-free GGUF.
- Livetest performs a clean clone, direct model load, profiler run, and offline localhost workflow.
- Wire proves the chain from public model URL to checksum to metadata to `llama.cpp` to app to profiler to Devpost.
- Integration depth means the ADTC contract is load-bearing, not that many sponsor SDK calls exist.
- Stress includes process-tree memory, four-thread CPU, no-egress, malformed model output, and thermal soak.
- Interrogate uses healthcare safety, licensing, reproducibility, and judge-skeptic perspectives rather than wallet or on-chain personas.
- Demo proves local inference and labels every metric by hardware.
- Package fills the exact Devpost fields and omits irrelevant contract and explorer sections.

The most important deadline rule is also different. Emergency mode cannot replace the medical model or safety behavior with mocks. If time runs out, optional QVAC and UI features are cut until the remaining product is small, real, reproducible, and safe.

The full controlling handoff is `FORGE-INTAKE.md`. The phase-by-phase execution contract is `research/ADTC-PIPELINE-SKILL-OVERRIDES.md`.

## Why Forge stopped at Architecture

The fifth independent Architecture audit passed every structural check, the extracted strict TypeScript check, and all 24 runnable tests. It still rejected five evidence contracts because they could let the system claim stronger proof than it actually observed: generic finalist-gate producers, incomplete transactional rollback, conflicting physical/offline evidence ordering, a builder-declared organizer trust key, and a shutdown test that did not prove restart suppression.

This is a useful stop, not lost work. The PRD and most of the Architecture are strong; the remaining question is whether to spend another tightly bounded repair on proof plumbing or explicitly narrow those claims to `unavailable` until Build can supply real artifacts. The conductor correctly prevented Plan and Build from inheriting unverifiable promises.

## What the pre-Build phases ultimately decided

Forge is now complete, and Critique confirms we should start implementation rather than keep revisiting the blueprint. The key distinction is between **Build readiness** and **release readiness**: the architecture is ready to implement, while model quality, target-laptop behavior, source review, public report content, and video proof can only become real during Build and release work.

The first Build task is therefore not the UI. It is the raw-model truth gate between the 1.7B Q4 and 4B Q4 finalists. If neither model passes blinded medical/safety/format/resource checks, deterministic application rules cannot turn that into a passing raw-model submission. Once one model passes, its immutable URL, bytes, checksum, and embedded template become the single contract shared by downloader, app, tests, profiler, report, and demo.

URL Preverification confirms the public foundation exists: both finalist files and the pinned profiler are reachable without credentials. It also exposes the honest release gap: the public repository is still behind local work, `REPORT.md` is still the template, no canonical model is selected, and no video exists. Build and packaging must close those gaps; a hosted frontend is still unnecessary.

## Why Build stopped at the finalist truth gate

Build implemented the Phase 1 evidence machinery before any UI: 100 frozen cases, a fixed rubric and split, immutable producer commands, host labels, raw-output paths, and content hashes. Both MedPsy model cards publish Apache-2.0 weights and identify Qwen backbones, but they also describe a health corpus that is not yet public and medical-QA prompts without an itemized dataset, rights, and license ledger.

That gap matters because permission to redistribute model weights is not the same as evidence that every training source is suitable for a medical submission. The frozen F-08 gate therefore rejected both candidates before raw inference. Triage-01 selected no GGUF, created no model-decision artifact, and did not begin UI work. Build can resume only with stronger MedPsy lineage evidence or an explicitly reopened model search whose candidate passes the complete raw gate.

## Why the OLMo result had to be rerun

The first OLMo command solved a hang by adding `-no-cnv`, but that flag also disabled the model's embedded chat template. Instruct models are trained to recognize a particular conversation envelope; testing the bare prompt is therefore not the same behavioral test. We withdrew that verdict instead of defending a convenient failure.

Pinned llama.cpp documents the correct one-turn combination as `--jinja --single-turn -p`: apply the GGUF's immutable template, process one user turn, then exit. Tests first proved the old flags were still live, and only then did the producer change. The corrected run kept every scientific control unchanged and produced 100 auditable rows.

The correction did not save OLMo. With its real template applied, it still made unsafe clinical statements, repeated or validated invented resources, followed prompt injections, exposed reasoning, produced no valid structured JSON, and routinely exhausted the 128-token budget. That is the point of a fail-closed truth gate: implementation correctness makes the negative result trustworthy; it does not obligate us to select the model.

## Why the final recovery uses OLMo-2 7B

The rejected OLMo run used the 1B model. The final recovery does not reinterpret that evidence; it evaluates a different, larger 7B artifact from the same transparent Ai2 family. The reason is narrow: the 7B model preserves the public Base-to-SFT-to-DPO-to-RLVR training chain and official Apache-2.0 GGUF while offering materially more behavioral capacity.

Before inference, we froze the exact 4.47 GB file identity, verified 11 content-addressed lineage records, and generated a producer manifest that hashes the unchanged corpus, rubric, generation policy, raw producer, evidence producer, and workflow. This prevents result-dependent tuning: once the first response exists, the test inputs and command semantics cannot quietly change. The 7B model still earns nothing unless all 100 raw cases, two human reviews, and the physical 8 GB laptop gates pass.

## Why the final 7B recovery stopped

The remote workflow itself worked: it downloaded the exact 4.47 GB file, verified its byte count and SHA-256, ran all 100 frozen prompts with the locked CPU command, deleted the weights, and returned only small evidence files. This separates infrastructure success from model-quality failure.

The model failed the unchanged contract decisively. None of its 100 responses was valid required JSON; 83 appeared token-truncated; and specific cases downgraded danger signs, asserted unknown facts, invented or validated local resources, followed injected instructions, exposed reasoning, and mishandled the medical-mimic case. Because any one of these gates is fatal, later human review and laptop profiling could not rescue the candidate and were intentionally not credited.

No canonical model decision was created. The responsible next move is a conscious requirements revision or submission pivot, not another unapproved candidate search or UI work built on an unsafe model.
