# Mitwirken

Beiträge sind willkommen. Für die lokale Entwicklung werden Node.js 24 und npm benötigt.

```bash
npm ci
npm run dev
```

Vor einem Pull Request müssen mindestens diese Prüfungen erfolgreich sein:

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

Die Anwendung verwendet Next.js, SQLite und Drizzle ORM. Lokale Daten liegen unter `data/` und dürfen nicht committet werden.

Die automatische Versionsverwaltung wird pro Arbeitskopie einmalig eingerichtet:

```bash
./scripts/init-git.sh
```

Der gelieferte Stand bleibt dabei auf seiner aktuellen Version. Ab dem nächsten Entwicklungs-Commit wird standardmäßig die Patch-Version erhöht und der In-App-Changelog ergänzt.

```bash
git add .
git commit -m "Validierung für Kilometerstände ergänzt"
# Beispiel: 1.0.9 wird automatisch zu 1.0.10
```

Für eine neue abwärtskompatible Funktionsgruppe wird bewusst die Minor-Version erhöht:

```bash
VERSION_BUMP=minor git commit -m "Mehrere Fahrzeuge ergänzt"
```

Für inkompatible Änderungen wird `VERSION_BUMP=major` verwendet. Eine konkrete Zielversion wie `VERSION_BUMP=2.0.0` ist ebenfalls möglich.

Vor einem Build sollte die Versionskonsistenz geprüft werden:

```bash
npm run version:check
```
