#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker wurde nicht gefunden." >&2
  exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 wurde nicht gefunden." >&2
  exit 1
fi

[ -f .env ] || cp .env.example .env
mkdir -p data data-dev

docker compose build --pull
docker compose up -d
docker compose ps

echo
echo "Fahrtenbuch wurde gestartet. Standardport: 1357"
echo "Erster Login: admin / admin — bitte sofort ändern."
