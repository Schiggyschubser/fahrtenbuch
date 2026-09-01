import { and, asc, desc, eq, gte, lt, lte, or } from "drizzle-orm";
import { db, ensureDatabaseReady, sqlite } from "../db";
import { trips, type Direction } from "../db/schema";
import { createBackup } from "../backups";
import { monthBounds } from "../dates";
import { unreimbursedKm } from "../kilometers";
import { potentialReimbursementCents } from "../money";
import type { MonthDataDto, TripCsvImportResultDto, TripDateRangeDto, TripDto } from "../types";
import { tripCsvDuplicateKey, type TripCsvRow } from "../trip-csv";
import { getActiveRoutePair } from "./routes";
import { getReimbursementSettings } from "./settings";

export function tripToDto(row: typeof trips.$inferSelect): TripDto {
  return {
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
  const existingKeys = new Set(existingRows.map((row) => {
    const dto = tripToDto(row);
    return tripCsvDuplicateKey({
      date: dto.date,
      startTime: dto.startTime,
      endTime: dto.endTime,
      routeLabel: dto.routeLabel,
      odometerStart: dto.odometerStart,
      odometerEnd: dto.odometerEnd,
    });
  }));
  const pendingKeys = new Set<string>();
  const pending: TripCsvRow[] = [];
  let skipped = 0;
  for (const row of rows) {
    const key = tripCsvDuplicateKey(row);
    if (existingKeys.has(key) || pendingKeys.has(key)) {
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
      odometer_start, is_checked, created_at, updated_at
    ) VALUES (?, ?, ?, NULL, NULL, ?, '', ?, ?, 40, ?, 0, ?, ?)
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
        distanceKm,
        row.odometerStart,
        now,
        now,
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
  ensureDatabaseReady();
  const [pair, settings] = await Promise.all([
    getActiveRoutePair(input.routePairId),
    getReimbursementSettings(),
  ]);
  if (!pair) throw new Error("Der gewählte Reiseweg ist nicht mehr verfügbar.");
  const now = new Date().toISOString();
  const [created] = await db.insert(trips).values({
    ...input,
    ...routeSnapshot(pair, input.direction),
    reimbursementRateCentsSnapshot: settings.reimbursementRateCents,
    createdAt: now,
    updatedAt: now,
  }).returning();
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
      routePairId: input.routePairId,
      direction: input.direction,
      ...routeSnapshot(pair, input.direction),
    };
  }
  const [updated] = await db.update(trips).set({
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
