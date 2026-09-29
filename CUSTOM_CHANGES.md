# Änderungen dieser Custom-Version

Ausgangsbasis ist das unveränderte Fahrtenbuch **1.0.4** unter MIT-Lizenz. Ab diesem Stand erhält jede zusammengehörige Änderung eine fortlaufende Versionsnummer ohne `custom`-Suffix.

## 1.0.11

- Funktionen aus den Upstream-Versionen 1.0.8 und 1.0.9 integriert: Fahrttexte, Bemerkungsvorlagen, Kennzeichen, Spaltenauswahl, vollständiger CSV-Austausch und mehrseitiger A4-/PDF-Druck.
- Direkte Zeiteingabe `0815` → `08:15`; Uhr-Popup nur auf ausdrücklichen Klick.
- Eigene Themes und Footer beibehalten; Druckfarben unabhängig vom Theme.
- Sicherheitskorrekturen für Abhängigkeiten übernommen.
- Compose auf das feste Release-Image 1.0.11 gesetzt.
- Details, Herkunft, Test und Rollback: [RELEASE_NOTES.md](RELEASE_NOTES.md).

## 1.0.10

- Theme-Auswahl auf zehn moderne Fahrtenbuch-Designs erweitert.
- Fünf helle Themes: Atlas, Dispatch, Fleet, Paper Trail und Charge.
- Fünf dunkle Themes: Night Drive, Asphalt, Control Room, Tunnel und Garage.
- Seitenhintergrund zugunsten einer ruhigeren App-Optik geglättet.
- Versionierungs-Skripte akzeptieren nun auch Compose-Dateien, die ein fertiges Image statt eines lokalen Build-Blocks verwenden.
- Produktive Compose-Datei zeigt auf das eigene GHCR-Image `ghcr.io/schiggyschubser/fahrtenbuch:latest`.
- Dev-Docker-Build korrigiert, indem der benötigte Entrypoint wieder im Build-Kontext bleibt.
- GitHub-Docker-Workflow korrigiert, sodass GHCR-Image-Namen mit kleingeschriebenem Repository-Owner veröffentlicht werden.
- Sichtbarer Footer-Hinweis auf `© Schudi, based on CelduinX` geändert.

## 1.0.9

- Automatische Versionsanhebung für jeden Git-Commit ergänzt.
- `VERSION` als zentrale, leicht lesbare Projektversion eingeführt.
- `package.json`, `package-lock.json`, Docker-Buildversion und In-App-Changelog werden automatisch synchronisiert.
- Standardmäßig wird die Patch-Version erhöht; Minor-, Major- und konkrete Versionssprünge sind möglich.
- Initialisierungsskript `scripts/init-git.sh` ergänzt.
- Konsistenzprüfung über `npm run version:check` und `make version-check` ergänzt.

## 1.0.8

- Neuer Bereich **Einstellungen → Darstellung**.
- Drei helle Themes: Route Light, Touring und Electric.
- Drei dunkle Themes: Night Drive, Asphalt und Garage.
- Theme-Auswahl wird im Browser gespeichert und vor dem Rendern angewendet.
- UI-Farben auf semantische CSS-Variablen umgestellt; Druckansichten bleiben neutral und hell.

## 1.0.7

- Session-Cookie funktioniert sowohl beim direkten HTTP-Aufruf als auch hinter einem HTTPS-Reverse-Proxy.
- `SESSION_COOKIE_SECURE=auto|true|false` ergänzt.
- Rettungsskript `scripts/reset-admin.mjs` und Make-Ziel `make reset-admin` ergänzt.

## 1.0.6

- Produktiven Standardport von 3000 auf 1357 geändert.
- Interner Container-Port bleibt 3000.

## 1.0.5

- Produktiver Docker-Build direkt aus dem lokalen Quellcode.
- Separate Entwicklungsumgebung mit Hot-Reload und eigener SQLite-Datenbank.
- Persistente Verzeichnisse `data/` und `data-dev/`.
- `.env.example`, Makefile, Installations- und Backup-Skripte ergänzt.

## 1.0.4

- Unveränderte Ausgangsversion des ursprünglichen Projekts.
