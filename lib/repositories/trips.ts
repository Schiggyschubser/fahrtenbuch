import { and, asc, desc, eq, gte, lt, lte, or } from "drizzle-orm";
import { db, ensureDatabaseReady, sqlite } from "../db";
import { appSettings, routePairs, trips, type Direction } from "../db/schema";
import { createBackup } from "../backups";
import { monthBounds } from "../dates";
import { unreimbursedKm } from "../kilometers";
import { potentialReimbursementCents } from "../money";
import type { MonthDataDto, TripCsvImportResultDto, TripDateRangeDto, TripDto } from "../types";
import { tripCsvDuplicateKey, type TripCsvRow } from "../trip-csv";
import { getActiveRoutePair } from "./routes";
import { getRemarkSettings } from "./remarks";

export function tripToDto(row: typeof trips.$inferSelect): TripDto {
  const pair = row.routePairId !== null && row.direction !== null
    ? sqlite.prepare("SELECT place_a AS placeA, place_b AS placeB, place_a_full_name AS placeAFullName, place_b_full_name AS placeBFullName FROM route_pairs WHERE id = ?").get(row.routePairId) as { placeA: string; placeB: string; placeAFullName: string; placeBFullName: string } | undefined
    : undefined;
  const origin = row.direction === "A_TO_B" ? pair?.placeA : pair?.placeB;
  const destination = row.direction === "A_TO_B" ? pair?.placeB : pair?.placeA;
  const matches = (snapshot: string, current: string | undefined) => current !== undefined
    && snapshot.trim().replace(/\s+/g, " ").localeCompare(current, "de", { sensitivity: "base" }) === 0;
  return {
    originFullName: row.routePairId === null ? row.originFullNameSnapshot : matches(row.originSnapshot, origin) ? (row.direction === "A_TO_B" ? pair!.placeAFullName : pair!.placeBFullName) : "",
    destinationFullName: row.routePairId === null ? row.destinationFullNameSnapshot : matches(row.destinationSnapshot, destination) ? (row.direction === "A_TO_B" ? pair!.placeBFullName : pair!.placeAFullName) : "",
    accompanyingStaff: row.accompanyingStaff,
    remark: row.remark,
    sequenceNumber: (sqlite.prepare(`SELECT COUNT(*) + 1 AS number FROM trips
      WHERE date < ? OR (date = ? AND start_time < ?)
      OR (date = ? AND start_time = ? AND id < ?)`)
      .get(row.date, row.date, row.startTime, row.date, row.startTime, row.id) as { number: number }).number,
    id: row.id,
    date: row.date,
    startTime: row.startTime,
    endTime: row.endTime,
    routePairId: row.routePairId,
    direction: row.direction,
    origin: row.originSnapshot,
    destination: row.destinationSnapshot,
    routeLabel: row.destinationSnapshot ? `${row.originSnapshot} → ${row.destinationSnapshot}` : row.originSnapshot,
    distanceKm: row.distanceKmSnapshot,
    reimbursedKm: row.reimbursedKmSnapshot,
    unreimbursedKm: unreimbursedKm(row.distanceKmSnapshot, row.reimbursedKmSnapshot),
    reimbursementRateCents: row.reimbursementRateCentsSnapshot,
    potentialReimbursementCents: potentialReimbursementCents(
      row.reimbursedKmSnapshot,
      row.reimbursementRateCentsSnapshot,
    ),
    odometerStart: row.odometerStart,
    odometerEnd: row.odometerStart + row.distanceKmSnapshot,
    isChecked: row.isChecked,
  };
}

export async function getTripsForMonth(month: string): Promise<MonthDataDto> {
  ensureDatabaseReady();
  const { start, endExclusive } = monthBounds(month);
  const rows = await db.select().from(trips)
    .where(and(gte(trips.date, start), lt(trips.date, endExclusive)))
    .orderBy(asc(trips.date), asc(trips.startTime), asc(trips.id));
  const dto = rows.filter((row) => row.date >= start && row.date < endExclusive).map(tripToDto);
  return {
    trips: dto,
    totalKm: dto.reduce((sum, trip) => sum + trip.distanceKm, 0),
    totalReimbursedKm: dto.reduce((sum, trip) => sum + trip.reimbursedKm, 0),
    totalUnreimbursedKm: dto.reduce((sum, trip) => sum + trip.unreimbursedKm, 0),
    totalPotentialReimbursementCents: dto.reduce((sum, trip) => sum + trip.potentialReimbursementCents, 0),
    suggestedOdometerStart: dto.length > 0 ? dto.at(-1)!.odometerEnd : await getSuggestedOdometer(start),
  };
}

export async function getSuggestedOdometer(date: string, startTime?: string) {
  ensureDatabaseReady();
  const condition = startTime
    ? or(lt(trips.date, date), and(eq(trips.date, date), lt(trips.startTime, startTime)))
    : lte(trips.date, date);
  const rows = await db.select().from(trips).where(condition)
    .orderBy(desc(trips.date), desc(trips.startTime), desc(trips.id)).limit(1);
  return rows[0] ? rows[0].odometerStart + rows[0].distanceKmSnapshot : null;
}

export async function getTrip(id: number) {
  ensureDatabaseReady();
  const rows = await db.select().from(trips).where(eq(trips.id, id)).limit(1);
  return rows[0] ?? null;
}

type TripInput = {
  accompanyingStaff?: string;
  remark?: string;
  date: string;
  startTime: string;
  endTime: string;
  odometerStart: number;
  routePairId: number;
  direction: Direction;
};

function routeSnapshot(pair: { placeA: string; placeB: string; distanceKm: number; reimbursedKm: number }, direction: Direction) {
  const kilometerSnapshots = {
    distanceKmSnapshot: pair.distanceKm,
    reimbursedKmSnapshot: pair.reimbursedKm,
  };
  return direction === "A_TO_B"
    ? { originSnapshot: pair.placeA, destinationSnapshot: pair.placeB, ...kilometerSnapshots }
    : { originSnapshot: pair.placeB, destinationSnapshot: pair.placeA, ...kilometerSnapshots };
}

export async function getTripsForDateRange(from: string, to: string) {
  ensureDatabaseReady();
  const rows = await db.select().from(trips)
    .where(and(gte(trips.date, from), lte(trips.date, to)))
    .orderBy(asc(trips.date), asc(trips.startTime), asc(trips.id));
  return rows.map(tripToDto);
}

export function getTripDateRange(): TripDateRangeDto {
  ensureDatabaseReady();
  const range = sqlite.prepare(`
    SELECT MIN(date) AS firstDate, MAX(date) AS lastDate
    FROM trips
  `).get() as TripDateRangeDto;
  return { firstDate: range.firstDate, lastDate: range.lastDate };
}

export async function importTripsFromCsv(rows: TripCsvRow[]): Promise<TripCsvImportResultDto> {
  ensureDatabaseReady();
  const existingRows = await db.select().from(trips);
  const existingDtos = existingRows.map(tripToDto);
  const existingLegacyKeys = new Set(existingDtos.map((row) => tripCsvDuplicateKey(row)));
  const existingExtendedKeys = new Set(existingDtos.map((row) => tripCsvDuplicateKey(row, true)));
  const pendingKeys = new Set<string>();
  const pending: TripCsvRow[] = [];
  let skipped = 0;
  for (const row of rows) {
    const extended = row.remark !== undefined;
    const key = tripCsvDuplicateKey(row, extended);
    if ((extended ? existingExtendedKeys : existingLegacyKeys).has(key) || pendingKeys.has(key)) {
      skipped += 1;
      continue;
    }
    pendingKeys.add(key);
    pending.push(row);
  }

  if (pending.length === 0) {
    return { imported: 0, skipped, backup: null, dateRange: getTripDateRange() };
  }

  const backup = await createBackup("safety");
  const now = new Date().toISOString();
  const insert = sqlite.prepare(`
    INSERT INTO trips (
      date, start_time, end_time, route_pair_id, direction,
      origin_snapshot, destination_snapshot, distance_km_snapshot,
      reimbursed_km_snapshot, reimbursement_rate_cents_snapshot,
      odometer_start, is_checked, created_at, updated_at,
      origin_full_name_snapshot, destination_full_name_snapshot, accompanying_staff, remark
    ) VALUES (?, ?, ?, NULL, NULL, ?, '', ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
  `);
  sqlite.transaction(() => {
    for (const row of pending) {
      const distanceKm = row.odometerEnd - row.odometerStart;
      insert.run(
        row.date,
        row.startTime,
        row.endTime,
        row.routeLabel,
        distanceKm,
        row.reimbursedKm ?? distanceKm,
        row.reimbursementRateCents ?? 40,
        row.odometerStart,
        now,
        now,
        row.originFullName ?? "",
        row.destinationFullName ?? "",
        row.accompanyingStaff ?? "",
        row.remark ?? "",
      );
    }
  })();
  return {
    imported: pending.length,
    skipped,
    backup,
    dateRange: getTripDateRange(),
  };
}

export async function createTrip(input: TripInput) {
  return createTripSync(input);
}

// Synchronous so mobile submissions and their receipt can commit atomically.
export function createTripSync(input: TripInput) {
  ensureDatabaseReady();
  const pair = db.select().from(routePairs).where(eq(routePairs.id, input.routePairId)).get();
  const settings = db.select().from(appSettings).where(eq(appSettings.id, 1)).get();
  if (!pair || pair.archivedAt) throw new Error("Der gewählte Reiseweg ist nicht mehr verfügbar.");
  if (!settings) throw new Error("Die Abrechnungseinstellungen konnten nicht geladen werden.");
  const remarkSettings = input.remark === undefined ? getRemarkSettings() : null;
  const defaultRemark = remarkSettings?.templates.find((template) => template.id === remarkSettings.defaultTemplateId)?.text ?? "";
  const now = new Date().toISOString();
  const created = db.insert(trips).values({
    ...input,
    accompanyingStaff: input.accompanyingStaff?.trim() ?? "",
    remark: input.remark?.trim() ?? defaultRemark,
    ...routeSnapshot(pair, input.direction),
    reimbursementRateCentsSnapshot: settings.reimbursementRateCents,
    createdAt: now,
    updatedAt: now,
  }).returning().get();
  return tripToDto(created);
}

export async function updateTrip(id: number, input: Omit<TripInput, "routePairId" | "direction"> & {
  routePairId?: number;
  direction?: Direction;
}) {
  ensureDatabaseReady();
  const existing = await getTrip(id);
  if (!existing) return null;
  let routeValues = {};
  if (input.routePairId && input.direction) {
    const pair = await getActiveRoutePair(input.routePairId);
    if (!pair) throw new Error("Der gewählte Reiseweg ist nicht mehr verfügbar.");
    routeValues = {
      originFullNameSnapshot: "",
      destinationFullNameSnapshot: "",
      routePairId: input.routePairId,
      direction: input.direction,
      ...routeSnapshot(pair, input.direction),
    };
  }
  const [updated] = await db.update(trips).set({
    accompanyingStaff: input.accompanyingStaff?.trim() ?? existing.accompanyingStaff,
    remark: input.remark?.trim() ?? existing.remark,
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    odometerStart: input.odometerStart,
    ...routeValues,
    updatedAt: new Date().toISOString(),
  }).where(eq(trips.id, id)).returning();
  return updated ? tripToDto(updated) : null;
}

export async function deleteTrip(id: number) {
  ensureDatabaseReady();
  const [deleted] = await db.delete(trips).where(eq(trips.id, id)).returning({ id: trips.id });
  return deleted ?? null;
}

export async function setTripChecked(id: number, isChecked: boolean) {
  ensureDatabaseReady();
  const [updated] = await db.update(trips).set({ isChecked, updatedAt: new Date().toISOString() })
    .where(eq(trips.id, id)).returning();
  return updated ? tripToDto(updated) : null;
}
