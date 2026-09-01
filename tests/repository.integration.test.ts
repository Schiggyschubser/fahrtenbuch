import { beforeAll, describe, expect, it } from "vitest";
import { ensureDatabaseReady, sqlite } from "@/lib/db";
import { archiveRoutePair, createRoutePair, getActiveRoutePairs, updateRoutePair } from "@/lib/repositories/routes";
import { getReimbursementSettings, updateReimbursementSettings } from "@/lib/repositories/settings";
import { createTrip, deleteTrip, getSuggestedOdometer, getTripsForMonth, setTripChecked, updateTrip } from "@/lib/repositories/trips";

describe("Fahrten-Repository", () => {
  beforeAll(() => ensureDatabaseReady());

  it("erstellt Fahrten, berechnet Kilometer und sortiert chronologisch", async () => {
    const route = await createRoutePair({ placeA: "Büro", placeB: "Kunde", distanceKm: 24, reimbursedKm: 18, durationMinutes: 30 });
    await createTrip({ date: "2026-07-08", startTime: "10:00", endTime: "11:00", odometerStart: 1024, routePairId: route.id, direction: "A_TO_B" });
    await createTrip({ date: "2026-07-07", startTime: "08:00", endTime: "09:00", odometerStart: 1000, routePairId: route.id, direction: "B_TO_A" });

    const month = await getTripsForMonth("2026-07");
    expect(month.trips.map((trip) => trip.date)).toEqual(["2026-07-07", "2026-07-08"]);
    expect(month.trips[0].odometerEnd).toBe(1024);
    expect(month.totalKm).toBe(48);
    expect(month.totalReimbursedKm).toBe(36);
    expect(month.totalUnreimbursedKm).toBe(12);
    expect(month.totalPotentialReimbursementCents).toBe(1440);
    expect(await getSuggestedOdometer("2026-07-09")).toBe(1048);
  });

  it("bewahrt Snapshots nach einer Reisewegänderung", async () => {
    const routes = await getActiveRoutePairs();
    const route = routes[0];
    const before = (await getTripsForMonth("2026-07")).trips[0];
    await updateRoutePair(route.id, { placeA: "Zentrale", placeB: "Kunde neu", distanceKm: 30, reimbursedKm: 12, durationMinutes: 40 });
    const after = (await getTripsForMonth("2026-07")).trips[0];
    expect(after.origin).toBe(before.origin);
    expect(after.destination).toBe(before.destination);
    expect(after.distanceKm).toBe(24);
    expect(after.reimbursedKm).toBe(18);
    expect(after.unreimbursedKm).toBe(6);
  });

  it("speichert den Erstattungssatz nur bei neuen Fahrten als Snapshot", async () => {
    const route = (await getActiveRoutePairs())[0];
    expect(await getReimbursementSettings()).toEqual({ reimbursementRateCents: 40 });
    const oldRateTrip = await createTrip({ date: "2026-09-01", startTime: "08:00", endTime: "09:00", odometerStart: 4000, routePairId: route.id, direction: "A_TO_B" });
    await updateReimbursementSettings(55);
    const newRateTrip = await createTrip({ date: "2026-09-02", startTime: "08:00", endTime: "09:00", odometerStart: 4030, routePairId: route.id, direction: "A_TO_B" });
    const edited = await updateTrip(oldRateTrip.id, {
      date: oldRateTrip.date,
      startTime: "08:15",
      endTime: oldRateTrip.endTime,
      odometerStart: oldRateTrip.odometerStart,
      routePairId: route.id,
      direction: "B_TO_A",
    });

    expect(edited).toEqual(expect.objectContaining({ reimbursementRateCents: 40, potentialReimbursementCents: 480 }));
    expect(newRateTrip).toEqual(expect.objectContaining({ reimbursementRateCents: 55, potentialReimbursementCents: 660 }));
    expect((await getTripsForMonth("2026-09")).totalPotentialReimbursementCents).toBe(1140);

    await deleteTrip(oldRateTrip.id);
    await deleteTrip(newRateTrip.id);
    await updateReimbursementSettings(40);
  });

  it("übernimmt Erstattungswerte nur bei einem Reisewegwechsel neu", async () => {
    const originalRoute = (await getActiveRoutePairs())[0];
    const otherRoute = await createRoutePair({ placeA: "Lager", placeB: "Filiale", distanceKm: 8, reimbursedKm: 10, durationMinutes: 15 });
    const created = await createTrip({ date: "2026-08-01", startTime: "08:00", endTime: "08:30", odometerStart: 3000, routePairId: otherRoute.id, direction: "A_TO_B" });
    expect(created.unreimbursedKm).toBe(0);

    const switched = await updateTrip(created.id, {
      date: created.date,
      startTime: created.startTime,
      endTime: created.endTime,
      odometerStart: created.odometerStart,
      routePairId: originalRoute.id,
      direction: "B_TO_A",
    });
    expect(switched).toEqual(expect.objectContaining({ distanceKm: 30, reimbursedKm: 12, unreimbursedKm: 18 }));
    await deleteTrip(created.id);
    await archiveRoutePair(otherRoute.id);
  });

  it("zeigt historische Fahrten ohne Reiseweg-Verknüpfung an", async () => {
    const now = new Date().toISOString();
    sqlite.prepare(`
      INSERT INTO trips (
        date, start_time, end_time, route_pair_id, direction,
        origin_snapshot, destination_snapshot, distance_km_snapshot,
        reimbursed_km_snapshot, odometer_start, created_at, updated_at
      ) VALUES (?, ?, ?, NULL, NULL, ?, '', ?, ?, ?, ?, ?)
    `).run("2023-07-17", "08:50", "14:50", "Standort A, Standort B, Standort C", 24, 24, 41746, now, now);

    const [trip] = (await getTripsForMonth("2023-07")).trips;
    expect(trip.routePairId).toBeNull();
    expect(trip.direction).toBeNull();
    expect(trip.routeLabel).toBe("Standort A, Standort B, Standort C");
  });

  it("bearbeitet und löscht Fahrten sowie archiviert Reisewege", async () => {
    const month = await getTripsForMonth("2026-07");
    const trip = month.trips[0];
    const updated = await updateTrip(trip.id, { date: trip.date, startTime: "07:30", endTime: "08:45", odometerStart: 999 });
    expect(updated?.startTime).toBe("07:30");
    expect(updated?.odometerEnd).toBe(1023);
    expect(await deleteTrip(trip.id)).toEqual({ id: trip.id });

    const route = (await getActiveRoutePairs())[0];
    await archiveRoutePair(route.id);
    expect(await getActiveRoutePairs()).toHaveLength(0);
    expect((await getTripsForMonth("2026-07")).trips).toHaveLength(1);
  });

  it("markiert Fahrten als ins analoge Fahrtenbuch übernommen", async () => {
    const trip = (await getTripsForMonth("2026-07")).trips[0];
    const updated = await setTripChecked(trip.id, true);
    expect(updated?.isChecked).toBe(true);
  });
});
