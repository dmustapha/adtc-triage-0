# ADTC 2026 Submission Checklist

## Eligibility and registration

- [ ] Devpost participation is registered before the deadline.
- [ ] Team ID is copied exactly from the registered Devpost team.
- [ ] Every team member resides in an eligible African country and meets the age requirement.
- [ ] The project satisfies venture-age, product-stage, and funding-cap rules.
- [ ] Challenge Participation Agreement accepted.

## Required public repository

- [ ] Repository is public and based on the official ADTC template.
- [ ] `metadata.json` contains no placeholder values.
- [ ] Exactly two domain-specific prompts appear in `test_prompts`.
- [ ] `domain` uses one official enum value.
- [ ] `language_scope` uses valid BCP-47 codes.
- [ ] `budget_laptop_claim` is `true`.
- [ ] African-use-case claim is factual and evidenced.
- [ ] Cross-disciplinary pairing is genuinely load-bearing.
- [ ] `model.runtime` is `llama.cpp`.
- [ ] `_runtime.model_path` exactly matches the downloaded GGUF path.
- [ ] `model/*.gguf` and `*.gguf` are excluded from Git.
- [ ] All open-source models, datasets, libraries, and copied code are cited with licenses.

## Model download and offline execution

- [ ] `download_model.sh` is idempotent.
- [ ] Download succeeds without credentials.
- [ ] Public model URL works from a clean machine.
- [ ] Downloaded GGUF checksum matches the documented checksum.
- [ ] Model loads through CPU-only `llama.cpp`.
- [ ] Inference succeeds with outbound network disabled.
- [ ] No OOM or sandbox crash under an 8 GB memory constraint.

## Profiler evidence

- [ ] `llama-bench` is available on `PATH`.
- [ ] Fast smoke test passes with `--skip-accuracy`.
- [ ] Full participant profiler run completes without `--skip-accuracy`.
- [ ] `submission.json` is schema-valid and says `participant_laptop`.
- [ ] Peak RSS is below 7 GB or the tradeoff is explicitly justified.
- [ ] Raw TPS, TTFT, memory, CPU, thermal, and accuracy evidence retained.
- [ ] Self-reported `Sperf` and `Seff` are computed and entered as separate plain numbers.
- [ ] Claims distinguish local ARM, constrained CI x86, and official organizer audit results.

## Report and proof

- [ ] `REPORT.md` defines the African problem and target user.
- [ ] Constraints include power, connectivity, data, compute, and target hardware.
- [ ] Alternatives and final model/quantization decisions are evidence-backed.
- [ ] Tools and AI assistance are disclosed.
- [ ] Benchmarks identify exact hardware and commands.
- [ ] Screenshots or short clips show real offline inference and profiler proof.
- [ ] README, report, metadata, profiler JSON, and Devpost claims agree.

## Video

- [ ] Final video is 120 seconds or shorter.
- [ ] Video explains the solution and development journey.
- [ ] It proves local offline inference and shows one difficult domain prompt.
- [ ] It shows raw benchmark evidence without overstating comparability.
- [ ] Video URL plays without login in an incognito window.

## Submission day

- [ ] Devpost form is submitted, not merely saved as a draft.
- [ ] Public repository and model download tested from a clean environment.
- [ ] Every external URL tested from an incognito window.
- [ ] Submitted-state screenshot captured with timestamp.
- [ ] Code freeze begins at least 30 minutes before the deadline.
