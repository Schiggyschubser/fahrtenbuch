import path from "node:path";
import Database from "better-sqlite3";
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { ensureDatabaseReady, sqlite } from "@/lib/db";
import { createRoutePair } from "@/lib/repositories/routes";
import { createTrip, getTrip, previewTripOdometerAdjustment, tripToDto, updateTrip } from "@/lib/repositories/trips";
import { TripChronologyError } from "@/lib/trip-chronology";
import * as backups from "@/lib/backups";
import { PATCH } from "@/app/api/trips/[id]/route";
import { POST } from "@/app/api/trips/[id]/odometer-adjustment/route";
import type { TripDto } from "@/lib/types";

const auth = vi.hoisted(() => ({ allowed: true }));
vi.mock("@/lib/auth", () => ({ requireApiUser: async () => auth.allowed ? { id: 1 } : null }));

describe("Begrenzte Kilometerkorrektur", () => {
  let routeId: number;
  let longerRouteId: number;
  let shorterRouteId: number;
  let previous: TripDto;
  let current: TripDto;
  let next: TripDto;
  let end: TripDto;
  let untouched: TripDto;
  const input = (trip: TripDto, patch = {}) => ({
    date: trip.date, startTime: trip.startTime, endTime: trip.endTime,
    odometerStart: trip.odometerStart, ...patch,
  });
  const snapshot = () => sqlite.prepare("SELECT * FROM trips ORDER BY date, start_time, id").all();
  const dto = async (trip: TripDto) => tripToDto((await getTrip(trip.id))!);
  const request = (method: string, body: unknown) => new Request("http://localhost/api/trips", {
    method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const context = () => ({ params: Promise.resolve({ id: String(current.id) }) });
  const correction = (routePairId = longerRouteId, patch = {}) => input(current, { routePairId, direction: "A_TO_B", ...patch });
  const adjustment = (payload: ReturnType<typeof input>, throughTripId: number | null) => ({
    throughTripId, revision: previewTripOdometerAdjustment(current.id, payload)!.revision,
  });

  beforeAll(async () => {
    ensureDatabaseReady();
    const route = (placeB: string, distanceKm: number) => createRoutePair({ placeA: "KM-Test", placeB, distanceKm, reimbursedKm: distanceKm - 2, durationMinutes: 20 });
    routeId = (await route("Original", 20)).id;
    longerRouteId = (await route("Länger", 30)).id;
    shorterRouteId = (await route("Kürzer", 10)).id;
  });
  beforeEach(async () => {
    auth.allowed = true;
    sqlite.exec("DELETE FROM trips; DELETE FROM mobile_trip_submissions");
    const add = (date: string, odometerStart: number) => createTrip({
      date, odometerStart, startTime: "09:00", endTime: "09:20", routePairId: routeId, direction: "A_TO_B",
      remark: "Originalbemerkung", accompanyingStaff: "Begleitung",
    });
    previous = await add("2026-08-30", 980);
    current = await add("2026-08-31", 1000);
    next = await add("2026-09-01", 1035);
    end = await add("2026-09-02", 1060);
    untouched = await add("2026-09-03", 1100);
  });
  afterEach(() => vi.restoreAllMocks());

  it("liefert eine schreibfreie Vorschau mit globalen Fahrtnummern über Monatsgrenzen", async () => {
    const before = snapshot();
    const preview = previewTripOdometerAdjustment(current.id, correction(), current.updatedAt)!;
    expect(preview).toMatchObject({ sequenceNumber: 2, deltaKm: 10, oldOdometerEnd: 1020, newOdometerEnd: 1030 });
    expect(preview.followingTrips.map(t => [t.id, t.sequenceNumber])).toEqual([[next.id, 3], [end.id, 4], [untouched.id, 5]]);
    expect(snapshot()).toEqual(before);
  });

  it.each([10, -10])("verschiebt einschließlich der gewählten Endfahrt um %i km und erhält innere Privatkilometer", async delta => {
    const payload = correction(delta > 0 ? longerRouteId : shorterRouteId);
    expect(await updateTrip(current.id, payload, current.updatedAt, adjustment(payload, end.id))).toMatchObject({ odometerStart: 1000, odometerEnd: 1020 + delta });
    const changedNext = await dto(next);
    const changedEnd = await dto(end);
    expect(changedNext).toEqual({ ...next, odometerStart: next.odometerStart + delta, odometerEnd: next.odometerEnd + delta, updatedAt: expect.any(String) });
    expect(changedEnd).toEqual({ ...end, odometerStart: end.odometerStart + delta, odometerEnd: end.odometerEnd + delta, updatedAt: expect.any(String) });
    expect(changedNext.updatedAt).not.toBe(next.updatedAt);
    expect(changedNext.odometerStart - (await dto(current)).odometerEnd).toBe(15);
    expect(changedEnd.odometerStart - changedNext.odometerEnd).toBe(5);
    // Private mileage at the untouched boundary may shrink or grow.
    expect((await dto(untouched)).odometerStart - changedEnd.odometerEnd).toBe(20 - delta);
    expect(await dto(previous)).toEqual(previous);
    expect(await dto(untouched)).toEqual(untouched);
  });

  it("sichert den Originalzustand vor einer Bereichskorrektur", async () => {
    const before = snapshot();
    const countBefore = new Set((await backups.listBackups()).map(b => b.id));
    const payload = correction();
    await updateTrip(current.id, payload, current.updatedAt, adjustment(payload, end.id));
    const backup = (await backups.listBackups()).find(b => b.kind === "safety" && !countBefore.has(b.id))!;
    expect(backup).toBeDefined();
    const saved = new Database(path.join(backups.getBackupDirectory(), backup.id), { readonly: true });
    try { expect(saved.prepare("SELECT * FROM trips ORDER BY date, start_time, id").all()).toEqual(before); }
    finally { saved.close(); }
  });

  it("erlaubt ausdrücklich keine Folgekorrektur und verändert damit die berechnete Privatnutzung", async () => {
    const payload = correction(shorterRouteId);
    await updateTrip(current.id, payload, current.updatedAt, adjustment(payload, null));
    expect((await dto(current)).odometerEnd).toBe(1010);
    expect(await dto(next)).toEqual(next);
    expect(await dto(end)).toEqual(end);
    expect((await dto(next)).odometerStart - (await dto(current)).odometerEnd).toBe(25);
  });

  it("berechnet die Verschiebung aus neuem Endstand, auch bei gleichzeitig geändertem Anfangsstand", async () => {
    const payload = correction(longerRouteId, { odometerStart: 1005 });
    expect(previewTripOdometerAdjustment(current.id, payload)!.deltaKm).toBe(15);
    await updateTrip(current.id, payload, current.updatedAt, adjustment(payload, end.id));
    expect((await dto(next)).odometerStart).toBe(1050);
    expect((await dto(end)).odometerEnd).toBe(1095);
  });

  it("unterstützt die erste direkte Folgefahrt und die letzte Fahrt als einschließliches Ende", async () => {
    const payload = correction(shorterRouteId);
    await updateTrip(current.id, payload, current.updatedAt, adjustment(payload, next.id));
    expect((await dto(next)).odometerStart).toBe(1025);
    expect(await dto(end)).toEqual(end);
    current = await dto(current);
    const back = correction(longerRouteId);
    await updateTrip(current.id, back, current.updatedAt, adjustment(back, untouched.id));
    expect((await dto(untouched)).odometerStart).toBe(1120);
  });

  it("bewahrt Strecken, Abrechnung, Kennzeichnung und Texte auch bei importierten Folgefahrten", async () => {
    sqlite.prepare("UPDATE trips SET route_pair_id=NULL, direction=NULL, is_checked=1 WHERE id=?").run(next.id);
    const before = await dto(next);
    const payload = correction();
    await updateTrip(current.id, payload, current.updatedAt, adjustment(payload, end.id));
    expect(await dto(next)).toEqual({ ...before, odometerStart: 1045, odometerEnd: 1065, updatedAt: expect.any(String) });
  });

  it("rollt bei Konflikten an der ersten unveränderten Fahrt vollständig zurück", async () => {
    const payload = correction(longerRouteId, { odometerStart: 1015 });
    const before = snapshot();
    await expect(updateTrip(current.id, payload, current.updatedAt, adjustment(payload, end.id))).rejects.toBeInstanceOf(TripChronologyError);
    expect(snapshot()).toEqual(before);
  });

  it("rollt auch ohne Folgekorrektur und bei einem Konflikt zur vorherigen Fahrt zurück", async () => {
    const payload = correction(longerRouteId, { odometerStart: 1020 });
    const before = snapshot();
    await expect(updateTrip(current.id, payload, current.updatedAt, adjustment(payload, null))).rejects.toThrow(/späteren Fahrt/);
    const earlier = correction(shorterRouteId, { odometerStart: 999 });
    await expect(updateTrip(current.id, earlier, current.updatedAt, adjustment(earlier, end.id))).rejects.toThrow(/früheren Fahrt/);
    expect(snapshot()).toEqual(before);
  });

  it.each(["self", "previous", "missing"])("weist eine ungültige Endfahrt zurück: %s", async target => {
    const id = target === "self" ? current.id : target === "previous" ? previous.id : 999999;
    const payload = correction();
    const before = snapshot();
    await expect(updateTrip(current.id, payload, current.updatedAt, adjustment(payload, id))).rejects.toThrow(/nachfolgende Fahrt/);
    expect(snapshot()).toEqual(before);
  });

  it.each(["edit", "delete", "insert", "route", "proposal"])("verhindert das Speichern einer veralteten Vorschau nach %s", async change => {
    let payload = correction();
    const confirmation = adjustment(payload, end.id);
    if (change === "edit") await updateTrip(next.id, input(next, { remark: "Parallel geändert" }));
    if (change === "delete") sqlite.prepare("DELETE FROM trips WHERE id=?").run(end.id);
    if (change === "insert") await createTrip({ ...input(end, { startTime: "10:00", endTime: "10:20", odometerStart: 1085 }), routePairId: shorterRouteId, direction: "A_TO_B" });
    if (change === "route") sqlite.prepare("UPDATE route_pairs SET distance_km=31 WHERE id=?").run(longerRouteId);
    if (change === "proposal") payload = correction(longerRouteId, { odometerStart: 1001 });
    const before = snapshot();
    try {
      await expect(updateTrip(current.id, payload, current.updatedAt, confirmation)).rejects.toThrow(/inzwischen geändert/);
      expect(snapshot()).toEqual(before);
    } finally {
      if (change === "route") sqlite.prepare("UPDATE route_pairs SET distance_km=30 WHERE id=?").run(longerRouteId);
    }
  });

  it("prüft nach der asynchronen Sicherung erneut und überschreibt keine zwischenzeitliche Änderung", async () => {
    const payload = correction();
    const confirmation = adjustment(payload, end.id);
    vi.spyOn(backups, "createBackup").mockImplementationOnce(async () => {
      sqlite.prepare("UPDATE trips SET remark='Änderung während Backup' WHERE id=?").run(next.id);
      return { id: "test", kind: "safety", createdAt: "test", sizeBytes: 0 };
    });
    await expect(updateTrip(current.id, payload, current.updatedAt, confirmation)).rejects.toThrow(/inzwischen geändert/);
    expect(await dto(current)).toEqual(current);
    expect(await dto(end)).toEqual(end);
    expect(await dto(next)).toEqual({ ...next, remark: "Änderung während Backup" });
  });

  it("speichert bei fehlgeschlagener Sicherung nichts", async () => {
    const payload = correction();
    const before = snapshot();
    vi.spyOn(backups, "createBackup").mockRejectedValueOnce(new Error("Sicherung fehlgeschlagen"));
    await expect(updateTrip(current.id, payload, current.updatedAt, adjustment(payload, end.id))).rejects.toThrow("Sicherung fehlgeschlagen");
    expect(snapshot()).toEqual(before);
  });

  it("verhindert eine gleichzeitige Umordnung des verschobenen Bereichs", async () => {
    const payload = correction(shorterRouteId, { date: "2026-09-01", startTime: "10:00", endTime: "10:20" });
    const before = snapshot();
    await expect(updateTrip(current.id, payload, current.updatedAt, adjustment(payload, end.id))).rejects.toThrow(/Fahrtreihenfolge separat/);
    expect(snapshot()).toEqual(before);
  });

  it("unterstützt die letzte Fahrt ohne vorhandene Folgefahrten und erkennt veraltete Einzelrevisionen", async () => {
    const payload = input(untouched, { odometerStart: 1105 });
    expect(previewTripOdometerAdjustment(untouched.id, payload)!.followingTrips).toEqual([]);
    await updateTrip(untouched.id, payload, untouched.updatedAt);
    expect(await updateTrip(untouched.id, payload, untouched.updatedAt)).toBeNull();
  });

  it("validiert und schützt Vorschau und Speicherung über die Web-API", async () => {
    const payload = { ...correction(), expectedUpdatedAt: current.updatedAt };
    const response = await POST(request("POST", payload), context());
    expect(response.status).toBe(200);
    const { preview } = await response.json();
    const saved = await PATCH(request("PATCH", { ...payload, odometerAdjustment: { throughTripId: end.id, revision: preview.revision } }), context());
    expect(saved.status).toBe(200);
    expect((await saved.json()).trip.odometerEnd).toBe(1030);
    expect((await dto(end)).odometerStart).toBe(1070);
    expect((await PATCH(request("PATCH", payload), context())).status).toBe(409);
    expect((await POST(request("POST", payload), context())).status).toBe(409);
    expect((await PATCH(request("PATCH", { ...payload, odometerAdjustment: { throughTripId: -1, revision: "bad" } }), context())).status).toBe(400);
    auth.allowed = false;
    expect((await POST(request("POST", payload), context())).status).toBe(401);
    expect((await PATCH(request("PATCH", payload), context())).status).toBe(401);
  });
});
