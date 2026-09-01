#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

read_env_value() {
  key="$1"
  [ -f .env ] || return 0
  value="$(sed -n "s/^${key}=//p" .env | tail -n 1)"
  case "$value" in
    \"*\") value="${value#\"}"; value="${value%\"}" ;;
    \'*\') value="${value#\'}"; value="${value%\'}" ;;
  esac
  printf '%s' "$value"
}

if [ -z "${DATA_DIR+x}" ]; then
  DATA_DIR="$(read_env_value DATA_DIR)"
fi
DATA_DIR="${DATA_DIR:-./data}"
BACKUP_ROOT="${BACKUP_ROOT:-./backups-host}"
TIMESTAMP="$(date +%Y-%m-%d_%H-%M-%S)"
TARGET="$BACKUP_ROOT/fahrtenbuch-data-$TIMESTAMP.tar.gz"

if [ ! -d "$DATA_DIR" ]; then
  echo "Datenverzeichnis $DATA_DIR existiert nicht." >&2
  exit 1
fi

mkdir -p "$BACKUP_ROOT"
was_running="$(docker compose ps --status running -q fahrtenbuch 2>/dev/null || true)"

cleanup() {
  if [ -n "$was_running" ]; then
    docker compose start fahrtenbuch >/dev/null
  fi
}
trap cleanup EXIT INT TERM

if [ -n "$was_running" ]; then
  echo "Stoppe den Container kurz für eine konsistente SQLite-Sicherung ..."
  docker compose stop fahrtenbuch >/dev/null
fi

tar -czf "$TARGET" -C "$(dirname "$DATA_DIR")" "$(basename "$DATA_DIR")"

echo "Sicherung erstellt: $TARGET"
