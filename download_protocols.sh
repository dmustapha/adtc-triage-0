#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
CONTRACT="$HERE/config/canonical-protocols.json"

file_size() {
  if stat -f%z "$1" >/dev/null 2>&1; then stat -f%z "$1"; else stat -c%s "$1"; fi
}

file_sha256() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}'
  else shasum -a 256 "$1" | awk '{print $1}'; fi
}

verify_file() {
  [[ -f "$1" ]] && [[ "$(file_size "$1")" == "$2" ]] && [[ "$(file_sha256 "$1")" == "$3" ]]
}

node -e '
  const c = require(process.argv[1]);
  if (c.schemaVersion !== 1 || !Array.isArray(c.protocols) || c.protocols.length !== 2) throw new Error("invalid protocol contract");
  for (const p of c.protocols) {
    if (!/^https:\/\/(cdn\.who\.int|iris\.who\.int)\//.test(p.url)) throw new Error("untrusted protocol origin");
    if (!/^data\/protocols\/[A-Za-z0-9._-]+\.pdf$/.test(p.path)) throw new Error("invalid protocol path");
    if (!Number.isSafeInteger(p.bytes) || p.bytes < 1 || !/^[a-f0-9]{64}$/.test(p.sha256)) throw new Error("invalid protocol identity");
    process.stdout.write([p.id, p.url, p.path, p.bytes, p.sha256].join("\t") + "\n");
  }
' "$CONTRACT" | while IFS=$'\t' read -r protocol_id protocol_url relative_path expected_bytes expected_sha; do
  target="$HERE/$relative_path"
  partial="$target.partial"
  mkdir -p "$(dirname "$target")"

  if verify_file "$target" "$expected_bytes" "$expected_sha"; then
    printf '%s already present and verified at %s\n' "$protocol_id" "$target"
    continue
  fi
  if [[ -e "$target" ]]; then
    printf 'error: existing protocol failed verification: %s\n' "$target" >&2
    exit 1
  fi

  curl --fail --location --proto '=https' --retry 3 --retry-all-errors \
    --connect-timeout 20 --max-time 180 --output "$partial" "$protocol_url"
  if ! verify_file "$partial" "$expected_bytes" "$expected_sha"; then
    printf 'error: downloaded protocol failed verification: %s\n' "$relative_path" >&2
    exit 1
  fi
  mv "$partial" "$target"
  printf 'installed verified %s at %s\n' "$protocol_id" "$target"
done
