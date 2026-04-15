#!/bin/sh
set -eu

LOCKFILE="/app/package-lock.json"
HASH_FILE="/app/node_modules/.package-lock.hash"

if [ ! -f "$LOCKFILE" ]; then
  echo "[frontend] package-lock.json not found. Running npm install..."
  npm install
else
  CURRENT_HASH="$(sha256sum "$LOCKFILE" | awk '{print $1}')"
  PREVIOUS_HASH=""

  if [ -f "$HASH_FILE" ]; then
    PREVIOUS_HASH="$(cat "$HASH_FILE")"
  fi

  if [ ! -d /app/node_modules ] || [ "$CURRENT_HASH" != "$PREVIOUS_HASH" ]; then
    echo "[frontend] Dependencies changed (or missing). Running npm ci..."
    npm ci
    mkdir -p /app/node_modules
    echo "$CURRENT_HASH" > "$HASH_FILE"
  else
    echo "[frontend] Dependencies are up to date."
  fi
fi

exec npm run dev -- --host 0.0.0.0 --port 5173
