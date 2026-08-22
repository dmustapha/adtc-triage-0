#!/usr/bin/env bash

set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
script_path="$repo_root/benchmark/run_bakeoff.sh"
work_root="${RUNNER_TEMP:-$repo_root/.benchmark-work}/adtc-bakeoff"
artifact_root="$repo_root/benchmark-artifacts"
hf_cache="$work_root/huggingface"
profiler_image="${PROFILER_IMAGE:-adtc-profiler:bakeoff-ac2e137}"

mkdir -p "$work_root" "$artifact_root" "$hf_cache"
cd "$repo_root"

prefetch_accuracy_data() {
  docker run --rm \
    -v "$hf_cache:/root/.cache/huggingface" \
    --entrypoint python \
    "$profiler_image" \
    -c "from datasets import load_dataset; load_dataset('allenai/ai2_arc', 'ARC-Easy', split='test')"
}

candidate_field() {
  python -m benchmark.candidate_tool get "$1" "$2"
}

download_candidate() {
  local candidate_id="$1" model_path="$2" result_dir="$3"
  local url sha expected_size actual_size partial_path
  url="$(candidate_field "$candidate_id" url)"
  sha="$(candidate_field "$candidate_id" sha256)"
  expected_size="$(candidate_field "$candidate_id" size_bytes)"
  partial_path="$model_path.partial"
  curl --location --fail --retry 5 --retry-all-errors \
    --output "$partial_path" "$url" 2>&1 | tee "$result_dir/download.log"
  printf '%s  %s\n' "$sha" "$partial_path" | sha256sum --check
  actual_size="$(wc -c < "$partial_path" | tr -d ' ')"
  if [[ "$actual_size" != "$expected_size" ]]; then
    echo "size mismatch: expected $expected_size bytes, received $actual_size" >&2
    return 1
  fi
  mv "$partial_path" "$model_path"
  sha256sum "$model_path" > "$result_dir/model.sha256"
  printf '%s\n' "$actual_size" > "$result_dir/model-size-bytes.txt"
  if ! curl --silent --show-error --location --head "$url" > "$result_dir/download-headers.txt"; then
    printf 'HEAD request failed after successful verified download\n' > "$result_dir/download-headers.txt"
  fi
}

run_profiler() {
  local stage="$1" result_dir="$2"
  docker run --rm --network none --memory 7.5g --cpus 4 \
    -e HF_HUB_OFFLINE=1 -e HF_DATASETS_OFFLINE=1 \
    -v "$stage:/submission:ro" \
    -v "$result_dir:/artifacts" \
    -v "$hf_cache:/root/.cache/huggingface" \
    "$profiler_image" run \
    --submission /submission --mode audit \
    --output /artifacts/profiler.json \
    --seed 42 --accuracy-task arc_easy --accuracy-limit 50 \
    2>&1 | tee "$result_dir/profiler.log"
}

run_clinical_suite() {
  local stage="$1" result_dir="$2" filename="$3"
  docker run --rm --network none --memory 7.5g --cpus 4 \
    -v "$repo_root:/repo:ro" \
    -v "$stage:/submission:ro" \
    -v "$result_dir:/artifacts" \
    -w /repo --entrypoint python \
    "$profiler_image" -m benchmark.clinical_runner \
    --model "/submission/model/$filename" \
    --output /artifacts/clinical.json \
    2>&1 | tee "$result_dir/clinical.log"
}

run_candidate() {
  local candidate_id="$1" stage result_dir filename model_path
  stage="$work_root/$candidate_id/submission"
  result_dir="$artifact_root/$candidate_id"
  filename="$(candidate_field "$candidate_id" filename)"
  model_path="$stage/model/$filename"
  mkdir -p "$result_dir"
  python -m benchmark.candidate_tool prepare "$candidate_id" "$stage"
  cp "$stage/artifact-contract.json" "$result_dir/artifact-contract.json"
  trap 'rm -f "$model_path" "$model_path.partial"' RETURN
  download_candidate "$candidate_id" "$model_path" "$result_dir"
  run_profiler "$stage" "$result_dir"
  run_clinical_suite "$stage" "$result_dir" "$filename"
  rm -f "$model_path"
  trap - RETURN
}

if [[ "${1:-}" == "--candidate" ]]; then
  if [[ "$#" -ne 2 ]]; then
    echo "usage: $0 --candidate CANDIDATE_ID" >&2
    exit 2
  fi
  run_candidate "$2"
  exit 0
fi

prefetch_accuracy_data
overall_status=0
while IFS= read -r candidate_id; do
  result_dir="$artifact_root/$candidate_id"
  mkdir -p "$result_dir"
  if "$script_path" --candidate "$candidate_id"; then
    printf 'success\n' > "$result_dir/run-status.txt"
  else
    printf 'failed\n' > "$result_dir/run-status.txt"
    overall_status=1
  fi
done < <(python -m benchmark.candidate_tool ids)

python -m benchmark.summarize \
  --artifacts "$artifact_root" \
  --output "$artifact_root/comparison-summary.json"

exit "$overall_status"
