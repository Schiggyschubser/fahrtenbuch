import { beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { createBackup, listBackups, restoreBackup } from "@/lib/backups";
import { ensureDatabaseReady, sqlite } from "@/lib/db";
import { createRoutePair, getActiveRoutePairs } from "@/lib/repositories/routes";
import { getReimbursementSettings, updateReimbursementSettings } from "@/lib/repositories/settings";
import { createTrip, getTripsForMonth } from "@/lib/repositories/trips";

describe("SQLite-Sicherungen", () => {
  beforeAll(() => {
    ensureDatabaseReady();
    sqlite.exec("DELETE FROM trips; DELETE FROM route_pairs;");
  });

  it("erstellt eine Sicherung und stellt Fahrten sowie Reisewege wieder her", async () => {
    await updateReimbursementSettings(55);
    const originalRoute = await createRoutePair({ placeA: "Büro", placeB: "Kunde", distanceKm: 22, reimbursedKm: 17, durationMinutes: 25 });
    await createTrip({ date: "2026-07-10", startTime: "08:00", endTime: "09:00", odometerStart: 2000, routePairId: originalRoute.id, direction: "A_TO_B" });
    const backup = await createBackup("manual");

    await updateReimbursementSettings(60);
    const laterRoute = await createRoutePair({ placeA: "Büro", placeB: "Werkstatt", distanceKm: 7, reimbursedKm: 5, durationMinutes: 15 });
    await createTrip({ date: "2026-07-11", startTime: "10:00", endTime: "10:30", odometerStart: 2022, routePairId: laterRoute.id, direction: "A_TO_B" });

    const result = await restoreBackup(backup.id);
    expect(result.routes).toBe(1);
    expect(result.trips).toBe(1);
    expect(await getActiveRoutePairs()).toEqual([expect.objectContaining({ placeA: "Büro", placeB: "Kunde", distanceKm: 22, reimbursedKm: 17 })]);
    expect((await getTripsForMonth("2026-07")).trips).toEqual([expect.objectContaining({
      reimbursedKm: 17,
      unreimbursedKm: 5,
      reimbursementRateCents: 55,
      potentialReimbursementCents: 935,
    })]);
    expect(await getReimbursementSettings()).toEqual({ reimbursementRateCents: 55 });
    expect((await listBackups()).some((entry) => entry.kind === "pre-restore")).toBe(true);
  });

  it("stellt ältere Sicherungen ohne Erstattungsspalten vollständig abgerechnet wieder her", async () => {
    const backupDirectory = process.env.BACKUP_DIR!;
    fs.mkdirSync(backupDirectory, { recursive: true });
    const backupId = "fahrtenbuch-safety-2026-07-23T12-00-00-000Z.sqlite";
    const backupPath = path.join(backupDirectory, backupId);
    if (fs.existsSync(backupPath)) fs.rmSync(backupPath);
    const legacy = new Database(backupPath);
    legacy.exec(`
      CREATE TABLE route_pairs (
        id INTEGER PRIMARY KEY, place_a TEXT NOT NULL, place_b TEXT NOT NULL,
        pair_key TEXT NOT NULL, distance_km INTEGER NOT NULL,
        archived_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE trips (
        id INTEGER PRIMARY KEY, date TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL,
        route_pair_id INTEGER, direction TEXT, origin_snapshot TEXT NOT NULL,
        destination_snapshot TEXT NOT NULL, distance_km_snapshot INTEGER NOT NULL,
        odometer_start INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      INSERT INTO route_pairs VALUES (1, 'Altbüro', 'Altkunde', 'alt', 11, NULL, '2025-01-01', '2025-01-01');
      INSERT INTO trips VALUES (1, '2025-01-02', '08:00', '09:00', 1, 'A_TO_B', 'Altbüro', 'Altkunde', 11, 100, '2025-01-02', '2025-01-02');
    `);
    legacy.close();

    await restoreBackup(backupId);
    expect(await getActiveRoutePairs()).toEqual([expect.objectContaining({ distanceKm: 11, reimbursedKm: 11, unreimbursedKm: 0 })]);
    expect((await getTripsForMonth("2025-01")).trips).toEqual([expect.objectContaining({
      distanceKm: 11,
      reimbursedKm: 11,
      unreimbursedKm: 0,
      reimbursementRateCents: 40,
      potentialReimbursementCents: 440,
    })]);
    expect(await getReimbursementSettings()).toEqual({ reimbursementRateCents: 55 });
  });
});
