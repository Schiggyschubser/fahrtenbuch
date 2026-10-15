# Begrenzte Kilometerkorrektur

Version 1.0.18 auf Basis von 1.0.17. Versioniertes Image für Linux AMD64 und ARM64:
`ghcr.io/schiggyschubser/fahrtenbuch:1.0.18`.
[GitHub-Release v1.0.18](https://github.com/Schiggyschubser/fahrtenbuch/releases/tag/v1.0.18).

## Bedienung

Eine Fahrt öffnen, Reiseweg beziehungsweise KM Beginn korrigieren und
„Speichern“ wählen. Ändert sich dadurch der Endstand, erscheint vor dem
Schreiben eine Vorschau mit alter/neuer Kilometerzahl und der Differenz.

„Kilometer verschieben bis einschließlich“ bietet:

- „Keine nachfolgenden Fahrten ändern“ (Vorauswahl).
- Jede zeitlich nachfolgende Fahrt mit globaler Fahrtnummer, Datum, Beginn und
  Reiseweg, auch aus späteren Monaten und Jahren.

Beispiel: Bei Bearbeitung von Nr. 116 mit Endfahrt Nr. 120 werden ausschließlich
Nr. 117 bis einschließlich Nr. 120 um dieselbe Differenz verschoben. Nr. 121 und
alle späteren Fahrten bleiben unverändert. Die App zeigt Anzahl und Verschiebung
der Folgefahrten sowie die alten und neuen Stände der gewählten Endfahrt.
Erst „Änderung bestätigen“ speichert. „Zurück zur Bearbeitung“ erhält die
Eingaben; Abbrechen beziehungsweise Schließen speichert nichts.

Die Differenz ist **neuer Endstand minus bisheriger Endstand**. Bei Folgefahrten
verschieben sich Anfang und Ende; Strecke, Abrechnung, Kennzeichnung und Texte
bleiben erhalten. Auch importierte Fahrten ohne verknüpften Reiseweg werden
unterstützt. Bei unverändertem Endstand entfällt die Bereichsauswahl.

Privatkilometer ergeben sich ausschließlich aus dem Anfangsstand einer Fahrt
minus Endstand der vorherigen Fahrt. Innerhalb des verschobenen Bereichs
bleibt diese Differenz gleich. Zur ersten unveränderten Fahrt darf sie kleiner
oder größer werden. Ein negativer Abstand wird als Konflikt abgelehnt; der
Bereich wird niemals ohne Auswahl erweitert.

## Speicherung

Vor einer Bereichskorrektur wird über die bestehende Backup-Funktion eine
Sicherheitskopie erstellt. Schlägt die Sicherung fehl, wird nichts geändert.
Anschließend werden die bearbeitete Fahrt und alle gewählten Folgefahrten in
einer gemeinsamen SQLite-Schreibtransaktion aktualisiert. Die Zeit- und
Kilometerprüfung prüft den gesamten endgültigen Zustand einschließlich beider
unveränderter Grenzen. Ein Fehler rollt sämtliche Fahrtenänderungen zurück.

Die Vorschau ist an die Eingaben, den gewählten Reiseweg und den Fahrtenbestand
gebunden. Zwischenzeitliche Änderungen, Einfügungen oder Löschungen erfordern
eine neue Vorschau. Das gilt auch während der asynchronen Sicherung. Geänderte
Folgefahrten erhalten neue `updatedAt`-Revisionen für bestehende mobile Clients.
Eine gleichzeitige Änderung der zeitlichen Fahrtreihenfolge muss separat
gespeichert werden, damit der ausgewählte Bereich eindeutig bleibt.

Es gibt keine Datenbankmigration. Ports, Volumes, Netzwerke und
Umgebungsvariablen werden durch diese Erweiterung nicht geändert.

## Web-API

`POST /api/trips/:id/odometer-adjustment` erhält die vorgesehenen Felder wie
beim Bearbeiten sowie optional `expectedUpdatedAt`. Der angemeldete Nutzer
erhält `{ preview }` mit Differenz, Endständen, Folgefahrten und `revision`.
Dieser Aufruf verändert keine Fahrten und erzeugt keine Sicherung.

`PATCH /api/trips/:id` erhält die gleichen Bearbeitungsfelder sowie:

```json
{
  "odometerAdjustment": {
    "throughTripId": 120,
    "revision": "<revision aus der Vorschau>"
  }
}
```

`throughTripId` ist die stabile technische ID der gewählten Endfahrt, nicht
deren sichtbare laufende Nummer. `null` bedeutet keine Folgekorrektur. Ohne
`odometerAdjustment` bleibt das bisherige Verhalten bestehen. Die vorhandene
mobile API bleibt kompatibel; ein separater nativer Android-Client erhält durch
diese Änderung keinen neuen Dialog.

## Test und Rückweg

Automatisch: `npm test`, `npm run lint`, `npx tsc --noEmit` und
`npx playwright test tests/e2e/trip-odometer.spec.ts tests/e2e/trip-edit-chronology.spec.ts tests/e2e/trip-delete.spec.ts`.
Die Tests verwenden getrennte Testdatenbanken, keine produktiven Fahrten.

Geprüft am 15.10.2026: 124 Fachtests und alle 14 Browsertests
bestanden, darunter Desktop und Smartphone, Löschen, Chronologieschutz,
Bereichskorrektur, Druckausgaben und Einstellungen. ESLint, TypeScript, `git diff --check` und der
Produktionsbuild mit eigener Prüfdatenbank sind erfolgreich. Die Sandbox
blockiert interne Test-/Build-Sockets und Unterprozesse; die betreffenden
Prüfungen liefen mit Freigabe außerhalb der Sandbox. Die Tests verändern keine
produktive Installation.

Manuell nur mit Testdaten: Vier Fahrten mit 1000–1020, 1035–1055, 1060–1080 und
1100–1120 km anlegen. Die erste Fahrt auf eine Strecke von 30 km ändern und bis
zur dritten Fahrt verschieben. Erwartet: 1000–1030, 1045–1065, 1070–1090 und
unverändert 1100–1120 km. Privatkilometer: 15, 5 und jetzt 10 km. Danach eine
Verkürzung ohne Folgekorrektur prüfen; alle späteren Stände bleiben erhalten.
Eine zu große Verlängerung muss vollständig abgelehnt werden, wenn sie über
den Anfangsstand der ersten unveränderten Fahrt hinausreicht.

Vor einem produktiven Update bisheriges Image und Compose-Datei
aufbewahren und eine konsistente Sicherung erstellen. Beim Rollback auf das
bisherige Image die aktuelle Datenbank beibehalten; sie ist kompatibel und
enthält möglicherweise inzwischen neu erfasste Fahrten. Vor einer Änderung
der Compose-Datei und vor dem Start `docker compose config --quiet` ausführen.
Keine Volumes löschen. Ein Software-Rollback macht bereits bestätigte
Kilometerkorrekturen nicht rückgängig. Diese lassen sich durch eine umgekehrte
Korrektur desselben Bereichs zurücknehmen, solange der Bereich unverändert ist;
ansonsten die Sicherung gezielt prüfen, statt neue Fahrten mit einer alten
Datenbank zu überschreiben.

## Installation des veröffentlichten Images

Im bisherigen Compose-Projektverzeichnis zunächst die vorhandene Konfiguration
validieren und separat sichern. Nur den Image-Verweis auf
`ghcr.io/schiggyschubser/fahrtenbuch:1.0.18` ändern und erneut validieren.
Port `1357:3000`, Daten-Mount `./data:/app/data`, Netzwerke und
Umgebungsvariablen bleiben gleich. Danach ausschließlich den App-Container
aktualisieren:

```bash
docker compose config --quiet
docker compose pull fahrtenbuch
docker compose up -d --no-deps --no-build fahrtenbuch
docker compose ps
```

Der Container muss `healthy` sein und die Loginseite Version 1.0.18 zeigen.
Nach dem Neuladen die Kilometer-Vorschau öffnen und für einen Test ohne
Fahrtdatenänderung zurückgehen und abbrechen.

Für den Software-Rollback die aktuelle Compose-Datei erneut separat sichern,
die vorherige gesicherte Compose-Datei einsetzen und prüfen. Mit
`docker compose up -d --no-deps --no-build --pull never fahrtenbuch` das
vorherige lokal vorhandene Image starten. Die aktuelle Datenbank beibehalten.
