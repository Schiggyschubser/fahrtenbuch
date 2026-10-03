# Reisewegsuche in Version 1.0.15

Die Auswahl und die API verwenden dieselbe Suchfunktion in `lib/route-options.ts`.
Bei `Coii` erscheinen zuerst `COII → …`, danach Treffer wie `AG → COII`.
Beide Gruppen werden alphabetisch sortiert. Ohne Suchtext sind alle Richtungen
alphabetisch sortiert. Groß-/Kleinschreibung beeinflusst die Suche nicht.

## API

`GET /api/routes?q=Coii`, `GET /api/v1/routes?q=Coii` und
`GET /api/v1/bootstrap?q=Coii` liefern `routeOptions` in dieser Reihenfolge.
Die App übernimmt `routePairId` und `direction` aus der ausgewählten Option.
Das bestehende Feld `routes` enthält weiterhin alle aktiven Streckenpaare.
Details und Client-Anpassung: [ANDROID_API.md](ANDROID_API.md).

## Prüfung

- `npm test`: Sortierung, Leerzeichen, Umlauten, Gegenrichtungen, unbekannte
  Suchtexte, archivierte Strecken und authentifizierte mobile API.
- `npx playwright test tests/e2e/route-search.spec.ts`: Reihenfolge auf Desktop
  und mobil sowie Abgleich mit Web-/Mobil-API und Bootstrap.
- `tests/container-smoke.mjs`: HTTP-Prüfung im gebauten Produktionsimage;
  ausschließlich mit der im Skript verlangten temporären Testdatenbank ausführen.

Test- und Rollback-Anleitung für den Betrieb: [RELEASE_NOTES.md](RELEASE_NOTES.md).
