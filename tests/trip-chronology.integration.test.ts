import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureDatabaseReady, sqlite } from "@/lib/db";
import { createRoutePair } from "@/lib/repositories/routes";
import { createTrip, getTripsForMonth, importTripsFromCsv, updateTrip } from "@/lib/repositories/trips";
import { TripChronologyError } from "@/lib/trip-chronology";
import { createMobileSession } from "@/lib/mobile-auth";
import { handleMobileApi } from "@/lib/mobile-api";
import { POST } from "@/app/api/trips/route";
import { PATCH } from "@/app/api/trips/[id]/route";

vi.mock("@/lib/auth", () => ({ requireApiUser: async () => ({ id: 1 }) }));

describe("Chronologieschutz beim Anlegen, Bearbeiten und Importieren", () => {
  let routeId: number;
  let longRouteId: number;
  const input = (patch = {}) => ({ date: "2026-09-09", startTime: "09:00", endTime: "09:20", odometerStart: 1010, routePairId: routeId, direction: "A_TO_B" as const, ...patch });
  const snapshot = () => sqlite.prepare("SELECT * FROM trips ORDER BY id").all();
  beforeAll(async () => {
    ensureDatabaseReady();
    routeId = (await createRoutePair({ placeA: "Chronologie A", placeB: "B", distanceKm: 10, reimbursedKm: 10, durationMinutes: 20 })).id;
    longRouteId = (await createRoutePair({ placeA: "Chronologie A", placeB: "C", distanceKm: 50, reimbursedKm: 50, durationMinutes: 20 })).id;
  });
  beforeEach(() => sqlite.exec("DELETE FROM trips; DELETE FROM mobile_trip_submissions"));

  async function neighbors() {
    await createTrip(input({ date: "2026-08-31", odometerStart: 1000 }));
    await createTrip(input({ date: "2026-10-01", odometerStart: 1040 }));
  }

  it("erlaubt rückwirkendes Einfügen, Monats-/Jahreswechsel, angrenzende Zeiten und private Kilometerlücken", async () => {
    await createTrip(input({ date: "2027-01-01", odometerStart: 1050 }));
    await createTrip(input({ date: "2026-12-31", odometerStart: 1000 }));
    await createTrip(input({ date: "2026-12-31", startTime: "09:20", endTime: "09:40", odometerStart: 1010 }));
    const month = await getTripsForMonth("2026-12");
    expect(month.trips.map(t => [t.sequenceNumber, t.odometerStart])).toEqual([[1, 1000], [2, 1010]]);
  });

  it.each([
    { startTime: "08:50", endTime: "09:10" },
    { startTime: "09:10", endTime: "09:30" },
    { startTime: "09:00", endTime: "09:20" },
    { startTime: "08:00", endTime: "10:00" },
    { startTime: "09:05", endTime: "09:10" },
  ])("weist Zeitüberschneidungen ohne Schreibzugriff zurück: %j", async times => {
    await createTrip(input());
    const before = snapshot();
    await expect(createTrip(input(times))).rejects.toThrow(/überschneidet/);
    expect(snapshot()).toEqual(before);
  });

  it("prüft Kilometerstände in beiden Richtungen über Monatsgrenzen", async () => {
    await neighbors();
    const before = snapshot();
    await expect(createTrip(input({ odometerStart: 1009 }))).rejects.toThrow(/früheren Fahrt/);
    await expect(createTrip(input({ odometerStart: 1031 }))).rejects.toThrow(/späteren Fahrt/);
    expect(snapshot()).toEqual(before);
    expect((await createTrip(input({ odometerStart: 1030 }))).odometerEnd).toBe(1040);
  });

  it.each([
    { date: "2026-08-30" },
    { date: "2026-10-02" },
    { odometerStart: 1009 },
    { odometerStart: 1031 },
    { routePairId: "long" },
  ])("blockiert widersprüchliche Bearbeitungen atomar: %j", async patch => {
    await neighbors();
    const current = await createTrip(input());
    const before = snapshot();
    const changes = { ...patch, ...(patch.routePairId === "long" ? { routePairId: longRouteId } : {}) };
    await expect(updateTrip(current.id, input(changes), current.updatedAt)).rejects.toBeInstanceOf(TripChronologyError);
    expect(snapshot()).toEqual(before);
  });

  it("prüft Beginn und Ende auch bei Änderungen und schließt die eigene Fahrt aus", async () => {
    const first = await createTrip(input());
    const second = await createTrip(input({ startTime: "10:00", endTime: "10:20", odometerStart: 1020 }));
    const before = snapshot();
    await expect(updateTrip(first.id, input({ endTime: "10:01" }))).rejects.toThrow(/überschneidet/);
    await expect(updateTrip(second.id, input({ startTime: "09:19", endTime: "10:20", odometerStart: 1020 }))).rejects.toThrow(/überschneidet/);
    expect(snapshot()).toEqual(before);
    expect(await updateTrip(first.id, input({ endTime: "10:00", remark: "Korrektur" }))).toMatchObject({ id: first.id, endTime: "10:00", remark: "Korrektur" });
  });

  it("erlaubt reine Textkorrekturen an Altbestand und verhindert neue Konflikte hinter fehlerhaften Nachbarn", async () => {
    const first = await createTrip(input({ odometerStart: 1000 }));
    const second = await createTrip(input({ date: "2026-09-10", odometerStart: 1020 }));
    // Represent inconsistent historical data without using the protected write path.
    sqlite.prepare("UPDATE trips SET odometer_start=500 WHERE id=?").run(second.id);
    expect(await updateTrip(second.id, input({ date: "2026-09-10", odometerStart: 500, remark: "Alttext korrigiert" }))).toMatchObject({ remark: "Alttext korrigiert" });
    const before = snapshot();
    await expect(createTrip(input({ date: "2026-09-11", odometerStart: 600 }))).rejects.toThrow(/früheren Fahrt/);
    expect(snapshot()).toEqual(before);
    expect(await updateTrip(second.id, input({ date: "2026-09-10", odometerStart: first.odometerEnd }))).toMatchObject({ odometerStart: 1010 });
  });

  it("weist ungültige Kalendertage auch beim Bearbeiten zurück", async () => {
    const current = await createTrip(input());
    const before = snapshot();
    await expect(createTrip(input({ date: "2026-02-30" }))).rejects.toThrow(/Datum/);
    await expect(updateTrip(current.id, input({ date: "2026-02-30" }))).rejects.toThrow(/Datum/);
    expect(snapshot()).toEqual(before);
  });

  const csv = (date: string, odometerStart: number, patch = {}) => ({ date, startTime: "08:00", endTime: "08:20", odometerStart, odometerEnd: odometerStart + 10, routeLabel: "CSV-Test", ...patch });
  it("prüft unsortierte CSV-Dateien als Ganzes und überspringt echte Dubletten", async () => {
    const rows = [csv("2026-10-01", 1020), csv("2026-08-31", 1000), csv("2026-09-09", 1010)];
    expect(await importTripsFromCsv(rows)).toMatchObject({ imported: 3, skipped: 0 });
    expect(await importTripsFromCsv(rows)).toMatchObject({ imported: 0, skipped: 3 });
  });

  it("rollt den gesamten CSV-Import bei internen oder bestehenden Konflikten zurück", async () => {
    await createTrip(input());
    const before = snapshot();
    await expect(importTripsFromCsv([csv("2026-10-01", 1040), csv("2026-09-09", 1010, { startTime: "09:10", endTime: "09:30" })])).rejects.toThrow(/überschneidet/);
    expect(snapshot()).toEqual(before);
    await expect(importTripsFromCsv([csv("2026-10-01", 1040), csv("2026-10-02", 1030)])).rejects.toBeInstanceOf(TripChronologyError);
    expect(snapshot()).toEqual(before);
  });

  it("verhindert doppelte gleichzeitige Neuanlagen und widersprüchliche parallele Bearbeitungen", async () => {
    const created = await Promise.allSettled([createTrip(input()), createTrip(input())]);
    expect(created.map(r => r.status).sort()).toEqual(["fulfilled", "rejected"]);
    const trip = (await getTripsForMonth("2026-09")).trips[0];
    const changed = await Promise.allSettled([
      updateTrip(trip.id, input({ odometerStart: 1020 }), trip.updatedAt),
      updateTrip(trip.id, input({ odometerStart: 1030 }), trip.updatedAt),
    ]);
    expect(changed.filter(r => r.status === "fulfilled" && r.value === null)).toHaveLength(1);
    expect((await getTripsForMonth("2026-09")).trips).toHaveLength(1);
  });

  it("serialisiert konkurrierende Schreibzugriffe aus getrennten Prozessen", async () => {
    const script = `import {createTripSync} from './lib/repositories/trips';
      try { createTripSync(${JSON.stringify(input())}); console.log('saved'); }
      catch(error) { if(error.code !== 'TRIP_CHRONOLOGY_CONFLICT') throw error; console.log('conflict'); }`;
    const run = () => promisify(execFile)(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], { env: process.env });
    const results = await Promise.all([run(), run()]);
    expect(results.map(r => r.stdout.trim()).sort()).toEqual(["conflict", "saved"]);
    expect((await getTripsForMonth("2026-09")).trips).toHaveLength(1);
  });

  it("liefert verständliche Konflikte über Web-POST/PATCH und mobile POST/PUT/PATCH, ohne Daten oder Belege anzulegen", async () => {
    const current = await createTrip(input());
    await createTrip(input({ startTime: "10:00", endTime: "10:20", odometerStart: 1020 }));
    const before = snapshot();
    const request = (method: string, body: unknown, path = "trips", token?: string) => new Request(`http://localhost/api/${path}`, {
      method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body),
    });
    const responses: Response[] = [
      await POST(request("POST", input())),
      await PATCH(request("PATCH", input({ endTime: "10:01" })), { params: Promise.resolve({ id: String(current.id) }) }),
    ];
    const token = createMobileSession(1).accessToken;
    responses.push(await handleMobileApi(request("POST", { ...input(), clientTripId: randomUUID() }, "v1/trips", token), ["trips"]));
    for (const method of ["PUT", "PATCH"]) responses.push(await handleMobileApi(request(method, { ...input({ endTime: "10:01" }), expectedUpdatedAt: current.updatedAt }, `v1/trips/${current.id}`, token), ["trips", String(current.id)]));
    for (const response of responses) {
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: "TRIP_CHRONOLOGY_CONFLICT", error: expect.stringContaining("überschneidet") });
    }
    expect(snapshot()).toEqual(before);
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM mobile_trip_submissions").get()).toEqual({ n: 0 });
  });
});
