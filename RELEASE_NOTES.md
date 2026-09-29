# Fahrtenbuch 1.0.11

Übernahme der Erweiterungen aus CelduinX/fahrtenbuch 1.0.8 und 1.0.9 in die eigene Version 1.0.10.

- Ausgeschriebene Start- und Zielorte, mitgenommene Bedienstete sowie frei bearbeitbare Bemerkungsvorlagen mit Standardtext.
- KFZ-Kennzeichen in den Einstellungen und im Ausdruck.
- Unabhängig gespeicherte Spaltenauswahl für Fahrtenübersicht und Druck.
- A4-Querformat mit skalierter Vorschau, Seitenzahlen und Fortsetzungszeilen für lange Einträge. PDF-Ausgabe über **Fahrten → Drucken → Drucken / PDF → Als PDF speichern**.
- Vollständiger CSV-Export mit Fahrttexten und Erstattungsangaben. Import bisheriger CSV-Dateien mit 6 oder 10 Spalten weiterhin möglich, einschließlich Dublettenprüfung und Sicherung vor dem Import.
- `0815` wird beim Tippen zu `08:15`. Das Uhr-Popup öffnet nur noch über das Uhrsymbol. Funktioniert beim Anlegen und Bearbeiten; automatische Endzeit bleibt erhalten.
- Alle zehn eigenen Themes und der eigene Footer bleiben erhalten. Druck und PDF bleiben auch bei dunklen Themes hell.
- Aktualisierte Abhängigkeiten: Next.js/ESLint-Konfiguration 16.3.5, Sharp 0.35.4, PostCSS 8.5.28, Vitest 4.1.11 und korrigierte transitive Pakete.

PDF-Import ist im Ursprungsprojekt nicht enthalten. Der Datenaustausch erfolgt per CSV; PDF dient der Ausgabe.

## Herkunft und Abgleich

- 1.0.8: [d52030b](https://github.com/CelduinX/fahrtenbuch/commit/d52030b6c3d40b5175b89534da2e900ea731a113)
- 1.0.9: [f289e50](https://github.com/CelduinX/fahrtenbuch/commit/f289e50d00366e9fdbc5a81e9b61fc5049241e36)
- Eigene Ausgangsversion: `dfc8b4a` (1.0.10). Die Versionsreihen beider Projekte sind unabhängig.
- Die zwei Funktionsänderungen wurden gezielt übernommen. Eigene Navigation, Datumsvorgabe, Docker-Betrieb und Themes wurden beibehalten. Der eigene Multiarch-Workflow bleibt bestehen.

## Update und Daten

Vor dem Start eine konsistente SQLite-Sicherung anlegen und das alte Image behalten. Beim ersten Start ergänzt die Anwendung neue Spalten und die Tabelle `remark_templates`. Vorhandene Fahrtangaben bleiben erhalten. Die Erweiterung ist wiederholbar.

Compose verwendet das feste Image `ghcr.io/schiggyschubser/fahrtenbuch:1.0.11`. Port `1357:3000`, Datenverzeichnis `./data:/app/data`, Netzwerke und Umgebungsvariablen bleiben gleich.

## Validierung

58 Unit-/Integrationstests einschließlich wiederholter Migration einer gefüllten Alt-Datenbank, fünf Browserabläufe, Linter, TypeScript, Versionsprüfung, Produktionsbuild und isolierter Container-Smoke-Test. Der Paketcheck meldet keine bekannten Schwachstellen.

## Kurztest

1. Neue Fahrt öffnen, `0815` als Beginn eingeben: Anzeige `08:15`, kein automatisches Uhr-Popup, korrekte Endzeit nach Reisewegauswahl.
2. Unter Einstellungen Bemerkungsvorlage und Kennzeichen speichern. Eine Fahrt mit diesen Angaben anlegen.
3. CSV exportieren und in einer separaten Testinstanz importieren; vorhandene Dubletten werden übersprungen.
4. Druckansicht öffnen, Spalten wählen und als PDF speichern. Kennzeichen, Seitenzahlen und Fahrttexte prüfen.

## Rollback

Mit dem vor dem Update gesicherten Compose-Stand und dem aufbewahrten Image wieder Version 1.0.10 starten. Die zusätzlichen Datenbankfelder sind mit der alten Anwendung verträglich; ein Image-Rollback benötigt keine Datenbankwiederherstellung. Neue Funktionen sind dann nicht verfügbar. Eine Datenbanksicherung nur nach gesonderter Freigabe zurückspielen, da dies spätere Eingaben überschreiben würde.
