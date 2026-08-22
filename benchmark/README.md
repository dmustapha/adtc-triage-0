# ADTC controlled model bake-off

This harness compares three public GGUF candidates before the submission chooses a canonical model. It is development evidence, not an organizer audit and not a substitute for the final participant run on a physical ADTC-class laptop.

## Candidates

| Role | Candidate | File size | Publisher-reported AVG | Purpose |
|---|---|---:|---:|---|
| Speed baseline | MedPsy-1.7B Q4_K_M imatrix | 1.28 GB | 65.58 | Establish the fast, low-memory floor |
| Same-family quality challenger | MedPsy-1.7B Q5_K_M imatrix | 1.47 GB | 66.29 | Test whether near-lossless quality is worth the extra memory |
| Accuracy ceiling | MedPsy-4B Q4_K_M imatrix | 2.72 GB | 71.46 | Measure the value and cost of a larger medical model |

Publisher-reported scores are priors only. The selection uses our own pinned x86 run and separate clinical suite.

## Controlled execution

The manually triggered GitHub Actions workflow:

1. Verifies all local benchmark contracts.
2. Builds the official ADTC profiler at commit `ac2e137dca65ea3b09d997774f17dd8907b489fb`.
3. Downloads the public ARC-Easy test data before inference.
4. Downloads one GGUF at a time from a revision-pinned URL.
5. Verifies the exact SHA-256 before model loading.
6. Runs the full official profiler with 50 ARC-Easy samples.
7. Runs 24 original clinical triage multiple-choice cases and the two participant prompts.
8. Disables container networking during all model inference.
9. Caps each inference container at 4 CPUs and 7.5 GiB RAM.
10. Deletes each runner-local GGUF before advancing to the next candidate.
11. Uploads profiler, clinical, artifact, environment, and log evidence for 14 days.

The clinical set is a development holdout modeled on likely safety and reasoning demands. It is not the organizer's hidden benchmark. Safety-critical cases receive weight 2; other cases receive weight 1.

## Selection rule

The generated proxy applies the published weighting:

```text
accuracy_proxy = 40% ARC-Easy + 60% clinical holdout
proxy_total = 50% accuracy_proxy + 30% performance + 20% efficiency
```

The highest proxy score is not automatically selected. Selection remains blocked until:

- both participant-prompt responses receive qualitative review;
- the model and training-lineage licenses receive explicit review;
- a physical target laptop completes thermals and throttling checks;
- a clean public-repository download and full participant profiler run succeed.

## Licensing and lineage caveat

The GGUF and source model cards declare Apache-2.0, as do the Qwen backbones. The MedPsy source cards also state that Genesis I and Genesis II subsets, published under CC-BY-NC 4.0, were used by a teacher model to generate synthetic training data. This harness preserves that disclosure rather than treating the top-level model license as the entire provenance story.

This is a selection caveat, not a legal conclusion. The final report must cite the exact selected artifact, source-model revision, backbone, model card, and disclosed training lineage.

## Evidence limitations

- A GitHub-hosted runner is useful for comparative x86 evidence, but it is not the ADTC reference laptop.
- Cloud virtual machines do not provide valid physical laptop temperature or throttling proof.
- The official profiler's local accuracy task is development evidence. Organizers retain private prompts and qualitative judging.
- Reported memory and throughput must be labeled with the actual host and must not be presented as final target-laptop measurements.

## Sources

- [Official ADTC profiler](https://github.com/Africa-Deep-Tech-Foundation/adtc-profiler)
- [MedPsy-1.7B GGUF card](https://huggingface.co/qvac/MedPsy-1.7B-GGUF)
- [MedPsy-4B GGUF card](https://huggingface.co/qvac/MedPsy-4B-GGUF)
- [MedPsy technical report](https://huggingface.co/blog/qvac/medpsy)
- [WHO mhGAP guideline](https://www.who.int/publications/i/item/9789240084278)
- [WHO mhGAP Intervention Guide](https://www.who.int/publications/i/item/9789241549790)
- [WHO suicide guidance](https://www.who.int/news-room/questions-and-answers/item/suicide)
- [NICE perinatal mental-health recommendations](https://www.nice.org.uk/guidance/cg192/chapter/Recommendations)
- [NICE acute alcohol-withdrawal recommendations](https://www.nice.org.uk/guidance/cg100/chapter/recommendations)
