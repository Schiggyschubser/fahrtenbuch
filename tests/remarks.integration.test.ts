import { beforeAll, describe, expect, it } from "vitest";
import { ensureDatabaseReady, sqlite } from "@/lib/db";
import { createBackup, restoreBackup } from "@/lib/backups";
import { getRemarkSettings, updateRemarkSettings } from "@/lib/repositories/remarks";
import { createRoutePair, updateRoutePair } from "@/lib/repositories/routes";
import { createTrip, deleteTrip, getTripsForMonth, importTripsFromCsv, updateTrip } from "@/lib/repositories/trips";
import { parseTripCsv, serializeTripCsv, EXTENDED_TRIP_CSV_HEADERS } from "@/lib/trip-csv";
import { createTripSchema, remarkSettingsSchema } from "@/lib/validation";

describe("Fahrttexte und Bemerkungsvorlagen", () => {
  beforeAll(() => ensureDatabaseReady());

  it("übernimmt den Standard nur bei neuen Fahrten und erhält Texte unabhängig von Vorlagen", async () => {
    const route = await createRoutePair({ placeA: "AA", placeB: "BB", distanceKm: 10, reimbursedKm: 10, durationMinutes: 20 });
    const input = { date: "2036-01-01", startTime: "08:00", endTime: "08:20", odometerStart: 100, routePairId: route.id, direction: "A_TO_B" as const };
    const old = await createTrip(input);
    expect(old.remark).toBe("");
    const settings = updateRemarkSettings({ templates: [{ text: "  Dienstbesprechung  " }, { text: "Ortstermin" }], defaultTemplateIndex: 0 });
    expect(settings.templates[0].text).toBe("Dienstbesprechung");
    const trip = await createTrip({ ...input, accompanyingStaff: "  Müller\nSchmidt  " });
    expect(trip).toMatchObject({ remark: "Dienstbesprechung", accompanyingStaff: "Müller\nSchmidt" });
    const blank = await createTrip({ ...input, remark: "" });
    expect(blank.remark).toBe("");
    const custom = await createTrip({ ...input, remark: "Eigener Text" });
    expect(custom.remark).toBe("Eigener Text");
    const changed = updateRemarkSettings({ templates: settings.templates.map((item) => ({ ...item, text: item.text + " geändert" })), defaultTemplateIndex: 1 });
    const preserved = await updateTrip(trip.id, input);
    expect(preserved).toMatchObject({ remark: "Dienstbesprechung", accompanyingStaff: "Müller\nSchmidt" });
    expect((await getTripsForMonth("2036-01")).trips.find((item) => item.id === old.id)?.remark).toBe("");
    updateRemarkSettings({ templates: [changed.templates[0]], defaultTemplateIndex: null });
    expect(getRemarkSettings().defaultTemplateId).toBeNull();
    expect((await updateTrip(trip.id, { ...input, remark: "", accompanyingStaff: "" }))?.remark).toBe("");
    updateRemarkSettings({ templates: [], defaultTemplateIndex: null });
  });

  it("erhält alle Zusatztexte im CSV-Rundlauf, auch rückwärts und ohne Reisewegverknüpfung", async () => {
    const pairInput = { placeA: "HH-CSV", placeB: "B-CSV", placeAFullName: "Hamburg; Zentrale", placeBFullName: 'Berlin "Mitte"', distanceKm: 18, reimbursedKm: 18, durationMinutes: 30 };
    const route = await createRoutePair(pairInput);
    updateRemarkSettings({ templates: [{ text: "Standard darf nicht importiert werden" }], defaultTemplateIndex: 0 });
    const originals = await Promise.all((["A_TO_B", "B_TO_A"] as const).map((direction, index) => createTrip({
      date: "2037-02-01", startTime: index ? "10:00" : "08:00", endTime: index ? "10:30" : "08:30", odometerStart: 100 + index * 18,
      routePairId: route.id, direction, accompanyingStaff: 'Müller; "Anna"\nSchmidt', remark: 'Besprechung; "Projekt"\nZweite Zeile',
    })));
    const parsed = parseTripCsv(serializeTripCsv(originals));
    expect(parsed[1]).toMatchObject({ originFullName: pairInput.placeBFullName, destinationFullName: pairInput.placeAFullName });
    expect(await importTripsFromCsv(parsed)).toMatchObject({ imported: 0, skipped: 2 });
    for (const trip of originals) await deleteTrip(trip.id);
    expect(await importTripsFromCsv(parsed)).toMatchObject({ imported: 2, skipped: 0 });
    await updateRoutePair(route.id, { ...pairInput, placeAFullName: "Geänderter Name" });
    const restored = (await getTripsForMonth("2037-02")).trips;
    expect(parseTripCsv(serializeTripCsv(restored))).toEqual(parsed);
    expect(restored.every((trip) => trip.routePairId === null)).toBe(true);
    expect(await importTripsFromCsv(parsed)).toMatchObject({ imported: 0, skipped: 2 });
    expect(await importTripsFromCsv([{ ...parsed[0], remark: "Anderer Text" }])).toMatchObject({ imported: 1, skipped: 0 });
    const legacy = parseTripCsv("Datum;Beginn;Ende;Reiseweg;KM Beginn;KM Ende\n2037-02-02;08:00;08:30;Alt;200;218");
    await importTripsFromCsv(legacy);
    expect((await getTripsForMonth("2037-02")).trips.find((trip) => trip.routeLabel === "Alt")).toMatchObject({ remark: "", accompanyingStaff: "", originFullName: "", destinationFullName: "" });
    expect(await importTripsFromCsv(legacy)).toMatchObject({ imported: 0, skipped: 1 });
  });

  it("stellt Vorlagen, Standard und importierte Zusatztexte aus Sicherungen wieder her", async () => {
    const settings = getRemarkSettings();
    const expectedTrips = (await getTripsForMonth("2037-02")).trips;
    const backup = await createBackup("manual");
    updateRemarkSettings({ templates: [], defaultTemplateIndex: null });
    sqlite.exec("DELETE FROM trips");
    await restoreBackup(backup.id);
    expect(getRemarkSettings()).toEqual(settings);
    expect((await getTripsForMonth("2037-02")).trips).toEqual(expectedTrips);
  });

  it("weist zu lange Texte, leere Vorlagen und ungültige Standardauswahlen zurück", () => {
    expect(remarkSettingsSchema.safeParse({ templates: [{ text: " " }], defaultTemplateIndex: null }).success).toBe(false);
    expect(remarkSettingsSchema.safeParse({ templates: [], defaultTemplateIndex: 0 }).success).toBe(false);
    expect(() => updateRemarkSettings({ templates: [{ id: 999999, text: "Unbekannt" }], defaultTemplateIndex: null })).toThrow(/Ungültige/);
    expect(createTripSchema.safeParse({ date: "2036-01-01", startTime: "08:00", endTime: "08:20", odometerStart: 1, routePairId: 1, direction: "A_TO_B", remark: "x".repeat(2001) }).success).toBe(false);
    const csv = EXTENDED_TRIP_CSV_HEADERS.join(";") + "\n2036-01-01;08:00;08:20;Test;1;2;;;" + "x".repeat(2001) + ";";
    expect(() => parseTripCsv(csv)).toThrow(/Textlänge/);
  });
});
