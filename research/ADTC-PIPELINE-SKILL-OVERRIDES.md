# ADTC Pipeline Skill Overrides

**Prepared:** 2026-08-22
**Scope:** Entire conductor pipeline
**Mode:** Audit and handoff only
**Pipeline execution:** Not started or resumed by this document

## 2026-08-24 shared-MedPsy recovery addendum

This addendum is the current user-authorized override. Where it conflicts with the older clean-build rules below, follow the approved shared-MedPsy design and implementation plan:

- `docs/plans/2026-08-24-healthcare-retention-shared-medpsy-design.md`
- `docs/reviews/2026-08-24-shared-medpsy-document-and-blocker-review.md`
- `docs/plans/2026-08-24-shared-medpsy-healthcare-retention-implementation.md`

The project remains in healthcare under the working identity `Triage-0 ADTC`. Transparent application reuse is authorized from exact public Triage-0 commit `74424721bc75f564808eacce42d7f7f42676ae0f`, with a file-level provenance ledger and prior-hackathon disclosure required before import.

MedPsy-1.7B Q4_K_M is the only recovery candidate. The QVAC product and direct `llama.cpp` profiler must use the identical GGUF path and SHA-256. Direct `llama.cpp` remains load-bearing in the official scored and raw-evidence path; QVAC remains the disclosed local product runtime. No model search is authorized.

The older prohibition on importing Triage-0 without organizer approval and the older requirement that direct `llama.cpp` own product inference are superseded. Prior-work eligibility ambiguity is handled through truthful disclosure and provenance, not a false clean-build claim. Existing OLMo, MedPsy-lineage, clinical, Build, Postmortem, and PULSE evidence remains immutable.

Resumed Build must run legal/provenance first. It may not import application files until the manifest and license decision pass, and it may not enter Phase 2 without a truthful signed model decision backed by fresh MedPsy, human, and physical evidence.

## 1. Why the standard pipeline needs an override

The generic hackathon pipeline assumes a hosted web application, cloud credentials, sponsor SDK integrations, live URLs, and conventional frontend deployment. ADTC evaluates a public, credential-free, offline GGUF through direct `llama.cpp` on a constrained laptop. Applying the generic defaults literally would create unnecessary cloud dependencies and could weaken the central eligibility and engineering claims.

All pipeline rigor remains. Only the meaning of deployment, wiring, live testing, integration depth, proof, and emergency scope changes.

## 2. Global override contract

Every phase must read, in order:

1. the active ADTC brief;
2. `PULSE.md`;
3. `FORGE-INTAKE.md`;
4. this override document;
5. its normal upstream artifacts.

The following rules bind every phase:

- Real GGUF, real `llama.cpp`, real source records, and real profiler outputs only.
- No fake medical behavior, fake benchmark, mock inference, or placeholder evidence.
- If time is short, cut features. Do not substitute mocks.
- Exactly one canonical medical GGUF.
- Direct `llama.cpp` is load-bearing in both product and profiler paths.
- The minimum product must work with networking disabled.
- QVAC is optional support technology, never the canonical LLM.
- The public GitHub repository and credential-free GGUF are the required deployment surfaces.
- A hosted web application is not required.
- The physical target laptop is a release-test target, not a hosting target.
- Every metric is labeled by evidence tier and hardware.
- Raw-model quality and complete-product safety are assessed separately.
- No prior Triage-0 implementation artifact is imported without written approval.
- The 120-second video limit overrides generic demo durations.
- The hard deadline is 2026-08-25 07:45 Africa/Lagos.

## 3. Conductor override

### Entry

- Intel is complete and must not be redispatched.
- Warroom is paused and its state is stale relative to the user decision.
- The user has selected the Triage-0 clinical concept and Approach C.
- Forge has not started.

### Required behavior

- Reconcile Checkpoint 2 and the Warroom phase without restarting generative Warroom work.
- Preserve all user decisions from `FORGE-INTAKE.md` in the dispatch context and PULSE.
- Run every downstream phase at full depth unless a documented ADTC inapplicability applies or the user explicitly skips it.
- Treat `polish` as the conductor's normal auto-skip.
- Add an early submission-survival checkpoint before optional features consume the remaining schedule.
- Adapt `confirmed_urls` to repository, model artifact, report, and video URLs. Do not require Vercel.
- Keep all heavy model runs serialized.

### Forbidden

- Restarting idea generation.
- Marking Forge started before state reconciliation.
- Requiring cloud credentials for the canonical product.
- Allowing a phase to write conductor state directly.

### Exit

- Checkpoint 2 records the selected concept and approved project name.
- Warroom is complete or explicitly user-skipped in conductor-owned state.
- Forge receives both controlling scope documents.

## 4. Intel override

**Status:** Complete. Do not rerun.

Preserve the 61-source research brief, the full template-fork audit, the competitor registry, the official profiler analysis, the GPU-grant finding, the compute ladder, and the organizer-video framing.

Competitor facts must retain their evidence labels. A public repository or fork is not called a formal submission unless the gallery or entrant confirms it.

Future refreshes are limited to deadline-critical drift such as official rule updates, participant count, gallery publication, profiler revision, or competitor releases. They do not reopen product selection.

## 5. Warroom override

**Status:** User-paused and strategically superseded by direct concept selection.

- Do not resume generators.
- Do not score new ideas.
- Treat Triage-0's problem thesis with Approach C as the winner.
- Preserve competitor positioning: avoid generic medical chatbot framing and emphasize source-grounded offline clinical decision support on an 8 GB laptop.
- Use Checkpoint 2 only to formalize selection and name.

## 6. Forge override

### Objective

Turn the frozen intake into an exact ADTC-native PRD, architecture, observables contract, and cuttable plan.

### Mandatory architecture content

- Separate raw model plane from product plane.
- Same GGUF bytes, template, and model identity across both.
- Deterministic safety and source ownership outside generated prose.
- One active inference and bounded queue.
- Four threads, zero GPU layers, bounded context, and process-tree memory budget.
- Optional QVAC adapters with independent resource and value gates.
- Clean-rebuild default with approved-port branch only after organizer approval.
- Clean clone, offline, physical-laptop, and submission evidence flows.

### Emergency-mode correction

The generic Forge skill permits mocks and stubs under severe time pressure. That is prohibited here for scored inference, clinical behavior, citations, downloads, profiler output, and offline proof. Emergency mode must cut P1 and P2 features until a real P0 remains.

### Demo correction

The generic three-to-five-minute demo path is replaced by a maximum 120-second path.

### Proof correction

Proof means model hash, public artifact, profiler JSON, raw logs, source manifest, offline evidence, and labeled hardware results. It does not mean transaction hashes or deployed contracts.

### Exit gate

- Every P0 feature has an observable and a test.
- All resource budgets and cut conditions are explicit.
- No cloud or second-model dependency exists.
- Model selection remains a gated finalist decision if not yet closed.

## 7. Critique override

### Replace generic sponsor-depth scoring

ADTC has no sponsor SDK that must be called repeatedly. Integration depth is measured by:

- official-template root;
- strict metadata contract;
- credential-free downloader;
- public checksum-locked GGUF;
- direct `llama.cpp` product and profiler use;
- identical model hash and prompt behavior;
- full profiler compatibility;
- offline operation;
- constrained-hardware evidence;
- QVAC subordination.

### Required attacks

- raw-model hidden-prompt quality;
- visible reasoning and truncation;
- fabricated local resources;
- license and training lineage;
- app safety versus model-only score;
- 8 GB process-tree viability;
- physical-laptop credibility;
- clinical scope and claim strength;
- prior-work provenance;
- two-minute demonstrability;
- competitor differentiation.

Grid, wallet, contract, and on-chain checks are inapplicable unless Forge adds such a component, which is currently prohibited by scope.

## 8. URL preverification override

The conductor's generic URL preverification must validate these surfaces:

1. public GitHub repository;
2. public GGUF URL, including redirect behavior, content length, byte integrity, and checksum;
3. public GitHub `REPORT.md` URL;
4. official profiler repository and pinned revision;
5. public video URL when available.

A Vercel frontend URL and hosted backend URL are not prerequisites. The local app base URL may be `localhost` and is verified later through clean-start testing, not public reservation.

## 9. Build override

### Real-only definition

- actual GGUF bytes;
- actual direct `llama.cpp` process;
- actual source records;
- actual structured output and deterministic controls;
- actual offline operation;
- actual profiler commands and outputs.

### Build sequence

1. Submission contract and finalist-model decision gate.
2. Downloader, hash, metadata, and public artifact.
3. Direct runtime parity with the profiler.
4. Structured output and deterministic clinical controls.
5. Source records, retrieval baseline, and citation binding.
6. Local text UI and real stage events.
7. Optional QVAC adapters, one at a time.
8. Tests, evidence, report, and early Devpost checkpoint.

### Forbidden

- Mock model responses.
- Synthetic benchmark results.
- Fake citations or emergency resources.
- Cloud fallback.
- Copying prior Triage-0 code without approval.
- Keeping optional features that break the memory or schedule gate.

## 10. Debug override

Run full mode unless the conductor records an explicit user change.

Required debug domains:

- clean clone and dependency installation;
- downloader first run and second idempotent run;
- wrong checksum and partial download recovery;
- metadata schema and model-path drift;
- direct model load, prompt format, and template parity;
- visible `<think>` suppression and truncation limits;
- structured-output parser and malformed output;
- danger-sign, negation, abstention, mimic, off-domain, and injection cases;
- citation identifier validation and missing-source fail-closed behavior;
- cancellation, timeout, global lock, and process cleanup;
- network-disabled application start and complete flow;
- secret, egress, patient-text logging, XSS, and path traversal checks;
- model/app hash parity;
- platform labels for Apple, GitHub Actions, Lightsail if used, and physical laptop.

The generic test-to-source ratio is informative but cannot substitute for coverage of safety states and system boundaries.

## 11. Wire override

The critical connection graph is:

```text
public model URL
  -> download_model.sh
  -> exact GGUF path and SHA-256
  -> metadata.json
  -> direct llama.cpp runtime
  -> structured model output
  -> deterministic safety and evidence layer
  -> localhost UI

same GGUF
  -> official profiler
  -> submission.json
  -> REPORT.md
  -> Devpost Sperf, Seff, prompts, and claims
```

Optional branches are QVAC STT, TTS, or retrieval. Their failure must degrade only that capability.

Credential audit means proving canonical inference and model download need no credentials. Missing cloud credentials are not blockers. GitHub credentials are development credentials and may not be required by judges.

Integration proof is a model hash, source ID, profiler artifact, response trace, offline trace, or process measurement. It is not an on-chain transaction.

## 12. Verify milestone override

Maintain two scorecards:

1. **Raw model:** accuracy, safety free-form review, TPS, RSS, format, truncation, license, and reproducibility.
2. **Complete product:** offline flow, deterministic controls, citations, process-tree memory, cancellation, recovery, and UI observability.

ADTC kill-zone warnings include:

- wrong or inaccessible GGUF;
- hash mismatch;
- profiler incompatibility;
- OOM or crash;
- visible chain-of-thought;
- routine truncation;
- invented hotline, emergency number, dose, citation, or clinical fact;
- ungrounded product claim;
- network dependency;
- unsupported prior-work reuse;
- missing required Devpost material;
- unlabeled or misrepresented hardware evidence.

The generic deployment-URL warning is replaced by public repository and model-asset validation.

## 13. Design Forge override

The local application still requires a deliberate design pass. It is not a marketing landing page project.

Priorities:

- 1366 by 768 target-laptop legibility;
- self-hosted fonts and assets;
- obvious offline state;
- visible model identity and hash prefix;
- clear separation of current-request telemetry from profiler evidence;
- supported-scope and limitation messaging;
- danger, abstention, uncertainty, and source states that are visually distinct;
- actual progress stages, not decorative loaders;
- keyboard access and high-contrast clinical states;
- no cloud CTA, wallet UI, or generic web3 proof treatment.

The design may be visually strong, but the signature moment must be evidence and safe local inference. Logo work is secondary to proof readability.

## 14. Stress-test override

Run the full stress skill with these ADTC additions:

- repeated inference under four CPU threads;
- 8 GB cgroup or equivalent memory constraint;
- long and near-context-limit prompts;
- empty, malformed, overlong, multilingual, and injection inputs;
- negation and temporal qualifiers in danger signs;
- pediatric and medical-mimic cases;
- malformed or adversarial model JSON;
- local-resource hallucination traps;
- concurrent submit, double click, cancellation, and retry;
- model-process crash and supervised restart;
- repeated model load and unload where supported;
- QVAC cold load, warm use, unload, and absence;
- complete no-egress run;
- cold and warm latency;
- process-tree RSS leak detection;
- thermal soak on the physical target laptop;
- downloader interruption and corrupted cache recovery.

GitHub Actions or Lightsail can close Linux and memory checks. They cannot close the physical thermal gate.

## 15. Polish override

The conductor auto-skips Polish. Do not run it as a hidden extra phase. Its useful responsibilities are already assigned to Verify Milestone, Design Forge, Stress Test, Demo Rehearsal, and Package.

Standalone Polish may run only if the user explicitly requests it and enough time remains after submission survival is secure.

## 16. Deploy override

For this project, deployment means:

1. publish and verify the public GitHub repository;
2. publish and verify the credential-free GGUF artifact;
3. publish the report at a stable GitHub URL;
4. publish the video later in the pipeline;
5. optionally publish a static documentation page after all required gates.

Do not default a detected frontend to Vercel. Do not block because there is no public web app. Do not remove pipeline artifacts required by later phases from the local working directory. Public repository cleanup must preserve all organizer-required files, evidence, provenance, and licenses.

The README Try It path must teach a judge how to download, verify, profile, and start the localhost application.

## 17. Livetest override

Use hybrid artifact-plus-local mode, not hosted-web mode.

### Public tests

- repository URL works incognito;
- report URL works incognito;
- GGUF URL downloads without credentials;
- redirects, length, checksum, and resume behavior are correct;
- video URL works when available.

### Local tests

- clean clone;
- idempotent model provisioning;
- direct model response;
- official profiler execution;
- localhost UI start;
- full minimum clinical flow;
- same model hash across app and profiler;
- complete flow with no egress;
- exact-value assertions for deterministic safety and source states.

The absence of a Vercel URL is not a failure. Localhost is the product runtime by design.

## 18. Interrogate override

Run DEEP mode.

Add or adapt perspectives for:

- ML systems and constrained inference;
- healthcare safety and human factors;
- pediatric or frontline clinical scope;
- model and dataset licensing;
- organizer eligibility and prior-work provenance;
- Ubuntu x86 reproducibility;
- malicious prompt and local-resource hallucination;
- offline and privacy claims;
- African use-case authenticity;
- profiler and evidence integrity;
- skeptical judge comparison against public competitors;
- demo reliability under 120 seconds.

On-chain economic and wallet personas are marked inapplicable with reasons. Their slots should not distort the gate. False clinical or performance claims are P0 submission blockers.

## 19. Demo Rehearsal override

Rehearse the actual local sequence, not a public deployment:

1. show hardware and networking state;
2. show the model identity and preloaded status;
3. run one hard clinical case locally;
4. show deterministic safety and source evidence;
5. show profiler or committed raw evidence with the hardware label;
6. close on the African use case and reproducibility link.

The model may be predownloaded and preloaded for a 120-second video, but this must be disclosed. No target-laptop metric may be faked or borrowed from CI. The script needs an offline indicator, exact clicks, expected output states, timing budget, fallback footage, and a do-not-show list.

## 20. Demo override

- Hard cap of 120 seconds.
- Use the final application and same model hash as submission.
- Lead with the local problem and offline constraint.
- Prove direct local inference and safe clinical handling.
- Include model identity and honest hardware labels.
- Do not imply cloud execution.
- Do not show chain-of-thought, patient-identifying data, fabricated metrics, or an old Triage-0 interface as current work.
- Keep claims aligned with the report and Devpost form.

The generic social clip is optional and must not delay the required video.

## 21. Package override

Package for Devpost and the official template, not DoraHacks or an on-chain hackathon.

Required package contents:

- public GitHub repository URL;
- public `REPORT.md` URL;
- public video URL;
- project name and elevator pitch within limits;
- Devpost About story;
- actual Built With tags;
- Healthcare and Medical domain;
- two byte-identical prompts;
- final plain numeric `Sperf` and `Seff` from the same final run;
- screenshots and 3:2 thumbnail;
- team and eligibility confirmation;
- rules acceptance;
- provenance and license inventory;
- raw profiler and target-laptop evidence;
- final submission confirmation.

Omit contract addresses, explorers, sponsor bounty claims, wallet instructions, and public live-app requirements.

## 22. Verify preflight override

This is the terminal gate. It must verify:

1. clean public clone;
2. downloader twice;
3. exact bytes and SHA-256;
4. direct pinned `llama.cpp` load on CPU;
5. full required profiler command;
6. no OOM, crash, or thermal violation;
7. complete offline local text workflow;
8. app and profiler model/hash/template parity;
9. two prompts identical everywhere;
10. safety, abstention, citation, and source gates;
11. license and provenance completeness;
12. no placeholders, secrets, remote fallback, or hidden network dependency;
13. physical-laptop metrics correctly labeled;
14. report, README, screenshots, thumbnail, and video consistency;
15. all required Devpost fields staged and verified;
16. the final project is actually submitted before the deadline.

Generic sponsor-integration scoring is replaced by ADTC contract-depth scoring. Generic live-URL requirements are replaced by public-artifact and localhost-offline proof. Any open P0 downstream item blocks `SHIP IT`.

## 23. Pipeline-wide evidence ledger

Every phase must preserve:

| Evidence | Minimum contents |
|---|---|
| Model identity | URL, revision, filename, bytes, SHA-256, quantization, license |
| Runtime identity | `llama.cpp` revision, build flags, thread count, GPU layers, context |
| Host identity | CPU, RAM, OS, governor, ambient if thermal claim |
| Profiler | command, profiler revision, raw JSON, logs, exit code |
| Product | command, model hash, process tree, network state, request trace |
| Clinical | case ID, expected state, actual state, source IDs, human rubric |
| Provenance | code, model, dataset, source, and asset origin and license |
| Submission | exact prompts, numeric fields, URLs, timestamps, confirmation |

## 24. Pipeline exit definition

The pipeline has succeeded only when both of these are true:

- the public artifact is evaluator-compatible and competitive as a raw model;
- the complete local product is safe, source-grounded, offline, reproducible, and honestly presented.

A working UI alone is not success. A high profiler score with an unsafe or nonfunctional product is not success. A Vercel deployment is irrelevant to this definition.
