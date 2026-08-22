# Africa Deep Tech Challenge 2026 Research Brief

Generated 2026-08-22. Research depth 10. Admiralty notation: A1 means authoritative and corroborated, A2 means authoritative single source, B2 means first-party participant/model artifact, and C3 means an unverified public claim.

## Executive Overview

**BOTTOM LINE:** This is a model systems contest, not an app contest. Accuracy carries 50 percent of the base score, throughput 30 percent, efficiency 20 percent, and thermals can remove 10 points. The winning move is a small, license-safe GGUF whose model-only behavior is measurably better for one African problem, then a minimal workflow that makes that capability legible.

**EVIDENCE:** The official rules require llama.cpp, GGUF, offline inference, a public template repository, a credential-free download script, no more than 8 GB RAM, and exactly two participant prompts in metadata. The current profiler fixes generation reference throughput at a provisional 15 TPS and scores efficiency against a 7 GB peak-RAM budget. [A2: Devpost](https://adtc-2026.devpost.com/) [A2: rules](https://adtc-2026.devpost.com/rules) [A2: profiler](https://github.com/Africa-Deep-Tech-Foundation/adtc-profiler)

**CONFIDENCE:** High for eligibility, artifacts, and evaluator mechanics. Medium for final score arithmetic because organizer pages conflict on bonuses and labels. Low for total competitor density because the official gallery is unpublished.

**SO WHAT:** Start with a no-training, three-model serialized bake-off. Fine-tune only if the best baseline has a measured, repairable model-only quality gap. Do not spend the remaining deadline on UI, broad RAG, or a 7B model that risks OOM and heat.

The Gate 1 deadline is 2026-08-25 06:45 UTC, equivalent to 07:45 in Lagos. Teams may have one to three legally adult residents of eligible African countries. The standard target is Ubuntu 22.04, x86-64 Intel Core i5 10th to 12th generation or Ryzen 5 3000 to 5000, 8 GB DDR4, integrated graphics, and SSD. [A2: organizer challenge page](https://africadeeptech.org/challenge-2026/)

## Demo Video Requirements

**BOTTOM LINE:** Produce a maximum two-minute recorded explanation of the solution and development journey. Use the first 30 seconds to prove offline execution and the next 60 seconds to show one locally specific task plus profiler evidence.

The public rules require screenshots or short clips showing the build in action and a video no longer than 120 seconds. They do not publish a required host, codec, resolution, or aspect ratio. The submission form is behind the registered Devpost flow, so package must recheck accepted hosting and required fields before upload. [A2: Devpost overview](https://adtc-2026.devpost.com/)

## Submission Form Fields

Confirmed or directly implied fields are project name, project story, public GitHub repository, demo video, visual proof, primary domain, self-reported Sperf, and self-reported Seff. Repository requirements add `metadata.json`, `download_model.sh`, `REPORT.md`, `submission.json`, and a public GGUF URL that downloads without credentials. [A2: template](https://github.com/Africa-Deep-Tech-Foundation/adtc-2026-submission-template)

The exact Devpost form remains an open preflight item because its manage URL requires registration. Do not invent values. Confirm team ID semantics because the template issue tracker and FAQ have used different terms.

## Disqualifiers

**BOTTOM LINE:** The fastest route to disqualification is operational: wrong metadata, gated weights, networked inference, OOM, or sandbox crash.

- Ineligible residency, age, venture age, funding, commercialization, or team size.
- Non-public repository or failure to use the approved template.
- Non-GGUF model or runtime other than llama.cpp.
- Network access during inference.
- More than 8 GB RAM, OOM, or sandbox crash.
- Placeholder or invalid metadata, wrong domain, or other than exactly two participant prompts.
- Download script that needs credentials or fails to place the model at `_runtime.model_path`.
- Missing Gate 1 deadline.
- Uncited dependencies or non-original work.

Treat chat-template failure and pinned llama.cpp incompatibility as practical disqualifiers even if the rules use different language. [A2: official rules](https://adtc-2026.devpost.com/rules)

## Prizes and Schedule

Cash awards are $8,000 first, $4,000 second, $3,000 third or Best Integration, and $1,500 Best African Use Case or Best Localisation. The label mismatch is unresolved, but the published cash pool is $16,500. Up to ten finalists receive $250 GPU credits and up to twenty semifinalists receive $50 GPU credits. The organizer advertises a direct pathway into the Africa AI XPrize. [A2: Devpost](https://adtc-2026.devpost.com/) [A2: organizer](https://africadeeptech.org/challenge-2026/)

## Judging Criteria and Score Mechanics

`Stotal = 0.50*Sacc + 0.30*Sperf + 0.20*Seff - Pthermal`.

- Accuracy and quality: 50 percent, combining automated benchmarks and qualitative hidden-prompt review.
- Performance: 30 percent. The current profiler uses `100 * actual_generation_TPS / 15.0` with the provisional reference value.
- Efficiency: 20 percent. `100 * (7 GB - Peak RAM) / 7 GB`.
- Thermal: minus 10 if measured temperature reaches 85 C or throttling is flagged.
- African use case: Devpost says up to 10 extra points, while another organizer surface uses different bonus wording.

The practical Pareto target is above 15 generation TPS, below 3 GB peak RSS, no thermal event, and a statistically defensible quality improvement on both generic and localized held-out prompts. Accuracy dominates. A fast weak 0.5B model or accurate near-OOM 7B model is unlikely to win overall.

## Profiler Deep Dive

**BOTTOM LINE:** Run the exact current profiler, pin its commit, and preserve raw results. Do not compare Apple M1 throughput or community benchmarks to official x86 scores.

At inspected commit `ac2e137`, the profiler forces CPU inference with `-ngl 0`, defaults to ARC Easy 50 for accuracy, uses `n_ctx=2048`, and benchmarks 512 prompt tokens plus 128 generation tokens. The current accuracy path uses `llama-cpp-python` in process. Memory and temperature sampling wrap throughput, with accuracy run afterward. A participant accuracy failure can degrade to an empty result, while audit mode exits nonzero. [A2: profiler repository](https://github.com/Africa-Deep-Tech-Foundation/adtc-profiler)

The Docker build pins llama.cpp b10175 and disables AVX, AVX2, FMA, and native architecture flags for portability. Native builds can be faster, so Docker and native numbers are not interchangeable. The present thermal flag is inferred from measured temperature at or above 85 C rather than a kernel-reported throttle event. Record both temperature and available OS throttle signals in our own report.

Known ambiguity: the FAQ says participants need not run or submit accuracy, while the profiler README encourages a complete participant report and warns missing accuracy may score zero. Safest action is a full `submission.json` with accuracy.

## Workshop Signals

Organizer programming reinforces four preferences:

1. Oji Udezue's Last Mile of AI session emphasizes a real problem and adoption path, not a benchmark-only demo. [A2: update](https://adtc-2026.devpost.com/updates/45210-watch-knowledge-session-recording-the-last-mile-of-ai-designing-for-real-world-constraints)
2. Alex Tsado's GPU access session acknowledges compute scarcity and confirms training support is optional.
3. Dapo Sosanya's decentralized wireless mesh session makes resilient system pairing legible, provided the model still works and scores in isolation.
4. Quintin Makwe's low-rank compression session signals that compression beyond routine quantization is welcome if accuracy survives. [A2: update](https://adtc-2026.devpost.com/updates/45603-attend-adtc-2026-knowledge-session-low-rank-compression-of-neural-network-weights-to-optimize-for-local-models)

## Network and Infrastructure

No blockchain, cloud service, or deployed network is required. The evaluated model must work with network disabled. Any app, index, corpus, or agent runtime must therefore be bundled locally and must not be necessary for downloading dependencies during the evaluator run.

## Capability Sheet

Must-have capabilities:

- Public, stable, credential-free GGUF artifact with checksum.
- Idempotent model download into the metadata path.
- Pinned llama.cpp compatibility and correct chat template.
- Full profiler JSON plus raw benchmark evidence.
- Offline inference after artifact installation.
- Model-only accuracy on generic and African-domain held-out prompts.
- Peak RSS margin below 7 GB and ideally below 3 GB.
- Thermal-safe four-core configuration.
- Two deterministic participant prompts that display the local wedge.
- License manifest covering base model, weights, datasets, code, and application assets.

Nice-to-have capabilities are an offline UI, local retrieval, speech, and agent orchestration. They matter only if they explain or extend the model advantage without consuming evaluation reliability.

## Competitor Landscape

**BOTTOM LINE:** The public field is dense in agriculture, Qwen 1.5B to 4B, Q4_K_M, and generic local RAG. The strongest discovered threats are profiler-backed template forks, especially Code Persona on accuracy, AGBE on custom-model rigor and speed, Baarali Edge on systematic bake-offs, and Ondjila on localization plus agent pairing.

**EVIDENCE:** Devpost reports 1,764 participants, but exposes zero identities without login and the gallery states that managers have not published it. GitHub reports 118 template forks. A full fork audit found 48 ahead of upstream, 41 with placeholders removed, 42 with a literal public GGUF URL, and six with root `submission.json`. Public search also found at least 22 explicit current-event repositories. The named registry contains 19 entries across current repositories, material forks, timing candidates, adjacent models, and prior art. [A2: participants](https://adtc-2026.devpost.com/participants) [A2: gallery](https://adtc-2026.devpost.com/project-gallery) [A2: template](https://github.com/Africa-Deep-Tech-Foundation/adtc-2026-submission-template)

**CONFIDENCE:** High for the GitHub fork graph and file-presence counts, medium for competitor-reported metrics, and low for total-field density. No fork, repository, participant, or search-visible project page is classified as a formal submission because the official gallery is unpublished.

**SO WHAT:** Avoid generic agriculture Qwen RAG, generic coding tutor, generic SME chat, and 7B models. Win a low-density cell with hidden-prompt-verifiable African behavior, exact reference-machine evidence, thermal safety, and a license-clean artifact.

### Audit Funnel

| Stage | Reproducible count | Meaning |
|---|---:|---|
| Registered participants | 1,764 | Registration only |
| Public profiles resolved from roster | 0 | Devpost login wall |
| GitHub handles resolved from roster | 0 | No public roster linkage |
| Public repos resolved from roster | 0 | No public roster linkage |
| Explicit current-event repositories found independently | at least 22 | ADTC named in repository evidence |
| Official template forks | 118 | Intent signal only |
| Forks ahead of upstream | 48 | Material commit signal |
| Ahead forks with placeholders removed | 41 | Basic submission preparation |
| Ahead forks with public GGUF URL | 42 | Artifact intent |
| Ahead forks with root profiler JSON | 6 | Measured evidence |
| Formal gallery submissions | 0 observable | Gallery is unpublished, not evidence that zero exist |

Raw counts and methods are saved in `research/competitor-audit/`.

### Named Registry Highlights

| Project | Evidence class | Domain | Model | Proof | Threat |
|---|---|---|---|---|---|
| [Code Persona](https://github.com/Overwatch886/team-codewatch-adtc-2026-submission) | template fork | coding | Granite 4 tiny 6.94B IQ4_XS | 8.57 TPS, 3.62 GB, 0.86 ARC/50, 81 C | HIGH |
| [AGBE](https://github.com/nevodesigns/agbe) | template fork | agriculture | custom 1B Q4_K_M | 24.29 TPS, 1.04 GB, 0.56 ARC/50, 99 C | HIGH |
| [Baarali Edge](https://github.com/benewende-dev/baarali-edge) | explicit current-event repository | enterprise | Qwen3.5-2B IQ4_XS | raw multi-model and quantization bake-off | HIGH |
| [Ondjila](https://github.com/dimittri1/ondjila) | explicit current-event repository | agents | Qwen3-1.7B Q4_K_M | artifact, corpus, reported constrained-x86 run | HIGH |
| [BuildMate AI](https://github.com/Sultan-Othman-Adekoya/buildmate-ai-adtc2026) | explicit current-event repository | enterprise | Phi-3 Mini 3.8B Q4 | complete profiler JSON | HIGH |
| [Siyana AI](https://github.com/shaba40/siyana-ai) | template fork | enterprise | Qwen3-4B Q4_K_M | multilingual evaluation corpus and logs | HIGH |
| [Ayekoo](https://github.com/nogasante/ayekoo) | template fork | agriculture | Qwen2.5 0.5B Q4_K_M | 544.65 MB and Ghana corpus, no accuracy | HIGH |
| [Aletheia](https://arxiv.org/abs/2607.24814) | adjacent model | healthcare | Qwen2.5-3B QLoRA | research paper, about 3.63 GB | HIGH |
| [StacksNG](https://github.com/dannwaneri/stacksng) | explicit current-event repository | coding | Qwen2.5-Coder-7B Q4_K_M | 4.82 TPS, 7.05 GB, no accuracy | MEDIUM |
| [KaroGuard](https://github.com/kherin/karoguard-adtc-2026-submission) | explicit current-event repository | agriculture | Qwen3-4B Q4_K_M | public artifact and checksum | MEDIUM |
| [AgriDoc](https://huggingface.co/Cruso003/AgriDoc-Qwen2.5-1.5B-GGUF) | adjacent model | agriculture | Qwen2.5-1.5B Q4_0 | public tuned GGUF and safety claims | MEDIUM |
| [EduPulse-1.5B](https://devpost.com/software/edupulse-1-5b-zero-cost-offline-stem-reasoning-tutor) | timing candidate | math/science | DeepSeek-R1 distill 1.5B | public project page, no gallery proof | MEDIUM |
| [Atlas Sanctum Health](https://devpost.com/software/atlas-sanctum-health) | timing candidate | healthcare | unknown | public project page, no profiler | MEDIUM |
| [Tiny Aya Earth](https://huggingface.co/CohereLabs/tiny-aya-earth-GGUF) | adjacent model | creative/language | 3.35B Q4_K_M | official multilingual GGUF, NC license | MEDIUM |
| [FarmSpeak](https://africadeeptech.org/challenge-2025/) | prior art | agriculture | prior-edition system | official 2025 first place | LOW current, HIGH lesson |

### Domain Density

Agriculture is very high density with six named entries and two high threats. Enterprise is very high with four and three high threats. Coding is high with three and Code Persona's public 0.86 accuracy. Healthcare is medium but Aletheia raises the evidence and safety bar. Math/science and creative writing are the sparsest publicly visible domains. Autonomous agents is sparse, but Ondjila occupies the obvious localized document-agent cell.

### Model Strategy Density

Qwen-family models, 1.5B to 4B weights, and Q4_K_M are very crowded. English-only models wrapped in an African story are crowded. Actual African-language model behavior, license-clean training evidence, Q5 accuracy experiments, and deterministic verification are sparse. App RAG is common but does not raise model-only hidden-prompt performance. A low-density cell is useful only if it remains technically finishable and evaluator-visible.

## HIGH Threat Analysis

### Code Persona

- Proves: public profiler evidence with 0.86 ARC Easy acc_norm/50, 8.57 TPS, 3.62 GB, 81 C, and an eligible CPU class.
- Claims: official reproducibility; its OS was Ubuntu 26.04 rather than 22.04.
- Likely advantage: best observed accuracy, worth far more than raw speed under the 50 percent accuracy weight.
- Failure mode: 6.94B size reduces memory and speed headroom; English-only localization.
- Required categorical advantage: comparable accuracy from a smaller model plus African-language or local-task held-out proof and higher TPS.

### AGBE

- Proves: custom training code, curated corpus, public weights, adversarial evaluation, 24.29 TPS, and about 1.04 GB RSS.
- Claims: a score-ready run despite its 99 C throttling result.
- Likely advantage: full-stack model engineering and agriculture relevance.
- Failure mode: automatic thermal penalty and only 0.56 ARC accuracy.
- Required categorical advantage: thermal-safe throughput plus materially higher accuracy in a domain other than generic agriculture.

### Baarali Edge

- Proves: a disciplined five-model screen, quantization bake-off, raw artifacts, and Francophone enterprise specificity.
- Claims: M1 performance as a guide to x86 performance.
- Likely advantage: unusually strong documentation and decision quality.
- Failure mode: ARM results are not official-score comparable, and enterprise is crowded.
- Required categorical advantage: exact target-class x86 evidence and a less occupied workflow.

### Ondjila

- Proves: public GGUF, corpus provenance, Portuguese/Angolan document focus, and a coherent local agent pairing.
- Claims: 14.02 TPS and 1.90 GB on constrained x86 without raw root profiler JSON; model-level Umbundu ability is weaker than the app framing.
- Likely advantage: strongest current African localization plus agent story.
- Failure mode: retrieval and structured corpus may not affect model-only judging.
- Required categorical advantage: localized behavior embedded and measured in the model itself.

### BuildMate AI

- Proves: complete public profiler evidence, 0.76 ARC/50, 5.1 TPS, and 3.8 GB RSS.
- Claims: performance comparability from an older Windows CPU.
- Likely advantage: balanced score and domain clarity.
- Failure mode: very long TTFT, English-only localization, and dated base model.
- Required categorical advantage: lower TTFT and richer local behavior with equal or better accuracy.

### Siyana AI

- Proves: multilingual corpus, application validation, and multiple thread/core benchmark artifacts.
- Claims: final submission readiness without root `submission.json`.
- Likely advantage: industrial use case and evaluation discipline.
- Failure mode: missing root profiler artifact and crowded enterprise domain.
- Required categorical advantage: cleaner reproducibility plus a more specific African workflow.

### Ayekoo

- Proves: 544.65 MB reported RSS and deep Ghana-specific offline agriculture corpus.
- Claims: overall competitiveness without an accuracy result.
- Likely advantage: efficiency and local specificity.
- Failure mode: 0.5B quality ceiling and absent accuracy/thermal evidence.
- Required categorical advantage: accuracy-first small model in a lower-density domain.

### Aletheia

- Proves: paper-level East African clinical evaluation, 27k reasoning samples, Top-1 80 percent, Top-3 100 percent, ECE 0.275, and reported 3.63 GB peak.
- Claims: direct current-event submission status, which is not publicly proven.
- Likely advantage: strongest healthcare evidence and explicit calibration discussion.
- Failure mode: medical safety scrutiny, custom Qwen license, and paper-to-profiler reproducibility.
- Required categorical advantage: avoid healthcare unless we can exceed its evidence quality and safety case.

## Community Pain

**BOTTOM LINE:** The community is struggling with evaluation ambiguity and compute continuity, not merely model ideas.

1. On the missing validation set, Mairevh Exaucey KIBAMBA MFOUTOU asks: “We haven't been able to locate the Agriculture validation set could you point us to where it's published (a repo, a download link, or a Hugging Face dataset)?” [Forum](https://adtc-2026.devpost.com/forum_topics/44742-where-to-access-the-provided-validation-set-accuracy-scoring-format)
2. On the five-hour environment, Brown Carter writes: “And unlike gitpod there is no way to save session.” [Forum](https://adtc-2026.devpost.com/forum_topics/44633-than-5-is-not-enough-to-do-any-serious-training)
3. On profiler v0.1.0, Ahmed Madi reports: “We have identified two reproducible bugs in adtc-profiler v0.1.0 (accuracy.py) that prevent the correct evaluation of local chat-tuned GGUF models.” [Forum](https://adtc-2026.devpost.com/forum_topics/44369-bug-report-adtc-profiler-v0-1-0-accuracy-py) The inspected current head fixes those old issues, so this is historical pain rather than a current blocker.
4. On offline scope, an organizer clarifies: “For the first round, we will only be testing your model, and it has to work completely offline.” [Forum](https://adtc-2026.devpost.com/forum_topics/44164-clarification-if-app-should-work-completely-offline)

Product implication: publish evaluator commit, checksums, cold/warm run procedure, and a compact local evaluation set. This converts organizer ambiguity into trust.

## Prior Winners and Constrained-Compute Prior Art

The official 2025 winners were FarmSpeak, Cure Bionics, Muscle POS, and PERWER, with Edge Vendr, Heard, METAL, and FieldEdge FL among finalists. The pattern is physical or load-bearing African infrastructure with offline value, not a generic assistant skin. [A1: ADTC 2025](https://africadeeptech.org/challenge-2025/)

The EfficientQA 6 GB winner compressed retrieval representations and reused specialized components rather than selecting the smallest possible model. Its retrieval baseline reduced a Wikipedia TF-IDF index from 20.1 GB to 2.8 GB for only a one-point exact-match loss. The lesson is specialization under a hard budget, but ADTC's model-only evaluation means app retrieval cannot substitute for model quality. [A1: competition](https://efficientqa.github.io/) [A1: paper](https://proceedings.mlr.press/v133/min21a.html)

## Model Landscape

| Candidate | License | GGUF size | Role | Main risk |
|---|---|---:|---|---|
| [Phi-4-mini-instruct](https://huggingface.co/microsoft/Phi-4-mini-instruct) | MIT | community Q4_K_M about 2.49 GB | accuracy ceiling | community quantization; measure CPU speed |
| [Qwen3-4B-Instruct-2507](https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507) | Apache-2.0 | community Q4_K_M about 2.50 GB | accuracy ceiling | crowded family |
| [SmolLM3-3B](https://huggingface.co/ggml-org/SmolLM3-3B-GGUF) | Apache-2.0 | official Q4_K_M 1.92 GB | balanced | limited African-language evidence |
| [Qwen3.5-2B](https://huggingface.co/Qwen/Qwen3.5-2B) | Apache-2.0 | community Q4_K_M about 1.40 GB | balanced | new architecture versus pinned llama.cpp |
| [Qwen3-1.7B](https://huggingface.co/Qwen/Qwen3-1.7B-GGUF) | Apache-2.0 | official Q8 1.83 GB | speed | thinking output may hit 128-token cap |
| [Qwen2.5-1.5B-Instruct](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF) | Apache-2.0 | official Q4 1.12 GB | safest speed floor | lower quality ceiling |
| [Granite 3.3 2B](https://huggingface.co/ibm-granite/granite-3.3-2b-instruct) | Apache-2.0 | community Q4 1.55 GB | enterprise/RAG | weak African-language evidence |
| [Tiny Aya Earth](https://huggingface.co/CohereLabs/tiny-aya-earth-GGUF) | CC BY-NC 4.0 | official Q4 2.14 GB | localization | noncommercial license |
| [InkubaLM](https://huggingface.co/lelapa/InkubaLM-0.4B) | CC BY-NC 4.0 | community GGUF | African baseline | gated, NC, quality ceiling |

Shortlist only three candidates because disk and time are hard constraints: one accuracy ceiling, one balanced model, and Qwen2.5-1.5B as speed floor. Q4_K_M is the default, Q5_K_M is the accuracy experiment, and lower-bit formats are not assumed faster until measured.

## Dataset and License Audit

- [Aya Dataset](https://huggingface.co/datasets/CohereLabs/aya_dataset): Apache-2.0, about 204k instructions and broad language coverage including Yoruba, Somali, and Amharic. Audit row provenance before training.
- [AfriMMLU](https://huggingface.co/datasets/masakhane/afrimmlu) and [AfriMGSM](https://huggingface.co/datasets/masakhane/afrimgsm): Hugging Face cards say Apache-2.0, while the IrokoBench paper says CC BY-SA 4.0. Reserve for held-out evaluation and avoid training contamination until resolved.
- [AfriQA](https://aclanthology.org/2023.findings-emnlp.997.pdf): CC BY 4.0 per paper, useful for cross-lingual QA after exact card audit.
- [NaijaSenti](https://github.com/hausanlp/naijasenti): CC BY 4.0 for Hausa, Igbo, Yoruba, and Nigerian Pidgin sentiment. Useful for linguistic diagnostics, not broad SFT.
- [MasakhaNER 2.0](https://github.com/masakhane-io/masakhane-ner): CC BY-NC 4.0 plus underlying-source variability. Eval only.
- [African Storybook](https://www.africanstorybook.org/terms.html): item-level mix of CC BY and CC BY-NC. Filter every item.
- [UD Naija NSC](https://github.com/UniversalDependencies/UD_Naija-NSC): CC BY-SA 4.0, useful for Nigerian Pidgin style and evaluation.
- [SAHARA](https://sahara-benchmark.readthedocs.io/en/latest/): 517-language scope but gated test access. Landscape evidence only under this deadline.

Every training row needs source URL, license, allowed use, transformation, and held-out split hash. No training on benchmark test items.

## Compute Plan and GPU Grant Confirmation

**BOTTOM LINE:** The expired five-hour UduTech application does not affect eligibility, building, profiling, submission, judging, or prizes. It was optional training support. We can do nearly all required compute testing ourselves, but spawned agents do not create additional hardware.

The official update describes limited GPU credits for training and fine-tuning, while the rules define judging solely through submitted artifacts on the standard laptop. [A2: GPU update](https://adtc-2026.devpost.com/updates/44861-free-gpu-credits-from-udutech-available-for-adtc-2026-participants) The no-training path is a guaranteed fallback, not a prohibition.

Compute ladder:

1. **Local M1 8 GB:** validate download, llama.cpp compatibility, prompt behavior, relative accuracy, quantization, and memory. Serialize all heavy model runs because agents share this same machine.
2. **GitHub Actions public x64:** public repositories receive standard runners without minute charges; current Linux public runners expose four CPUs, 16 GB RAM, and 14 GB SSD. Run one candidate at a time inside Docker with `--cpus 4 --memory 8g --memory-swap 8g --network none`. This proves x86/Linux/cgroup/offline compatibility, not official TPS or thermals because CPU models and sensors vary. [A1: GitHub runner docs](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
3. **Codespaces:** interactive x86 compatibility within personal free quota, not official benchmark equivalence. [A1: Codespaces](https://github.com/features/codespaces)
4. **Kaggle:** optional free GPU for QLoRA, currently described as roughly 30 weekly GPU hours with possible queues. [A1: Kaggle](https://www.kaggle.com/docs/efficient-gpu-usage)
5. **Colab:** optional free GPU/TPU with dynamic, unpublished limits and no guarantee of GPU availability. [A1: Colab FAQ](https://research.google.com/colaboratory/faq.html)
6. **Borrowed target laptop:** only this meaningfully validates target-class TPS and the 85 C thermal gate. Run three cold-boot profiler repetitions and log CPU SKU, governor, ambient temperature, profiler hash, and llama.cpp hash.

Spawned agents are valuable for research, licensing, test-set authoring, CI workflow design, and result analysis. They share the host CPU, RAM, and disk, so running multiple GGUF benchmarks concurrently would corrupt both latency and thermal evidence. Paid compute requires explicit approval.

## Organizer Video Messaging Signal

The user supplied an automatic transcript of the organizer's YouTube explainer. Its strongest strategic signal is not a new rule. It is the narrative frame judges have been primed to recognize:

1. Cloud-first AI assumes reliable internet, stable electricity, and recurring API budgets that many target users do not have.
2. The contest wants today's 8 GB laptop treated as the product boundary, not as an apologetic limitation.
3. Constraint-driven engineering is framed as a strategic advantage.
4. A winning demonstration must prove local behavior and useful African ground applicability, not only report sterile benchmark numbers.
5. Accuracy, speed, and memory remain the center of the scoring story.

Warroom and demo should preserve this causal chain: inaccessible cloud assumptions, a specific African user, an offline model intervention, measured performance on constrained hardware, and a concrete local outcome. Do not quote the automatic transcript without normalization. Its raw text and correction log are saved at `research/sources/organizer-youtube-transcript-user-supplied.md`.

## Judge Signals

Oji Udezue's product work and official session indicate problem clarity and adoption realism. Omoju Miller's open-source ML background points toward reproducibility and sandbox discipline. Mbangula Lameck Amugongo's clinical ML and responsible-AI work makes unsupported medical certainty especially risky. [B2: Oji bio](https://www.phalanx.studio/about) [B2: Omoju bio](https://omojumiller.com/pages/about.html) [B2: Lameck ORCID](https://orcid.org/0000-0001-6468-2643)

Do not overfit a pitch to guessed preferences. Optimize the published score and give judges an auditable causal story: baseline, intervention, held-out gain, efficiency cost, and local relevance.

## Contradictions and Open Questions

1. Throughput uses a fixed provisional 15 TPS in the profiler, while event prose references maximum observed submission TPS. Use current code for self-report and flag arithmetic in `REPORT.md`.
2. FAQ suggests accuracy is optional for participants; profiler guidance warns missing accuracy may score zero. Run full accuracy.
3. Rules mention validation samples, but a public forum asks where Agriculture samples are and has no answer. Build an independent held-out suite.
4. Team ID location differs between template issue discussion and FAQ. Recheck immediately before packaging.
5. Prize labels differ between Devpost and organizer site. Do not target a label at the expense of overall score.
6. African bonus arithmetic differs across organizer surfaces. Treat localization as qualitative upside, not a substitute for base score.

## Broader Market Context and Category Saturation

Grid broad searches for “offline AI” and “local LLM” returned no useful direct matches. Its broader external AI-agent taxonomy contains 197 products across 161 roots. That number describes an external product category, not ADTC competition density. The defensible market claim is narrower: offline, private, low-cost language assistance remains strategically valuable where cloud APIs, stable connectivity, and electricity are constrained.

Copilot-backed builder-history lookup was unavailable because no token was configured. This is documented rather than silently replaced with speculation.

## Track Coverage Matrix

| Domain | Public density | Score opportunity | Main burden | Recommendation |
|---|---|---|---|---|
| Math/science | low | hidden reasoning accuracy | multilingual reasoning data | shortlist |
| Healthcare | medium | high social value | safety, calibration, Aletheia | avoid under deadline |
| Agriculture | very high | clear localization | saturation and RAG sameness | avoid generic form |
| Creative writing | low | African-language differentiation | subjective judging and data rights | consider with licensed corpus |
| Coding | high | public benchmarks | Code Persona accuracy bar | avoid generic tutor |
| Enterprise | very high | document utility | three high threats | avoid generic assistant |
| Autonomous agents | low | privacy/offline story | model-only score and Ondjila | only with a new categorical wedge |

## Strategic Recommendation for Warroom

Generate ideas in math/science and creative writing first, then one autonomous-agent wildcard. Require every finalist idea to pass five gates before forge: license-safe credential-free base, pinned profiler compatibility, model-only measurable local benefit, predicted peak RSS below 3 GB, and a two-minute proof story. Use Qwen2.5-1.5B as the guaranteed runnable floor and compare against exactly one balanced and one accuracy-ceiling model.

## Four-Part Kill List

### 1. Saturated

- Generic Qwen 1.5B to 4B Q4_K_M agriculture adviser.
- Generic offline coding tutor.
- Generic SME document chat or summarizer.
- English-only model with African branding but no held-out local behavior.

### 2. Broken Dependencies

- Gated weights or token-requiring downloads.
- InkubaLM, Tiny Aya, Gemma, or Llama as default before license/gate approval.
- Dataset rows with conflicting or missing licenses.
- App RAG expected to improve a model-only score.
- Training plan dependent on the expired five-hour GPU grant.
- New architecture that fails the profiler's pinned llama.cpp.

### 3. Already Built

- FarmSpeak-style offline farmer assistant.
- AGBE-style custom agriculture extension model.
- Ondjila-style localized civil-document agent.
- Baarali-style Francophone enterprise assistant.
- Code Persona-style large quantized coding model.
- Aletheia-style East African clinical reasoner without a categorical safety/evidence leap.

### 4. Zero Alignment

- UI-first product with no better GGUF behavior.
- Cloud API, online retrieval, login, or remote inference in the evaluated path.
- Non-GGUF runtime.
- Blockchain, mesh, speech, or agent orchestration that is decorative rather than load-bearing.
- Unprofiled model, missing accuracy, or benchmark claims copied from unrelated hardware.

## Key Links

- [Official Devpost](https://adtc-2026.devpost.com/)
- [Rules](https://adtc-2026.devpost.com/rules)
- [Resources](https://adtc-2026.devpost.com/resources)
- [Updates](https://adtc-2026.devpost.com/updates)
- [Discussions](https://adtc-2026.devpost.com/forum_topics)
- [Unpublished gallery](https://adtc-2026.devpost.com/project-gallery)
- [Organizer FAQ and challenge](https://africadeeptech.org/challenge-2026/)
- [Submission template](https://github.com/Africa-Deep-Tech-Foundation/adtc-2026-submission-template)
- [Profiler](https://github.com/Africa-Deep-Tech-Foundation/adtc-profiler)
- [GPU credit update](https://adtc-2026.devpost.com/updates/44861-free-gpu-credits-from-udutech-available-for-adtc-2026-participants)

## Quality Self-Score

| Dimension | Score / 5 | Basis |
|---|---:|---|
| Specificity | 5 | Exact profiler settings, funnel counts, metrics, licenses, and deadlines |
| Evidence quality | 4 | Primary organizer, repository, model-card, and paper sources; competitor metrics remain self-reported |
| Novelty | 5 | Full material-fork audit, two density maps, contradiction ledger, and compute ladder |
| Competitor depth | 5 | Nineteen named entries and eight HIGH threat analyses with direct links |
| Actionability | 5 | Shortlist, gates, compute sequence, and four-part kill list |

Average: 4.8 / 5. No dimension scores 1.
