import { beforeAll, describe, expect, it } from "vitest";
import { ensureDatabaseReady, sqlite } from "@/lib/db";
import { createRoutePair } from "@/lib/repositories/routes";
import { createTrip, deleteTrip, getTripsForDateRange, getTripsForMonth, importTripsFromCsv, updateTrip } from "@/lib/repositories/trips";
import { getPrintColumnSettings, updatePrintColumnSettings, getTripColumnSettings, updateTripColumnSettings } from "@/lib/repositories/settings";
import { ALL_TRIP_COLUMN_IDS, tripColumnsSettingsSchema } from "@/lib/trip-columns";
import { parseTripCsv, serializeTripCsv } from "@/lib/trip-csv";

describe("Laufende Nummern und Spalten", () => {
  beforeAll(() => { ensureDatabaseReady(); sqlite.exec("DELETE FROM trips; DELETE FROM route_pairs"); });
  it("nummeriert global, nach Datum, Beginn und ID und berechnet nach Änderungen neu", async () => {
    const pair = await createRoutePair({ placeA: "A", placeB: "B", distanceKm: 10, reimbursedKm: 7, durationMinutes: 20 });
    const input = { date: "2026-02-01", startTime: "08:00", endTime: "08:20", odometerStart: 100, routePairId: pair.id, direction: "A_TO_B" as const };
    const first = await createTrip(input);
    const second = await createTrip(input);
    await createTrip({ ...input, date: "2026-01-31" });
    expect((await getTripsForMonth("2026-02")).trips.map((trip) => [trip.id, trip.sequenceNumber])).toEqual([[first.id, 2], [second.id, 3]]);
    expect((await getTripsForDateRange("2026-02-01", "2026-02-01")).map((trip) => trip.sequenceNumber)).toEqual([2, 3]);
    await updateTrip(second.id, { ...input, date: "2026-01-01" });
    expect((await getTripsForMonth("2026-02")).trips[0].sequenceNumber).toBe(3);
    await deleteTrip(second.id);
    expect((await getTripsForMonth("2026-02")).trips[0].sequenceNumber).toBe(2);
    await importTripsFromCsv(parseTripCsv(serializeTripCsv([{ ...first, sequenceNumber: 999, date: "2025-12-31" }])));
    expect((await getTripsForMonth("2025-12")).trips[0].sequenceNumber).toBe(1);
    expect((await getTripsForMonth("2026-02")).trips[0].sequenceNumber).toBe(3);
  });
  it("erhält abweichende Abrechnung und mehrzeilige Texte im CSV-Rundlauf", async () => {
    const row = { date: "2024-01-01", startTime: "09:00", endTime: "09:30", routeLabel: 'Büro; "Nord" → Außenstelle', odometerStart: 100, odometerEnd: 118, reimbursedKm: 9, unreimbursedKm: 9, reimbursementRateCents: 57, potentialReimbursementCents: 513, accompanyingStaff: "Müller\nÖztürk", remark: 'Text; "Zitat"\nZeile 2' };
    const csv = serializeTripCsv([row]);
    const parsed = parseTripCsv(csv);
    await importTripsFromCsv(parsed);
    const [restored] = (await getTripsForMonth("2024-01")).trips;
    expect(restored).toMatchObject(row);
    expect(parseTripCsv(serializeTripCsv([restored]))).toEqual(parsed);
    expect(await importTripsFromCsv(parsed)).toMatchObject({ imported: 0, skipped: 1 });
    expect(() => parseTripCsv(csv.replace("5,13", "5,14"))).toThrow(/konsistent/);
    expect(() => parseTripCsv(csv.replace(";9;9;", ";10;9;"))).toThrow(/konsistent/);
    const old = "Datum;Beginn;Ende;Reiseweg;KM Beginn;KM Ende;Ort Start ausgeschrieben;Ort Ziel ausgeschrieben;Mitgenommene Bedienstete;Bemerkung\n2024-01-02;08:00;08:30;Alt;100;110;Büro;Ziel;Müller;Alttext";
    expect(parseTripCsv(old)[0]).toMatchObject({ remark: "Alttext", accompanyingStaff: "Müller" });
  });
  it("validiert und speichert die globale Auswahl", async () => {
    expect(tripColumnsSettingsSchema.safeParse({ visibleColumns: [] }).success).toBe(false);
    expect(tripColumnsSettingsSchema.safeParse({ visibleColumns: ["date", "date"] }).success).toBe(false);
    expect(tripColumnsSettingsSchema.safeParse({ visibleColumns: ["unknown"] }).success).toBe(false);
    expect((await getPrintColumnSettings()).visibleColumns).toHaveLength(13);
    await updatePrintColumnSettings(["remark"]);
    await updateTripColumnSettings(["remark", "date"]);
    expect(await getTripColumnSettings()).toEqual({ visibleColumns: ["date", "remark"] });
    expect(await getPrintColumnSettings()).toEqual({ visibleColumns: ["remark"] });
    await expect(updatePrintColumnSettings([])).rejects.toThrow();
    await updateTripColumnSettings([...ALL_TRIP_COLUMN_IDS]);
    expect((await getTripColumnSettings()).visibleColumns).toHaveLength(13);
  });
});
