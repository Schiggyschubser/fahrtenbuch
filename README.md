# Fahrtenbuch Custom – lokale Entwicklungsbasis

Version **1.0.13**: [Android-API v1](ANDROID_API.md) mit Bearer-Anmeldung, idempotenter Übernahme sowie Bearbeiten und Löschen von Fahrten mit Prüfung des zuletzt geladenen Fahrtstands.
Versioniertes Image: `ghcr.io/schiggyschubser/fahrtenbuch:1.0.13` für Linux AMD64 und ARM64.

Aktuelle Erweiterungen und Updatehinweise: [Version 1.0.13](RELEASE_NOTES.md). Der produktive Compose-Stand verwendet das eigene versionierte GHCR-Image. PDF-Ausgabe erfolgt über die Druckansicht, Import und Export von Fahrtdaten erfolgen per CSV. Uhrzeiten können direkt als vier Ziffern eingegeben werden, etwa `0815` für `08:15`.

Diese Version basiert auf dem Projekt **Fahrtenbuch 1.0.4**. Die konkrete Version dieses Projektstands steht in der Datei `VERSION` und wird auch im Footer der Anwendung angezeigt. Der Ordner ist so vorbereitet, dass du ihn auf deinen Docker-Host kopieren, lokal bauen und anschließend mit fortlaufender Versionsnummer weiterentwickeln kannst.

Die Anwendung selbst ist eine Next.js-/TypeScript-Webanwendung mit SQLite-Datenbank. Produktions- und Entwicklungsdaten sind voneinander getrennt.

## Ordner auf den Server kopieren

Empfohlenes Ziel:

```bash
sudo mkdir -p /opt/fahrtenbuch
sudo chown "$USER":"$USER" /opt/fahrtenbuch
```

Kopiere danach den gesamten Inhalt dieses Projekts nach `/opt/fahrtenbuch` und wechsle in den Ordner:

```bash
cd /opt/fahrtenbuch
```

## Produktiv starten

Schnellstart:

```bash
./scripts/install-local.sh
```

Alternativ Schritt für Schritt:

```bash
cp .env.example .env
mkdir -p data data-dev
docker compose up -d --build
```

Die Anwendung ist standardmäßig erreichbar unter:

```text
http://SERVER-IP:1357
```

Erster Login:

```text
Benutzername: admin
Passwort: admin
```

Ändere die Zugangsdaten unmittelbar nach dem ersten Login.

## Was gegenüber der ursprünglichen Compose-Datei geändert wurde

Die produktive `docker-compose.yaml` verwendet kein fremdes Fertig-Image mehr als Quelle, sondern baut das Image aus den Dateien in diesem Ordner:

```yaml
build:
  context: .
  dockerfile: Dockerfile
```

Damit werden deine Änderungen beim nächsten Build tatsächlich übernommen:

```bash
docker compose up -d --build
```

## Konfiguration

Kopiere `.env.example` nach `.env`. Wichtige Werte:

```dotenv
APP_PORT=1357
BIND_ADDRESS=0.0.0.0
DATA_DIR=./data
IMAGE_NAME=fahrtenbuch-local
IMAGE_TAG=latest
TZ=Europe/Berlin
```

Für einen anderen Port beispielsweise:

```dotenv
APP_PORT=4534
```

Danach:

```bash
docker compose up -d
```

## Darstellung und Themes

Unter **Einstellungen → Darstellung** stehen zehn moderne, an das Fahrtenbuch angelehnte Designs bereit:

- Atlas – helle Navigationsansicht mit Kartenblau und Flotten-Grau
- Dispatch – Disponenten-Design mit Petrol, Asphaltgrau und Signalgelb
- Fleet – frische Fuhrpark-Optik mit Grün und weichen Kartenflächen
- Paper Trail – modernes Fahrtenbuch-Papier mit warmer Tinte
- Charge – helles EV-Cockpit mit Cyan und präzisen UI-Linien
- Night Drive – dunkles Nachtfahrt-Cockpit mit Cyan-Licht
- Asphalt – dunkler Straßenbelag mit Markierungsgelb
- Control Room – Leitstand-Theme mit Teal, Graphit und Statusgrün
- Tunnel – gedämpftes Tunnellicht mit Grün und Amber
- Garage – Werkstatt-Nacht mit Rücklicht-Rot und warmem Metall

Die Auswahl wird im Browser gespeichert und beim nächsten Aufruf automatisch wiederhergestellt. Die Druckansicht bleibt unabhängig vom gewählten Theme weiß und druckerfreundlich.

## Entwicklung mit Hot-Reload

Die Entwicklungsumgebung nutzt Port 3001 und eine eigene Datenbank unter `./data-dev`:

```bash
cp .env.example .env
make dev
```

Oder ohne Makefile:

```bash
docker compose -f docker-compose.dev.yaml up --build
```

Aufruf:

```text
http://SERVER-IP:3001
```

Änderungen an Dateien unter `app/`, `components/` und `lib/` werden durch Next.js automatisch neu geladen. Die Node-Abhängigkeiten liegen in einem separaten Docker-Volume. Wenn sich `package-lock.json` ändert, installiert der Entwicklungscontainer sie automatisch neu.

Entwicklungsumgebung beenden:

```bash
make dev-down
```

Node-Volume vollständig zurücksetzen:

```bash
make clean-dev
```

## Eigene Git-Historie und automatische Versionierung starten

Der Ordner enthält keine fremde `.git`-Historie. Richte die eigene Historie mit folgendem Skript ein:

```bash
./scripts/init-git.sh
```

Das Skript übernimmt den gelieferten Stand zunächst unverändert als Version `1.0.9` und aktiviert danach die automatische Versionsverwaltung. Jeder folgende Commit erhöht standardmäßig die Patch-Version:

```text
1.0.9 → 1.0.10 → 1.0.11
```

Beispiel:

```bash
git add .
git commit -m "Zusätzliches Pflichtfeld ergänzt"
```

Für eine größere, weiterhin abwärtskompatible Funktion kannst du die Minor-Version erhöhen:

```bash
VERSION_BUMP=minor git commit -m "Mehrere Fahrzeuge ergänzt"
```

Für inkompatible Änderungen steht `VERSION_BUMP=major` zur Verfügung. Die Versionsnummer wird automatisch in `VERSION`, `package.json`, `package-lock.json`, `docker-compose.yaml` und dem sichtbaren Changelog synchronisiert.

Prüfung:

```bash
make version
make version-check
```

Die produktiven und Entwicklungsdatenbanken sowie `.env` werden durch `.gitignore` ausgeschlossen.

## Empfohlener Arbeitsablauf

1. Entwicklungsumgebung starten: `make dev`
2. Quellcode bearbeiten und auf Port 3001 testen.
3. Tests ausführen: `make test`
4. Linter ausführen: `make lint`
5. Produktives Image bauen und starten: `make up`
6. Produktive Logs prüfen: `make logs`

## Häufige Befehle

```bash
make init       # .env und Datenordner vorbereiten
make build      # produktives Image bauen
make up         # bauen und produktiv starten
make down       # produktiven Stack beenden
make logs       # produktive Logs verfolgen
make ps         # Containerstatus anzeigen
make dev        # Entwicklungsserver mit Hot-Reload
make test       # Vitest im Entwicklungscontainer
make lint       # ESLint im Entwicklungscontainer
make backup     # konsistente Host-Sicherung des Datenordners
make git-init    # Git-Historie und Versions-Hook einrichten
make version     # aktuelle Projektversion anzeigen
make version-check # Versionsdateien auf Konsistenz prüfen
```

Die Befehle funktionieren auch direkt ohne Makefile, beispielsweise:

```bash
docker compose logs -f fahrtenbuch
docker compose restart fahrtenbuch
docker compose down
```

## Persistente Daten

Produktiv:

```text
./data/fahrtenbuch.db
./data/backups/
```

Entwicklung:

```text
./data-dev/fahrtenbuch.db
./data-dev/backups/
```

Ein Container-Rebuild löscht diese Ordner nicht. Lösche sie nur nach einer geprüften Sicherung.

## Host-Sicherung

```bash
make backup
```

Das Skript stoppt einen laufenden produktiven Container kurz, archiviert den vollständigen Datenordner konsistent und startet ihn anschließend wieder. Die Archive landen unter:

```text
./backups-host/
```

Zusätzlich können Sicherungen innerhalb der Anwendung erstellt und wiederhergestellt werden.

## Änderungen am Datenbankschema

Bei neuen Feldern oder Tabellen darf eine bestehende produktive Datenbank nicht einfach vorausgesetzt oder überschrieben werden. Ergänze dafür eine idempotente Migration in `lib/db/index.ts` oder eine neue versionierte Migration unter `lib/db/migrations/`.

Vor Schemaänderungen:

```bash
make backup
```

## Reverse Proxy

Für Nginx Proxy Manager kann als Forward Hostname/IP die IP des Docker-Hosts und als Forward Port der in `.env` festgelegte `APP_PORT` verwendet werden. Aktiviere HTTPS und veröffentliche die Anwendung nicht unverschlüsselt im Internet.

## Projektbereiche

```text
app/                 Seiten und API-Routen
components/          Oberfläche und Dialoge
lib/                 Geschäftslogik, Datenbank und Repositories
lib/db/migrations/   Datenbankmigrationen
public/              Bilder und statische Dateien
tests/               Unit-, Integrations- und E2E-Tests
Dockerfile           produktives Image
Dockerfile.dev       Entwicklungsimage
docker-compose.yaml  produktiver lokaler Build
docker-compose.dev.yaml Entwicklungsserver
```

## Lizenz und Ursprung

Das Ursprungsprojekt steht unter der MIT-Lizenz. Der vorhandene Lizenz- und Copyright-Hinweis bleibt erhalten. Eigene Änderungen dürfen ergänzt, weiterentwickelt und verteilt werden, solange die MIT-Lizenzbedingungen eingehalten werden.

Die ursprüngliche Dokumentation liegt in `README-UPSTREAM.md`. Die infrastrukturellen Änderungen dieser Basis sind in `CUSTOM_CHANGES.md` dokumentiert.
