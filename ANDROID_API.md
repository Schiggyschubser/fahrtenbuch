# Android-Anbindung – API v1 (Server 1.0.12)

Basis: `https://DEIN-FAHRTENBUCH-HOST/api/v1`. Die App verwendet dieselbe Serveradresse wie die Weboberfläche. Im privaten Testnetz ist der bestehende Port 1357 verwendbar. Zugangsdaten und Tokens nur über HTTPS oder eine entsprechend geschützte Verbindung übertragen. Es wird kein zusätzlicher Port benötigt.

Alle Antworten sind JSON mit `Cache-Control: no-store`. JSON-Anfragen benötigen `Content-Type: application/json`; maximal 16 KiB. Keine Cookies erforderlich. Außer den beiden Anmelde-Endpunkten benötigen alle Anfragen `Authorization: Bearer <accessToken>`.

## Anmeldung

`POST /auth/login` mit `{"username":"DEIN-BENUTZERNAME","password":"DEIN-PASSWORT"}`.

Erfolg (200): `{"accessToken":"<token>","tokenType":"Bearer","expiresIn":2592000,"expiresAt":"<UTC-ISO-Zeit>"}`.

Bei aktivierter Zwei-Faktor-Anmeldung: `{"requiresTwoFactor":true,"challengeToken":"<challenge>","expiresAt":"<UTC-ISO-Zeit>"}`. Anschließend `POST /auth/two-factor` mit `{"challengeToken":"<challenge>","code":"<Authenticator- oder Backup-Code>"}`. Erst nach erfolgreicher Prüfung wird das Bearer-Token ausgegeben. Challenges gelten fünf Minuten und sind einmal verwendbar.

Tokens gelten 30 Tage, werden serverseitig ausschließlich gehasht gespeichert und beim bestehenden Passwortwechsel ebenfalls widerrufen. `POST /auth/logout` widerruft das übermittelte Token (200, `{"ok":true}`). Kein Refresh-Token: Bei 401 erneut anmelden; die lokale Warteschlange behalten. Zugangsdaten und Tokens niemals in Logs, Quellcode oder Beispieldateien speichern. In Android das Token geschützt speichern, das Passwort nach dem Login verwerfen.

Passwort-Anmeldungen sind pro Serverprozess auf 5 Versuche pro Benutzername und 30 insgesamt pro Minute begrenzt. 429 enthält `Retry-After: 60`. Die Begrenzung wird beim Serverneustart zurückgesetzt.

## Daten für die App laden

| Anfrage | Antwort |
| --- | --- |
| `GET /me` | `{user:{id,username},apiVersion:1}` |
| `GET /bootstrap` | `{apiVersion:1,routes:[…],vehicle:{licensePlate},reimbursement:{reimbursementRateCents},remarks:{templates:[{id,text}],defaultTemplateId}}` |
| `GET /routes` | `{routes:[…]}`; nur aktive Reisewege |
| `GET /trips?month=2026-09` | `{trips:[…],totalKm,totalReimbursedKm,totalUnreimbursedKm,totalPotentialReimbursementCents,suggestedOdometerStart}` |
| `GET /trips/suggested-odometer?date=2026-09-29&startTime=08:15` | `{suggestedOdometerStart:12345}`; ohne vorherige Fahrt `null`; `startTime` optional |

Reiseweg: `{id,placeA,placeB,placeAFullName,placeBFullName,distanceKm,reimbursedKm,unreimbursedKm,durationMinutes}`. `id` als `routePairId` verwenden. Das Fahrtenbuch ist wie die bestehende Webanwendung gemeinsam; es gibt keine getrennten Fahrtenbestände pro App oder Benutzer.

## Fahrt übertragen

`POST /trips`:

```json
{
  "clientTripId": "70eff0ed-120d-4f77-bb21-1f691d8850c4",
  "date": "2026-09-29",
  "startTime": "08:15",
  "endTime": "08:45",
  "routePairId": 1,
  "direction": "A_TO_B",
  "odometerStart": 12345,
  "accompanyingStaff": "",
  "remark": "Besuch"
}
```

`routePairId: 1` ist nur ein Beispiel; ID vorher vom Server laden. Pflichtfelder sind alle außer `accompanyingStaff` und `remark`. `clientTripId` einmal beim lokalen Erstellen der Fahrt als UUID erzeugen und dauerhaft zusammen mit dem Sendeinhalt speichern. Bei einem erneuten Versuch dieselbe UUID und denselben Inhalt verwenden, auch nach einem erneuten Login.

Datum: gültiges Kalenderdatum `YYYY-MM-DD`. Zeiten: lokale Fahrtenbuchzeit `HH:mm`, keine UTC-Konvertierung; Ende muss am selben Tag nach Beginn liegen. Fahrten über Mitternacht und freie GPS-Strecken werden in v1 nicht unterstützt. `direction`: `A_TO_B` oder `B_TO_A`. Kilometerstand: ganze Zahl zwischen 0 und 100000000. Texte: maximal 2000 Zeichen. Unbekannte Felder werden abgewiesen.

Der Server berechnet Kilometer, Endkilometerstand und Erstattung anhand des zum Empfangszeitpunkt gültigen Reisewegs und speichert sie wie bei Web-Eingaben. Die App sendet keinen Endkilometerstand und keine Distanz. Ohne `remark` wird die aktuelle Standardbemerkung verwendet; `remark: ""` bedeutet ausdrücklich leer. Begleitpersonal ist standardmäßig leer.

Neue Fahrt: HTTP **201**, `{clientTripId,duplicate:false,trip:{…}}`.
Wiederholung: HTTP **200**, `{clientTripId,duplicate:true,trip:{…}}`.
Gleiche UUID mit abweichenden Angaben: HTTP **409**, Code `CLIENT_TRIP_ID_CONFLICT`.

Fahrt und Empfangsbestätigung werden in einer gemeinsamen SQLite-Transaktion gespeichert. Die Bestätigung enthält den ursprünglichen Fahrtstand. Sie bleibt auch erhalten, wenn die Fahrt später in der Weboberfläche geändert oder gelöscht wird; eine Wiederholung legt sie nicht erneut an. Aktuelle Fahrtdaten über `GET /trips` abrufen. Der Schutz gilt pro Benutzer und UUID; zwei verschiedene UUIDs gelten als zwei verschiedene Fahrten. Er wird nicht rückwirkend auf CSV- oder Webeinträge angewendet. Bei Wiederherstellung einer älteren Datenbanksicherung gilt deren damaliger Bestätigungsstand.

Fahrtantwort (`trip`): `id`, `sequenceNumber`, `date`, `startTime`, `endTime`, `routePairId`, `direction`, `origin`, `destination`, `originFullName`, `destinationFullName`, `routeLabel`, `distanceKm`, `reimbursedKm`, `unreimbursedKm`, `reimbursementRateCents`, `potentialReimbursementCents`, `odometerStart`, `odometerEnd`, `isChecked`, `accompanyingStaff`, `remark`. Historische CSV-Fahrten können `routePairId: null` und `direction: null` enthalten. `sequenceNumber` ist keine stabile ID.

## Fehler und Offline-Warteschlange

Fehlerformat: `{code:"VALIDATION_ERROR",error:"…",issues:[{path:["date"],message:"…"}]}`; `issues` nur bei Validierungsfehlern.

| Status / Code | Verhalten der App |
| --- | --- |
| 400 `VALIDATION_ERROR`, `INVALID_JSON` | Eingabe korrigieren; nicht blind wiederholen |
| 401 `UNAUTHORIZED`, `INVALID_CREDENTIALS`, `INVALID_TWO_FACTOR` | Anmeldung bzw. zweiten Faktor erneut prüfen |
| 409 `CLIENT_TRIP_ID_CONFLICT` | Konflikt anzeigen; keine neue UUID automatisch erzeugen |
| 409 `ROUTE_UNAVAILABLE` | Reisewege aktualisieren; Benutzer neuen Reiseweg wählen lassen |
| 413 `BODY_TOO_LARGE` / 415 `JSON_REQUIRED` | Anfrageformat korrigieren |
| 429 `RATE_LIMITED` | `Retry-After` beachten |
| 500 `INTERNAL_ERROR`, Timeout oder Verbindungsabbruch | Mit derselben UUID und gleichem Inhalt verzögert wiederholen |

Nach 200 oder 201 als synchronisiert markieren und `trip.id` speichern. Bei unbekanntem Ausgang Payload unverändert behalten. Einzelne Fahrten nacheinander übertragen; v1 bietet keinen Batch-Upload und keine Bearbeitungs- oder Lösch-Endpunkte. Bearbeitung weiterhin in der Weboberfläche. Vor dem Offlinebetrieb Reisewege laden und lokal zwischenspeichern.

## Test und Aktivierung

Die API wird mit einer separaten Testdatenbank geprüft, einschließlich Anmeldung/2FA, Token-Ablauf und Widerruf, Dubletten, Konflikten, Transaktionsfehlern, Reiseweg-Archivierung und Eingabeprüfung. Bestehende Repository-, CSV-, Backup- und Migrationstests bleiben Bestandteil des Testlaufs.

Produktive Aktivierung erst nach Freigabe gemäß `/opt/AGENTS.md`: Datenbank konsistent sichern, Image `ghcr.io/schiggyschubser/fahrtenbuch:1.0.12` einsetzen und ausschließlich den Fahrtenbuch-Dienst neu erstellen. Beim Start wird die zusätzliche Tabelle `mobile_trip_submissions` angelegt. Bestehende Tabellenwerte werden nicht verändert. Compose ändert ausschließlich den Image-Tag; Port 1357, Datenvolume, Netzwerke und Umgebungsvariablen bleiben erhalten. Das versionierte Image wird durch den GitHub-Workflow für AMD64 und ARM64 auf GHCR veröffentlicht.

Nach Aktivierung: Containerstatus `healthy`, Loginseite mit Version 1.0.12, `GET /api/v1/me` ohne Token muss 401 liefern. Danach in der App anmelden und Reisewege abrufen. Eine echte Probefahrt nur mit Zustimmung anlegen.

Rollback: gesicherte Compose-Datei mit dem vorherigen Image 1.0.11 verwenden, `docker compose config --quiet` prüfen und nur `fahrtenbuch` mit `docker compose up -d --no-build --pull never fahrtenbuch` neu erstellen. Aktuelle Datenbank beibehalten; die zusätzliche Tabelle stört die alte Version nicht. Keine Datenbank zurückkopieren, keine Volumes löschen. Bereits angenommene App-Fahrten bleiben im Web sichtbar; die v1-API ist nach dem Rollback nicht verfügbar.
