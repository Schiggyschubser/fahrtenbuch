import { and, eq, isNull } from "drizzle-orm";
import { db, ensureDatabaseReady } from "../db";
import { routePairs, type Direction } from "../db/schema";
import { unreimbursedKm } from "../kilometers";
import type { RouteOptionDto, RoutePairDto } from "../types";

function normalizePlace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function pairKey(placeA: string, placeB: string) {
  return [placeA, placeB]
    .map((value) => normalizePlace(value).toLocaleLowerCase("de-DE"))
    .sort((a, b) => a.localeCompare(b, "de"))
    .join("\u0000");
}

export async function getActiveRoutePairs(): Promise<RoutePairDto[]> {
  ensureDatabaseReady();
  const rows = await db.select({
    id: routePairs.id,
    placeA: routePairs.placeA,
    placeB: routePairs.placeB,
    distanceKm: routePairs.distanceKm,
    reimbursedKm: routePairs.reimbursedKm,
    durationMinutes: routePairs.durationMinutes,
  }).from(routePairs).where(isNull(routePairs.archivedAt));
  return rows.map((row) => ({
    ...row,
    unreimbursedKm: unreimbursedKm(row.distanceKm, row.reimbursedKm),
  })).toSorted((a, b) => `${a.placeA}${a.placeB}`.localeCompare(`${b.placeA}${b.placeB}`, "de"));
}

export function toRouteOptions(pairs: RoutePairDto[]): RouteOptionDto[] {
  return pairs.flatMap((pair) => ([
    option(pair, "A_TO_B"),
    option(pair, "B_TO_A"),
  ])).toSorted((a, b) => a.label.localeCompare(b.label, "de"));
}

function option(pair: RoutePairDto, direction: Direction): RouteOptionDto {
  const origin = direction === "A_TO_B" ? pair.placeA : pair.placeB;
  const destination = direction === "A_TO_B" ? pair.placeB : pair.placeA;
  return {
    value: `${pair.id}:${direction}`,
    routePairId: pair.id,
    direction,
    origin,
    destination,
    distanceKm: pair.distanceKm,
    reimbursedKm: pair.reimbursedKm,
    unreimbursedKm: pair.unreimbursedKm,
    durationMinutes: pair.durationMinutes,
    label: `${origin} → ${destination}`,
  };
}

export async function getActiveRoutePair(id: number) {
  ensureDatabaseReady();
  const rows = await db.select().from(routePairs)
    .where(and(eq(routePairs.id, id), isNull(routePairs.archivedAt))).limit(1);
  return rows[0] ?? null;
}

type RoutePairInput = {
  placeA: string;
  placeB: string;
  distanceKm: number;
  reimbursedKm: number;
  durationMinutes: number;
};

function routePairToDto(row: typeof routePairs.$inferSelect): RoutePairDto {
  return {
    id: row.id,
    placeA: row.placeA,
    placeB: row.placeB,
    distanceKm: row.distanceKm,
    reimbursedKm: row.reimbursedKm,
    unreimbursedKm: unreimbursedKm(row.distanceKm, row.reimbursedKm),
    durationMinutes: row.durationMinutes,
  };
}

export async function createRoutePair(input: RoutePairInput) {
  ensureDatabaseReady();
  const now = new Date().toISOString();
  const values = {
    placeA: normalizePlace(input.placeA),
    placeB: normalizePlace(input.placeB),
    pairKey: pairKey(input.placeA, input.placeB),
    distanceKm: input.distanceKm,
    reimbursedKm: input.reimbursedKm,
    durationMinutes: input.durationMinutes,
    createdAt: now,
    updatedAt: now,
  };
  const [created] = await db.insert(routePairs).values(values).returning();
  return routePairToDto(created);
}

export async function updateRoutePair(id: number, input: RoutePairInput) {
  ensureDatabaseReady();
  const [updated] = await db.update(routePairs).set({
    placeA: normalizePlace(input.placeA),
    placeB: normalizePlace(input.placeB),
    pairKey: pairKey(input.placeA, input.placeB),
    distanceKm: input.distanceKm,
    reimbursedKm: input.reimbursedKm,
    durationMinutes: input.durationMinutes,
    updatedAt: new Date().toISOString(),
  }).where(and(eq(routePairs.id, id), isNull(routePairs.archivedAt))).returning();
  return updated ? routePairToDto(updated) : null;
}

export async function archiveRoutePair(id: number) {
  ensureDatabaseReady();
  const now = new Date().toISOString();
  const [archived] = await db.update(routePairs).set({ archivedAt: now, updatedAt: now })
    .where(and(eq(routePairs.id, id), isNull(routePairs.archivedAt))).returning();
  return archived ? routePairToDto(archived) : null;
}
