# Automatische Versionsverwaltung

Die ausgelieferte Projektversion steht in `VERSION`. Dieselbe Nummer wird in `package.json`, `package-lock.json`, `docker-compose.yaml` und `lib/changelog.json` synchron gehalten.

Nach der einmaligen Einrichtung erhöht jeder normale Git-Commit automatisch die Patch-Version:

```text
1.0.9 → 1.0.10 → 1.0.11
```

Einrichtung einer neuen Arbeitskopie:

```bash
./scripts/init-git.sh
```

Das Skript erstellt bei Bedarf ein Repository, übernimmt den ausgelieferten Stand als unveränderte Ausgangsversion und aktiviert anschließend den Hook.

## Andere Versionssprünge

Neue, abwärtskompatible Funktionsgruppe:

```bash
VERSION_BUMP=minor git commit -m "Fahrzeugverwaltung ergänzt"
```

Nicht abwärtskompatible Änderung:

```bash
VERSION_BUMP=major git commit -m "Datenmodell grundlegend überarbeitet"
```

Konkrete Zielversion:

```bash
VERSION_BUMP=2.3.0 git commit -m "Release 2.3.0"
```

Ausnahmsweise keinen Versionssprung ausführen:

```bash
VERSION_BUMP=none git commit -m "Repository-Metadaten korrigiert [skip version]"
```

Die Konsistenz kann jederzeit geprüft werden:

```bash
npm run version:check
```
