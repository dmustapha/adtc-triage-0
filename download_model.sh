#!/usr/bin/env bash
# Install the canonical public GGUF from config/canonical-model.json.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACT="$HERE/config/canonical-model.json"

IFS=$'\t' read -r MODEL_URL MODEL_PATH EXPECTED_BYTES EXPECTED_SHA < <(
  node -e '
    const fs = require("node:fs");
    const c = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    if (!/^model\/[A-Za-z0-9._-]+\.gguf$/.test(c.path)) throw new Error("invalid canonical model path");
    if (!Number.isSafeInteger(c.bytes) || c.bytes <= 0) throw new Error("invalid canonical byte count");
    if (!/^[a-f0-9]{64}$/.test(c.sha256)) throw new Error("invalid canonical SHA-256");
    process.stdout.write([c.url, c.path, c.bytes, c.sha256].join("\t") + "\n");
  ' "$CONTRACT"
)

MODEL_FILE="$HERE/$MODEL_PATH"
PARTIAL="$MODEL_FILE.partial"
mkdir -p "$(dirname "$MODEL_FILE")"

file_size() { wc -c < "$1" | tr -d '[:space:]'; }
file_sha256() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}';
  elif command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | awk '{print $1}';
  else echo "error: sha256sum or shasum is required" >&2; return 1;
  fi
}
verified() {
  [[ "$(file_size "$1")" == "$EXPECTED_BYTES" ]] && [[ "$(file_sha256 "$1")" == "$EXPECTED_SHA" ]]
}

download_ranges() {
  local segment_bytes="${MODEL_DOWNLOAD_SEGMENT_BYTES:-16777216}"
  local parallelism="${MODEL_DOWNLOAD_PARALLELISM:-4}"
  local segment_dir="$PARTIAL.segments"
  [[ "$segment_bytes" =~ ^[1-9][0-9]*$ ]] || { echo "error: invalid segment byte count" >&2; return 1; }
  if [[ ! "$parallelism" =~ ^[1-9][0-9]*$ ]] || (( parallelism > 16 )); then
    echo "error: download parallelism must be between 1 and 16" >&2
    return 1
  fi
  mkdir -p "$segment_dir"
  [[ -f "$PARTIAL" ]] || : > "$PARTIAL"

  while (( $(file_size "$PARTIAL") < EXPECTED_BYTES )); do
    local current="$(file_size "$PARTIAL")"
    local starts=() ends=() files=() pids=()
    local slot start end segment_file
    for (( slot = 0; slot < parallelism && current < EXPECTED_BYTES; slot++ )); do
      start="$current"
      end=$(( start + segment_bytes - 1 ))
      (( end >= EXPECTED_BYTES )) && end=$(( EXPECTED_BYTES - 1 ))
      segment_file="$segment_dir/$start-$end"
      starts+=("$start"); ends+=("$end"); files+=("$segment_file")
      current=$(( end + 1 ))
      if [[ -f "$segment_file" ]] && (( $(file_size "$segment_file") == end - start + 1 )); then
        continue
      fi
      curl --http1.1 -L --fail --retry 5 --retry-all-errors --retry-delay 2 \
        --range "$start-$end" -o "$segment_file" "$MODEL_URL" &
      pids+=("$!")
    done

    local failed=0 pid index expected_segment_bytes
    for pid in "${pids[@]}"; do wait "$pid" || failed=1; done
    (( failed == 0 )) || { echo "error: range download failed; existing partial preserved" >&2; return 1; }
    for (( index = 0; index < ${#files[@]}; index++ )); do
      expected_segment_bytes=$(( ends[index] - starts[index] + 1 ))
      if [[ ! -f "${files[index]}" ]] || (( $(file_size "${files[index]}") != expected_segment_bytes )); then
        echo "error: incomplete download; segment size mismatch for ${starts[index]}-${ends[index]}; existing partial preserved" >&2
        return 1
      fi
    done
    for segment_file in "${files[@]}"; do
      command cat -- "$segment_file" >> "$PARTIAL"
      rm -f -- "$segment_file"
    done
  done
}

download_hf() {
  if ! command -v hf >/dev/null 2>&1; then
    echo "warning: hf command unavailable; falling back to curl" >&2
    return 2
  fi
  local identity repo revision filename
  identity="$(node -e '
    const fs = require("node:fs");
    const c = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const url = new URL(c.url);
    const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    if (url.protocol !== "https:" || url.hostname !== "huggingface.co" || parts.length !== 5 || parts[2] !== "resolve") {
      throw new Error("canonical URL is not a pinned Hugging Face resolve URL");
    }
    if (parts[3] !== c.revision || parts[4] !== c.filename || c.filename !== require("node:path").basename(c.path)) {
      throw new Error("canonical Hugging Face identity fields disagree");
    }
    process.stdout.write([`${parts[0]}/${parts[1]}`, c.revision, c.filename].join("\t"));
  ' "$CONTRACT")" || return 1
  IFS=$'\t' read -r repo revision filename <<< "$identity"

  local stage_dir="$MODEL_FILE.partial.hf-stage"
  local staged_file="$stage_dir/$filename"
  mkdir -p "$stage_dir"
  if ! hf download "$repo" "$filename" --revision "$revision" --local-dir "$stage_dir"; then
    echo "warning: hf download failed; falling back to curl with existing progress preserved" >&2
    return 2
  fi
  if [[ ! -f "$staged_file" ]] || ! verified "$staged_file"; then
    echo "error: staged model failed verification; final path was not published" >&2
    return 1
  fi
  mv -- "$staged_file" "$MODEL_FILE"
  echo "installed verified canonical model at $MODEL_FILE"
}

if [[ -f "$MODEL_FILE" ]]; then
  if verified "$MODEL_FILE"; then
    echo "model already present and verified at $MODEL_FILE"
    exit 0
  fi
  echo "existing final model failed verification; removing it" >&2
  rm -f -- "$MODEL_FILE"
fi

DOWNLOAD_ENGINE="${MODEL_DOWNLOAD_ENGINE:-curl}"
if [[ "$DOWNLOAD_ENGINE" == "hf" ]]; then
  if download_hf; then exit 0; else HF_STATUS=$?; fi
  (( HF_STATUS == 2 )) || exit "$HF_STATUS"
elif [[ "$DOWNLOAD_ENGINE" != "curl" ]]; then
  echo "error: MODEL_DOWNLOAD_ENGINE must be curl or hf" >&2
  exit 1
fi

echo "downloading canonical model to partial file"
if command -v curl >/dev/null 2>&1; then
  download_ranges
elif command -v wget >/dev/null 2>&1; then
  wget --continue -O "$PARTIAL" "$MODEL_URL"
else
  echo "error: neither curl nor wget found" >&2
  exit 1
fi

ACTUAL_BYTES="$(file_size "$PARTIAL")"
if (( ACTUAL_BYTES < EXPECTED_BYTES )); then
  echo "error: incomplete download (expected $EXPECTED_BYTES bytes, got $ACTUAL_BYTES); partial preserved for resume" >&2
  exit 1
fi
if (( ACTUAL_BYTES > EXPECTED_BYTES )); then
  echo "error: size mismatch (expected $EXPECTED_BYTES, got $ACTUAL_BYTES)" >&2
  rm -f -- "$PARTIAL"
  exit 1
fi

ACTUAL_SHA="$(file_sha256 "$PARTIAL")"
if [[ "$ACTUAL_SHA" != "$EXPECTED_SHA" ]]; then
  echo "error: SHA-256 mismatch (expected $EXPECTED_SHA, got $ACTUAL_SHA)" >&2
  mv -- "$PARTIAL" "$MODEL_FILE.corrupt.$ACTUAL_SHA"
  exit 1
fi

mv -- "$PARTIAL" "$MODEL_FILE"
echo "installed verified canonical model at $MODEL_FILE"
