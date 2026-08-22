# ADTC 2026 Compute and Evaluation Plan

## Available local hardware

- Apple M1 MacBook Pro
- 8 CPU cores
- 8 GB unified memory
- ARM64 macOS
- Approximately 13 GB free disk at bootstrap

This machine is unusually useful for memory-pressure screening because it has the same total memory budget as the ADTC laptop. It is not suitable for official-comparable throughput claims because the competition target is x86-64 Ubuntu and the Apple M1 has a different CPU architecture and memory system.

## Agent boundary

Spawned agents parallelize research, evaluation design, log analysis, and independent review. They share this Mac, filesystem, and available memory. They do not create additional GPUs or hardware capacity.

Model downloads and profiler runs must therefore be serialized locally. Parallel agents may prepare different evaluation suites, but only one heavy model run should execute at a time.

## Compute ladder

### Tier 1: Local Mac, immediate and free

Use for:

- GGUF integrity and `llama.cpp` compatibility
- Relative accuracy bake-offs
- Relative quantization comparisons
- Peak-memory and OOM screening
- Prompt and chat-template experiments
- Download-script and profiler integration

Do not present Apple M1 TPS or thermals as ADTC target-hardware results.

### Tier 2: GitHub Actions x86, free after public repository creation

Use `ubuntu-22.04` standard runners. Public repositories receive free standard-runner usage. The current public runner provides 4 x64 CPU cores, 16 GB RAM, and 14 GB SSD.

Run the evaluator inside a Docker container constrained to the contest envelope:

```bash
docker run --rm \
  --cpus 4 \
  --memory 8g \
  --memory-swap 8g \
  --network none \
  -v "$PWD:/submission:ro" \
  adtc-audit-local
```

This is strong evidence for x86 compatibility, four-core execution, offline behavior, and the 8 GB cap. It is not official-equivalent TPS or thermal evidence because GitHub's CPU model and sensor access differ from ADTC hardware.

### Tier 3: Free GPU notebook, optional

Use Google Colab interactively for LoRA training, merge, conversion, or quantization only if the model bake-off proves that training is worth the risk. Free GPU type, access, memory, and runtime are not guaranteed. Persist checkpoints frequently.

Inference must still be validated through CPU-only `llama.cpp` after conversion to GGUF.

### Tier 4: Paid GPU, conditional

Only purchase compute after a short pilot proves all of the following:

1. The dataset license is acceptable.
2. The baseline has a measured accuracy gap.
3. A small LoRA run is likely to close that gap.
4. Conversion and quantization are already rehearsed.
5. The run can finish with enough time left for CPU profiling and submission.

Any purchase requires explicit user approval.

## Storage discipline

Only about 13 GB was free at bootstrap. Keep one heavyweight candidate on disk at a time. Record checksums and benchmark results, then remove or archive the model before downloading the next candidate. Never commit GGUF files.

## Recommended execution order

1. Research and shortlist three to five GGUF candidates.
2. Screen one model at a time on the M1.
3. Select the Pareto frontier using accuracy, peak memory, size, and relative TPS.
4. Create the public repository and run the x86 GitHub Actions audit workflow.
5. Fine-tune only if the best compliant baseline misses a clearly identified accuracy target.
6. Re-run local and x86 evaluation after every model change.

## Claim policy

- Local ARM metrics: label as development-machine measurements.
- GitHub x86 metrics: label as constrained CI compatibility measurements.
- Official ADTC profiler audit: only the organizer can produce official leaderboard numbers.
- Never claim thermal equivalence from CI or macOS sensors.
