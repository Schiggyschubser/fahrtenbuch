#!/bin/sh
set -eu

mkdir -p /app/data/backups /app/node_modules

if [ ! -f /app/package-lock.json ]; then
  echo "package-lock.json fehlt; Quellcode wurde nicht nach /app eingebunden." >&2
  exit 1
fi

lock_hash="$(sha256sum /app/package-lock.json | awk '{print $1}')"
stored_hash=""
if [ -f /app/node_modules/.fahrtenbuch-lock-hash ]; then
  stored_hash="$(cat /app/node_modules/.fahrtenbuch-lock-hash)"
fi

if [ ! -x /app/node_modules/.bin/next ] || [ "$lock_hash" != "$stored_hash" ]; then
  echo "Installiere Node-Abhängigkeiten für die Entwicklungsumgebung ..."
  npm ci
  printf '%s' "$lock_hash" > /app/node_modules/.fahrtenbuch-lock-hash
fi

if [ "$#" -gt 0 ]; then
  exec "$@"
fi

exec npm run dev -- --hostname 0.0.0.0
