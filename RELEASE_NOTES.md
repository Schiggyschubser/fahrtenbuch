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
