#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

if ! command -v git >/dev/null 2>&1; then
  echo "Git wurde nicht gefunden." >&2
  exit 1
fi

chmod +x .githooks/post-commit scripts/version-commit.mjs scripts/version-check.mjs

if [ ! -d .git ]; then
  git init -b main
fi

if ! git rev-parse --verify HEAD >/dev/null 2>&1; then
  if ! git config user.name >/dev/null || ! git config user.email >/dev/null; then
    echo "Für den ersten Commit benötigt Git einen Namen und eine E-Mail-Adresse." >&2
    echo "Beispiel:" >&2
    echo '  git config --global user.name "Dein Name"' >&2
    echo '  git config --global user.email "du@example.de"' >&2
    exit 1
  fi
  # Der gelieferte Stand wird als feste Ausgangsversion eingecheckt. Erst
  # nachfolgende Entwicklungs-Commits erhöhen die Version automatisch.
  git add .
  git -c core.hooksPath=/dev/null -c commit.gpgSign=false commit -m "Fahrtenbuch Custom $(cat VERSION) als Entwicklungsbasis"
  git tag "v$(cat VERSION)"
fi

git config core.hooksPath .githooks

echo "Git-Versionierung ist aktiv. Aktuelle Version: $(cat VERSION)"
echo "Jeder weitere Commit erhöht standardmäßig die Patch-Version."
