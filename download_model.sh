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

if [[ -f "$MODEL_FILE" ]]; then
  if verified "$MODEL_FILE"; then
    echo "model already present and verified at $MODEL_FILE"
    exit 0
  fi
  echo "existing final model failed verification; removing it" >&2
  rm -f -- "$MODEL_FILE"
fi

echo "downloading canonical model to partial file"
if command -v curl >/dev/null 2>&1; then
  curl -L --fail --retry 3 --continue-at - -o "$PARTIAL" "$MODEL_URL"
elif command -v wget >/dev/null 2>&1; then
  wget --continue -O "$PARTIAL" "$MODEL_URL"
else
  echo "error: neither curl nor wget found" >&2
  exit 1
fi

ACTUAL_BYTES="$(file_size "$PARTIAL")"
if [[ "$ACTUAL_BYTES" != "$EXPECTED_BYTES" ]]; then
  echo "error: size mismatch (expected $EXPECTED_BYTES, got $ACTUAL_BYTES)" >&2
  rm -f -- "$PARTIAL"
  exit 1
fi

ACTUAL_SHA="$(file_sha256 "$PARTIAL")"
if [[ "$ACTUAL_SHA" != "$EXPECTED_SHA" ]]; then
  echo "error: SHA-256 mismatch (expected $EXPECTED_SHA, got $ACTUAL_SHA)" >&2
  rm -f -- "$PARTIAL"
  exit 1
fi

mv -- "$PARTIAL" "$MODEL_FILE"
echo "installed verified canonical model at $MODEL_FILE"
