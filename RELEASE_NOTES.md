# Version 1.0.15 · 03.10.2026

- Reisewegsuche: Bei `Coii` zuerst `COII → …`, danach Treffer wie `AG → COII`; beide Gruppen alphabetisch nach deutscher Sortierung unabhängig von Groß-/Kleinschreibung. Ohne Suchtext erscheinen alle Einträge alphabetisch.
- Eine gemeinsame Suchfunktion bestimmt die Reihenfolge in Webauswahl und API.
- `GET /api/routes`, `GET /api/v1/routes` und `GET /api/v1/bootstrap` liefern zusätzlich `routeOptions` mit beiden Fahrtrichtungen; `q` filtert und sortiert nach dem Suchtext.
- Bestehende `routes` bleiben vollständig und kompatibel. `bootstrap.capabilities.routeSearch` zeigt die Unterstützung an. Die Handy-App muss `routeOptions` in der gelieferten Reihenfolge anzeigen.
- Keine Datenbankmigration oder Änderung vorhandener Fahrtwerte.

## Image und Compose für 1.0.15

`docker-compose.yaml` verwendet `ghcr.io/schiggyschubser/fahrtenbuch:1.0.15`.
Der GitHub-Workflow veröffentlicht das Image für Linux AMD64 und ARM64 sowie
das Release `v1.0.15`. Port `1357:3000`, Datenverzeichnis `./data:/app/data`,
Netzwerke und Umgebungsvariablen bleiben unverändert.

## Kurztest und Rollback für 1.0.15

Vor und nach einer Compose-Änderung `docker compose config --quiet` ausführen;
die bisherige Compose-Datei sichern und das zuvor laufende Image behalten.
Nach einer freigegebenen Aktivierung Container-Healthcheck, Versionsanzeige
1.0.15 und die Suche `Coii` prüfen. Die API muss ohne Token HTTP 401 liefern.

Für den Rollback den bisherigen Image-Verweis in der gesicherten Compose-Datei
verwenden, die Konfiguration validieren und nach Freigabe nur den App-Container
mit `docker compose up -d --no-deps --pull never fahrtenbuch` neu erstellen.
Die aktuelle Datenbank beibehalten; keine Volumes löschen und keine
Datenrücksicherung durchführen.

# Version 1.0.14 · 02.10.2026

- Dashboard: Jahresauswahl verwendet die Textfarbe des jeweiligen Themes statt einer dunklen Hintergrundfarbe.
- Einstellungen → Antrag: bearbeitbare Formularfelder für den zweitseitigen Reisekostenantrag, Vorschau und wählbare Voreinstellung für den PDF-Export.
- Druckvorschau: optional beide Originalseiten im Hochformat vor den Fahrten im Querformat; Fahrtenseiten berücksichtigen die beiden Antragsseiten in ihrer Seitennummerierung.
- Unterschriftsdatum: aktueller Ausgabetag in Europe/Berlin, auch bei über Mitternacht geöffneter Vorschau. Haushaltsjahr unabhängig davon über `{{jahr}}` oder frei eingetragen.
- Unterschrift: unter Einstellungen → Antrag als PNG/JPG/WebP hochladen oder mit Finger, Stift oder Maus zeichnen. In der Druckvorschau optional über „Unterschrift einfügen“ auf Seite 1 einsetzen. Gespeicherte Unterschriften sind austauschbar, entfernbar und Teil der Datensicherung. Die Funktion fügt ein sichtbares Unterschriftsbild ein; sie erzeugt keine Zertifikatssignatur.
- Neue nullable Spalte `app_settings.claim_template`; vorhandene Fahrten und Einstellungen bleiben erhalten. Sicherung/Wiederherstellung berücksichtigt die Vorlage; ältere Sicherungen ergeben eine leere Vorlage.
- Öffentliche Formulargrafiken enthalten keine persönlichen Vorgaben. Persönliche Daten werden separat in die Datenbank übernommen.
- Vor Aktivierung konsistente Datenbanksicherung erstellen und bisheriges Image für die Rückkehr bereithalten.

## Image und Compose für 1.0.14

Das Image `ghcr.io/schiggyschubser/fahrtenbuch:1.0.14` wird über GitHub Actions
für Linux AMD64 und ARM64 veröffentlicht. `docker-compose.yaml` verwendet diesen
versionierten Tag. Bei der Umstellung vom lokalen Image 1.0.14 ändert sich nur
der Image-Verweis; Port 1357, Datenverzeichnis und übrige Konfiguration bleiben gleich.

Kurztest: `docker compose config --quiet`, `docker compose config --images` und
den Container-Healthcheck prüfen. Nach einer separat freigegebenen Aktivierung
muss `/login` Version 1.0.14 anzeigen; `/api/v1/me` ohne Token liefert HTTP 401.

Rollback der Compose-Umstellung: gesicherte Compose-Datei wiederherstellen und
mit `docker compose config --quiet` prüfen. Ohne Container-Update ist kein Neustart
nötig. Nach einer Aktivierung das erhaltene lokale Image 1.0.14 verwenden;
Produktionsdaten beibehalten und keine Volumes löschen.

# Version 1.0.13 · 30.09.2026

- Android-API: `GET /api/v1/trips/:id`, `PUT /api/v1/trips/:id` und `DELETE /api/v1/trips/:id`.
- `bootstrap.capabilities.tripManagement` kennzeichnet die Unterstützung; Fahrtantworten enthalten `updatedAt`.
- Änderungen und Löschungen verlangen `expectedUpdatedAt`; ein zwischenzeitlich geänderter Fahrtstand liefert 409 `TRIP_CHANGED`.
- Änderungen an Datum, Uhrzeiten, Kilometerstand und Text erhalten bestehende Reiseweg-/Kilometer-Snapshots. Auch historische CSV-Fahrten sind so bearbeitbar.
- Die ursprüngliche mobile Empfangsbestätigung bleibt nach Bearbeiten oder Löschen unverändert; ein Übertragungs-Retry erzeugt keine zusätzliche Fahrt.
- Keine neue Datenbanktabelle oder Migration. Vor Aktivierung konsistente Sicherung erstellen; bisheriges Image für einen Rollback behalten.
- Next.js und eslint-config-next auf die feste Patch-Version 16.3.8 aktualisiert; Abhängigkeitsprüfung vor Aktivierung erneut durchgeführt.

## Image und Compose

`docker-compose.yaml` verwendet `ghcr.io/schiggyschubser/fahrtenbuch:1.0.13`.
Der GitHub-Workflow veröffentlicht das Image für Linux AMD64 und ARM64 sowie
das GitHub-Release `v1.0.13`. Port `1357:3000`, Datenverzeichnis
`./data:/app/data`, Netzwerke und Umgebungsvariablen bleiben unverändert.

## Kurztest und Rollback für 1.0.13

- Vor und nach der Compose-Änderung `docker compose config --quiet` ausführen;
  vorher die bisherige Compose-Datei sichern und das bisherige Image behalten.
- Nach einer freigegebenen Aktivierung muss der Container `healthy` sein und
  `/login` Version 1.0.13 anzeigen. `/api/v1/me` ohne Token muss HTTP 401 liefern.
- Bearbeiten, Löschen, Revisionskonflikte und Übertragungswiederholungen nur mit
  Testdaten prüfen; `tests/container-smoke.mjs` ist für eine isolierte Testinstanz.
- Für den Rollback die gesicherte Compose-Datei wiederherstellen, mit
  `docker compose config --quiet` prüfen und nach Freigabe
  `docker compose up -d --no-build --pull never fahrtenbuch` ausführen.
  Die aktuelle Datenbank beibehalten; keine Migration oder Datenrücksicherung
  ist für diesen Versionswechsel erforderlich.

# Fahrtenbuch 1.0.12

Die neue Android-API nimmt Fahrten einer nativen App entgegen. App-Einträge erscheinen im selben Fahrtenbuch wie Eingaben über die Weboberfläche.

- Versionierte JSON-Schnittstelle unter `/api/v1` mit Bearer-Token-Anmeldung und bestehender Zwei-Faktor-Prüfung.
- Abruf von Reisewegen, Fahrzeug, Bemerkungsvorlagen, Monatsfahrten und vorgeschlagenem Kilometerstand.
- Fahrtübertragung über `POST /api/v1/trips`. Eine von der App erzeugte UUID verhindert doppelte Einträge bei erneuter Übertragung, auch nach einem Serverneustart.
- Abweichende Angaben unter derselben UUID werden als Konflikt abgewiesen. Fahrt und Empfangsbestätigung werden gemeinsam in einer Transaktion gespeichert.
- Eingabeprüfung, Begrenzung der Anfragegröße und der Passwort-Anmeldeversuche. Tokens werden nur gehasht gespeichert, laufen nach 30 Tagen ab und lassen sich abmelden.
- Die bestehende automatische Datensicherung wird auch bei App-Übertragungen ausgelöst.

API-Vertrag mit Beispielen und Offline-Verhalten: [ANDROID_API.md](ANDROID_API.md).

Die API verwendet konfigurierte Reisewege und deren Kilometerwerte. Freie GPS-Strecken, Fahrten über Mitternacht sowie Bearbeiten und Löschen über die App sind in v1 nicht enthalten.

## Update und Daten

Compose verwendet `ghcr.io/schiggyschubser/fahrtenbuch:1.0.12`. Port `1357:3000`, Datenverzeichnis `./data:/app/data`, Netzwerke und Umgebungsvariablen bleiben gleich. Das Image wird für Linux AMD64 und ARM64 veröffentlicht.

Vor dem Update eine konsistente SQLite-Sicherung erstellen und das bisherige Image behalten. Beim Start wird ausschließlich die zusätzliche Tabelle `mobile_trip_submissions` für Empfangsbestätigungen ergänzt; bestehende Fahrtwerte bleiben erhalten. Die Migration ist wiederholbar.

## Validierung

66 Unit-/Integrationstests einschließlich Anmeldung, Zwei-Faktor-Prüfung, Token-Widerruf, Wiederholungen, Konflikten, Transaktions-Rollback und Migration. Linter, TypeScript, Versionsprüfung und Produktionsbuild erfolgreich. Ein isolierter Container-Test prüft echte HTTP-Anfragen, Neustart, Wiederholung, Sichtbarkeit in der Weboberfläche und Abmeldung.

## Kurztest

1. Container muss `healthy` sein; Loginseite zeigt Version 1.0.12.
2. `GET /api/v1/me` ohne Token liefert HTTP 401.
3. Über `/api/v1/auth/login` und gegebenenfalls `/api/v1/auth/two-factor` anmelden; `/api/v1/bootstrap` mit Bearer-Token abrufen.
4. In einer Testinstanz dieselbe Fahrt zweimal mit identischer `clientTripId` senden: zuerst HTTP 201, danach HTTP 200 und `duplicate: true`; in der Weboberfläche steht genau eine Fahrt.

## Rollback

Mit gesicherter Compose-Datei und aufbewahrtem Image wieder Version 1.0.11 starten. Zuerst `docker compose config --quiet`, danach `docker compose up -d --no-build --pull never fahrtenbuch`. Die aktuelle Datenbank beibehalten: Die zusätzliche Tabelle stört die ältere Version nicht und angenommene App-Fahrten bleiben sichtbar. Die v1-API ist nach dem Rollback nicht verfügbar. Keine Volumes löschen und keine Datenbanksicherung ohne gesonderte Freigabe zurückspielen.
