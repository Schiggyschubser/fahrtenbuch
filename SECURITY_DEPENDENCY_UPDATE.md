# Sicherheitsupdates in 1.0.16

Version 1.0.16 korrigiert zwei zuvor gemeldete Produktionsabhängigkeiten:

- `sharp` von 0.35.4 auf 0.35.5, einschließlich der benötigten nativen Pakete.
  Die Bildbibliothek enthält `librsvg` 2.63.2.
  [Hersteller-Release](https://github.com/lovell/sharp/releases/tag/v0.35.5),
  [Sicherheitsmeldung](https://github.com/advisories/GHSA-wq5f-xc86-pv6w).
- `source-map-js` von 1.2.1 auf 1.2.2, für alle Aufrufer über ein npm-Override.
  [Hersteller-Release](https://github.com/7rulnik/source-map-js/releases/tag/v1.2.2),
  [Sicherheitsmeldung](https://github.com/advisories/GHSA-68fv-2mgg-jv7q).

`package.json` und `package-lock.json` sichern die Versionen. Die übrigen
Paketversionen bleiben gleich. Unterschriftenverarbeitung und getrennte
Druckausgaben werden durch Fach-, Browser- und Image-Tests geprüft.

## Produktions- und Entwicklungsabhängigkeiten

Der Produktions-Audit mit `npm audit --omit=dev --audit-level=high` meldet beim
Release keine bekannten Schwachstellen. Im Linux-AMD64-Laufzeitimage werden
`sharp` 0.35.5 und `librsvg` 2.63.2 geprüft. Das separate Paket `source-map-js`
war im geprüften Standalone-Laufzeitimage nicht enthalten.

Der vollständige Audit einschließlich Entwicklungswerkzeugen enthält einen
weiteren hohen Befund zu
[braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm): stark verschachtelte
Suchmuster können die Verarbeitung zum Absturz bringen. Durch die
Abhängigkeitskette werden fünf Pakete markiert: `braces`, `micromatch`,
`fast-glob`, `@next/eslint-plugin-next` und `eslint-config-next`.
Alle fünf gehören laut Lockfile zu Entwicklungsabhängigkeiten. Diese
Paketversionen wurden beim gezielten Update nicht verändert.

## Update und Rückweg

Das versionierte Image ist `ghcr.io/schiggyschubser/fahrtenbuch:1.0.16`.
Eine Datenbankmigration ist für dieses Update nicht erforderlich.
Port, Mounts, Netzwerke und Umgebungsvariablen bleiben gleich.

Vor dem Update die bisherige Compose-Datei sichern und das bisherige Image
behalten. Nach einer freigegebenen Aktivierung Healthcheck, Versionsanzeige,
Unterschrift und getrennte PDFs prüfen. Für den Rollback die gesicherte
Compose-Datei verwenden, validieren und nur den App-Container neu erstellen.
Die aktuelle Datenbank beibehalten. Der Rollback verwendet wieder die alten
Bibliotheken. Konkrete Befehle: [RELEASE_NOTES.md](RELEASE_NOTES.md).
