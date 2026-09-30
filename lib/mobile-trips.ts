import { createHash } from "node:crypto";
import { z } from "zod";
import { ensureDatabaseReady, sqlite } from "./db";
import { createTripSchema, updateTripSchema, dateSchema, directionSchema } from "./validation";
import { createTripSync } from "./repositories/trips";
import type { TripDto } from "./types";

export class MobileApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export const mobileTripSchema = z.strictObject({
  clientTripId: z.uuid().transform((value) => value.toLowerCase()),
  date: dateSchema,
  startTime: z.string(),
  endTime: z.string(),
  odometerStart: z.number(),
  routePairId: z.number(),
  direction: directionSchema,
  accompanyingStaff: z.string().trim().max(2000).default(""),
  remark: z.string().trim().max(2000).optional(),
}).superRefine((value, context) => {
  const result = createTripSchema.safeParse(value);
  if (!result.success) for (const issue of result.error.issues) {
    context.addIssue({ code: "custom", path: issue.path, message: issue.message });
  }
});

export const mobileTripRevisionSchema = z.strictObject({ expectedUpdatedAt: z.string().min(1).max(80) });
export const mobileTripUpdateSchema = z.strictObject({
  expectedUpdatedAt: z.string().min(1).max(80),
  date: dateSchema,
  startTime: z.string(),
  endTime: z.string(),
  odometerStart: z.number(),
  routePairId: z.number().optional(),
  direction: directionSchema.optional(),
  accompanyingStaff: z.string().trim().max(2000).optional(),
  remark: z.string().trim().max(2000).optional(),
}).superRefine((value, context) => {
  const result = updateTripSchema.safeParse(value);
  if (!result.success) for (const issue of result.error.issues) {
    context.addIssue({ code: "custom", path: issue.path, message: issue.message });
  }
});

export function submitMobileTrip(userId: number, raw: unknown) {
  const input = mobileTripSchema.parse(raw);
  const { clientTripId, ...tripInput } = input;
  // Schema parsing gives a stable key order, independent of JSON property order.
  const requestHash = createHash("sha256").update(JSON.stringify(tripInput)).digest("hex");
  ensureDatabaseReady();
  return sqlite.transaction(() => {
    const previous = sqlite.prepare(`SELECT request_hash, response_json FROM mobile_trip_submissions
      WHERE user_id = ? AND client_trip_id = ?`).get(userId, clientTripId) as
      { request_hash: string; response_json: string } | undefined;
    if (previous) {
      if (previous.request_hash !== requestHash) throw new MobileApiError(409, "CLIENT_TRIP_ID_CONFLICT", "Diese clientTripId wurde bereits für andere Fahrtdaten verwendet.");
      return { clientTripId, trip: JSON.parse(previous.response_json) as TripDto, duplicate: true };
    }
    const route = sqlite.prepare("SELECT id FROM route_pairs WHERE id = ? AND archived_at IS NULL").get(input.routePairId);
    if (!route) throw new MobileApiError(409, "ROUTE_UNAVAILABLE", "Der gewählte Reiseweg ist nicht mehr verfügbar. Bitte Reisewege aktualisieren.");
    const trip = createTripSync(tripInput);
    sqlite.prepare(`INSERT INTO mobile_trip_submissions (user_id, client_trip_id, request_hash, response_json, created_at)
      VALUES (?, ?, ?, ?, ?)`).run(userId, clientTripId, requestHash, JSON.stringify(trip), new Date().toISOString());
    return { clientTripId, trip, duplicate: false };
  }).immediate();
}
