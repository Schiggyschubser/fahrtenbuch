import { beforeAll, describe, expect, it } from "vitest";
import { ensureDatabaseReady, sqlite } from "@/lib/db";
import { getDashboardData } from "@/lib/repositories/dashboard";

function insertTrip(date: string, start: string, end: string, route: string, km: number, odometer: number, destination = "") {
  const now = new Date().toISOString();
  sqlite.prepare(`
    INSERT INTO trips (
      date, start_time, end_time, route_pair_id, direction,
      origin_snapshot, destination_snapshot, distance_km_snapshot,
      reimbursed_km_snapshot, odometer_start, created_at, updated_at
    ) VALUES (?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?)
  `).run(date, start, end, route, destination, km, km, odometer, now, now);
}

describe("Dashboard-Repository", () => {
  beforeAll(() => {
    ensureDatabaseReady();
    sqlite.exec("DELETE FROM trips; DELETE FROM route_pairs;");
    insertTrip("2025-01-10", "08:00", "09:00", "Büro, Kunde", 20, 1000);
    insertTrip("2025-07-06", "10:00", "11:30", "Büro, Kunde", 30, 1020);
    insertTrip("2026-01-05", "08:00", "08:30", "Büro, Kunde", 15, 2000);
    insertTrip("2026-01-06", "09:00", "10:00", "Büro", 18, 2015, "Kunde");
    insertTrip("2026-02-02", "07:30", "08:15", "Zentrale, Lager, Kunde", 25, 2033);
  });

  it("berechnet Jahreskennzahlen, Monatslücken und Fahrtdauer", async () => {
    const data = await getDashboardData("2026");
    expect(data.selectedPeriod).toBe("2026");
    expect(data.summary).toEqual({ totalKm: 58, tripCount: 3, activeDays: 3, totalMinutes: 135, averageKm: 19.3 });
    expect(data.trend).toHaveLength(12);
    expect(data.trend[0]).toEqual(expect.objectContaining({ key: "2026-01", totalKm: 33, tripCount: 2 }));
    expect(data.trend[2]).toEqual(expect.objectContaining({ key: "2026-03", totalKm: 0, tripCount: 0 }));
  });

  it("vergleicht das aktuelle Jahr nur bis zum gleichen Vorjahrestag", async () => {
    const data = await getDashboardData("2026");
    expect(data.comparison?.current).toEqual({ totalKm: 58, tripCount: 3 });
    expect(data.comparison?.previous).toEqual({ totalKm: 50, tripCount: 2 });
    expect(data.comparison?.kmDeltaPercent).toBe(16);
  });

  it("hält historische Mehrort-Texte und reguläre Ort-zu-Ort-Wege getrennt", async () => {
    const data = await getDashboardData("2026");
    expect(data.topRoutes).toEqual(expect.arrayContaining([
      expect.objectContaining({ routeLabel: "Büro, Kunde", tripCount: 1 }),
      expect.objectContaining({ routeLabel: "Büro → Kunde", tripCount: 1 }),
    ]));
  });

  it("liefert in der Gesamtansicht einen Jahresverlauf und keinen Vorjahresvergleich", async () => {
    const data = await getDashboardData("all");
    expect(data.selectedPeriod).toBe("all");
    expect(data.trend.map((item) => item.key)).toEqual(["2025", "2026"]);
    expect(data.comparison).toBeNull();
    expect(data.dataRange).toEqual({ firstDate: "2025-01-10", lastDate: "2026-02-02" });
  });

  it("fällt bei ungültigen Jahren auf das aktuelle Datenjahr zurück", async () => {
    expect((await getDashboardData("unbekannt")).selectedPeriod).toBe("2026");
  });
});
