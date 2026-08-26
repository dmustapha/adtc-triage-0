#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

command -v node >/dev/null || { printf 'Node.js 22+ is required.\n' >&2; exit 1; }
command -v npm >/dev/null || { printf 'npm is required.\n' >&2; exit 1; }

if command -v lsof >/dev/null && lsof -nP -iTCP:3010 -sTCP:LISTEN >/dev/null 2>&1; then
  printf 'Port 3010 already has a listener. Stop the existing app before setup or ingest.\n' >&2
  exit 1
fi

npm ci
bash download_model.sh
bash download_protocols.sh

if ! npm run doctor; then
  printf 'Building the local WHO store. Confirm no Triage-0 server or ingest worker is running.\n'
  npm run ingest
  npm run doctor
fi

npm run typecheck
printf 'Setup complete. Start the supported loopback app with: npm start\n'
