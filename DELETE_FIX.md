# Löschkorrektur und Chronologieschutz · 1.0.17

Nach „Fahrt löschen“ lag die bisherige Rückfrage außerhalb des anklickbaren
Bereichs beziehungsweise hinter der feststehenden Fußleiste. Die Bestätigung
steht jetzt direkt in dieser Fußleiste, mit Fahrtnummer, Abbrechen und Löschen.
Fehler beim Speichern und Löschen bleiben dort sichtbar. Tastaturfokus und
erneute Versuche nach Verbindungsfehlern werden unterstützt.

Laufende Nummern werden weiterhin global aus Datum, Beginn und technischer ID
berechnet. Nach einer Löschung rücken alle späteren Nummern automatisch nach,
auch in Folgemonaten, CSV und Druck. Technische IDs und Kilometerstände bleiben
erhalten. Eine gesonderte Datenbank-Umnummerierung ist nicht erforderlich.

## Chronologieprüfung

Beim Anlegen und Bearbeiten gelten dieselben serverseitigen Regeln für Web,
mobile API und CSV-Import:

- Gültiger Kalendertag; Ende nach Beginn am selben Tag.
- Keine zeitliche Überschneidung mit einer anderen Fahrt. Direkt anschließende
  Fahrten sind erlaubt.
- KM Beginn mindestens so hoch wie die Endstände aller früheren Fahrten.
- KM Ende höchstens so hoch wie die Anfangsstände aller späteren Fahrten.
- Kilometerlücken bleiben erlaubt, beispielsweise für private Fahrten.
- Auch ein Reisewegwechsel berücksichtigt die neue Entfernung und KM Ende.

Bei einem Konflikt meldet die API HTTP 409 mit `TRIP_CHRONOLOGY_CONFLICT`
und einer konkreten deutschen Fehlermeldung. Der Dialog bleibt offen und zeigt
diese Meldung. Es werden keine Fahrtdaten teilweise gespeichert.

Prüfung und Schreiben laufen in derselben synchronen SQLite-Transaktion mit
`BEGIN IMMEDIATE`. Das schützt auch bei gleichzeitigen Anfragen aus mehreren
Prozessen. Mobile Einreichungsbelege bleiben atomar und unverändert abrufbar.
CSV-Dateien werden als vollständiger, gegebenenfalls unsortierter Datensatz
geprüft; bei Konflikten wird der gesamte Import zurückgerollt. Echte Dubletten
werden weiterhin übersprungen. Vor dem Import bleibt die vorhandene automatische
Sicherheitskopie erhalten.

Vorhandene Unstimmigkeiten werden nicht automatisch korrigiert. Reine
Textänderungen an alten Einträgen bleiben möglich. Änderungen an Datum,
Uhrzeiten, Reiseweg oder Kilometerstand müssen die Prüfung bestehen. Löschen
bleibt möglich und ändert keine Kilometerstände anderer Fahrten.

## Prüfung

Die Regressionstests prüfen den ursprünglich verdeckten Löschbutton per
Hit-Test, Abbrechen, Tastaturfokus, Netzwerk-/Gatewayfehler, Nummerierung über
Monatsgrenzen sowie Bearbeitungen auf Desktop und Smartphone. Fachtests decken
die Grenzen beider Nachbarfahrten, Reisewegwechsel, Altbestand, CSV-Rollback,
Kalendertage, Web-/Mobil-Endpunkte und getrennte konkurrierende Prozesse ab.
Der Container-Test verwendet eine flüchtige Datenbank und keine produktiven
Mounts oder Host-Ports. 101 Fachtests und zwölf Browsertests sind bestanden, ebenso ESLint, TypeScript,
Versionskonsistenz, Produktionsbuild und der isolierte Container-Test.

## Update und Rollback

Das Release-Image ist `ghcr.io/schiggyschubser/fahrtenbuch:1.0.17`.
Die Repository-Compose-Datei verwendet diesen festen Tag. Der GitHub-Workflow
baut für Linux AMD64 und ARM64 und veröffentlicht Build-Attestierungen.

Vor dem Update eine konsistente SQLite-Sicherung erstellen, die bisherige
Compose-Datei separat sichern und das vorherige Image behalten. Vor und nach
Änderungen die Compose-Datei validieren. Im üblichen Projektverzeichnis:

```bash
docker compose config --quiet
docker compose pull fahrtenbuch
docker compose config --quiet
docker compose up -d --no-deps --no-build fahrtenbuch
docker compose ps
```

Nur der Image-Verweis ändert sich. Port `1357:3000`, Daten-Mount
`./data:/app/data`, Netzwerke und Umgebungsvariablen bleiben gleich.
Dieses Update ergänzt keine Datenbankmigration und korrigiert keine
vorhandenen Fahrten automatisch.

Kurztest: Der Container muss `healthy` sein und die neu geladene Loginseite
Version 1.0.17 zeigen. Eine Fahrt öffnen und „Fahrt löschen“ auswählen:
Die Bestätigung muss sichtbar sein. Für einen Test ohne Datenänderung
„Abbrechen“ verwenden. Ein widersprüchlicher Bearbeitungsversuch muss eine
sichtbare Fehlermeldung zeigen und die ursprünglichen Fahrtdaten erhalten.

Rollback: Die zuvor gesicherte Compose-Datei mit dem vorherigen Image
zurückkopieren, mit `docker compose config --quiet` prüfen und ausschließlich
den App-Container mit `docker compose up -d --no-deps --no-build --pull never fahrtenbuch`
neu erstellen. Die aktuelle Datenbank beibehalten. Keine Volumes löschen und
keine ältere Datenbanksicherung über inzwischen neu erfasste Fahrten schreiben.
