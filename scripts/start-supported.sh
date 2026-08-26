#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

for unsafe_name in TRIAGE0_DEBUG_ROUTE TRIAGE0_DEBUG_PLAN TRIAGE0_NO_PREWARM TRIAGE0_EGRESS_NONSTRICT; do
  unsafe_value="${!unsafe_name:-false}"
  normalized_value=$(printf '%s' "$unsafe_value" | tr '[:upper:]' '[:lower:]')
  case "$normalized_value" in
    ""|0|false) ;;
    *) printf '%s is incompatible with the supported serving profile.\n' "$unsafe_name" >&2; exit 1 ;;
  esac
done

if [ -n "${RESIDENT_MODE:-}" ] && [ "$RESIDENT_MODE" != "resident" ]; then
  printf 'The supported serving profile requires RESIDENT_MODE=resident.\n' >&2
  exit 1
fi

serve_port="${PORT:-3010}"
if command -v lsof >/dev/null && lsof -nP -iTCP:"$serve_port" -sTCP:LISTEN >/dev/null 2>&1; then
  printf 'Port %s already has a listener; refusing to start a duplicate worker.\n' "$serve_port" >&2
  exit 1
fi

export RESIDENT_MODE=resident
export TRIAGE0_DEBUG_ROUTE=false
export TRIAGE0_DEBUG_PLAN=false
export TRIAGE0_NO_PREWARM=false
export TRIAGE0_EGRESS_NONSTRICT=false
exec ./node_modules/.bin/tsx src/server.ts
