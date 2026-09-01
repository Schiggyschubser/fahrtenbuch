#!/bin/sh
set -eu

if [ "$(id -u)" = "0" ]; then
  mkdir -p /app/data/backups
  chown -R node:node /app/data
  exec setpriv --reuid=node --regid=node --init-groups "$@"
fi

exec "$@"
