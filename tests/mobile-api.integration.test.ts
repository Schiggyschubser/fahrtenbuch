import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { generate } from "otplib";
import { beforeAll, expect, it } from "vitest";
import { ensureDatabaseReady, sqlite } from "@/lib/db";
import { handleMobileApi } from "@/lib/mobile-api";
import { createMobileSession } from "@/lib/mobile-auth";
import { createRoutePair, archiveRoutePair } from "@/lib/repositories/routes";
import { deleteTrip, getTripsForMonth } from "@/lib/repositories/trips";
import { createTwoFactorSetup, enableTwoFactor } from "@/lib/repositories/two-factor";

let userId: number;
let token: string;
let routeId: number;
const username = "mobile-test";
const password = "test-only-password";
const trip = () => ({ clientTripId: randomUUID(), date: "2026-09-29", startTime: "08:15", endTime: "08:45",
  routePairId: routeId, direction: "A_TO_B", odometerStart: 12345, remark: "Android-Test", accompanyingStaff: "Test" });
const call = (method: string, path: string, body?: unknown, auth: string | null = token) => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) headers.Authorization = `Bearer ${auth}`;
  const request = new Request(`http://localhost/api/v1/${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return handleMobileApi(request, path.split("?")[0].split("/"));
};

beforeAll(async () => {
  ensureDatabaseReady();
  const now = new Date().toISOString();
  userId = Number(sqlite.prepare("INSERT INTO users (username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?)")
    .run(username, await bcrypt.hash(password, 4), now, now).lastInsertRowid);
  routeId = (await createRoutePair({ placeA: "Mobil Start", placeB: "Mobil Ziel", distanceKm: 20, reimbursedKm: 15, durationMinutes: 30 })).id;
});

it("authenticates, stores only a token hash and rejects unauthenticated and cookie requests", async () => {
  expect((await call("POST", "auth/login", { username, password: "wrong" }, null)).status).toBe(401);
  const response = await call("POST", "auth/login", { username, password }, null);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("set-cookie")).toBeNull();
  const auth = await response.json();
  token = auth.accessToken;
  expect(auth).toMatchObject({ tokenType: "Bearer", expiresIn: 2592000 });
  expect(sqlite.prepare("SELECT token_hash FROM sessions WHERE user_id = ?").get(userId)).not.toEqual({ token_hash: token });
  expect((await call("GET", "me", undefined, null)).status).toBe(401);
  expect((await call("POST", "trips", trip(), "invalid")).status).toBe(401);
  const cookieOnly = new Request("http://localhost/api/v1/me", { headers: { Cookie: `fahrtenbuch_session=${token}` } });
  expect((await handleMobileApi(cookieOnly, ["me"])).status).toBe(401);
  expect(await (await call("GET", "me")).json()).toMatchObject({ user: { id: userId, username }, apiVersion: 1 });
  expect(await (await call("GET", "bootstrap")).json()).toMatchObject({ apiVersion: 1, routes: [{ id: routeId, distanceKm: 20 }] });
});

it("creates one shared trip and returns an immutable receipt for repeated requests", async () => {
  const input = trip();
  const first = await call("POST", "trips", input);
  expect(first.status).toBe(201);
  const saved = await first.json();
  expect(saved).toMatchObject({ clientTripId: input.clientTripId, duplicate: false, trip: { odometerEnd: 12365, distanceKm: 20, reimbursedKm: 15, remark: input.remark } });
  const repeat = await call("POST", "trips", Object.fromEntries(Object.entries(input).reverse()));
  expect(repeat.status).toBe(200);
  expect(await repeat.json()).toEqual({ ...saved, duplicate: true });
  expect((await getTripsForMonth("2026-09")).trips).toHaveLength(1);
  const conflict = await call("POST", "trips", { ...input, odometerStart: 1 });
  expect(conflict.status).toBe(409);
  expect((await conflict.json()).code).toBe("CLIENT_TRIP_ID_CONFLICT");
  await deleteTrip(saved.trip.id);
  expect((await call("POST", "trips", input)).status).toBe(200);
  expect((await getTripsForMonth("2026-09")).trips).toHaveLength(0);
});

it("handles simultaneous retries atomically and rolls back a trip when its receipt cannot be saved", async () => {
  const input = trip();
  const results = await Promise.all([call("POST", "trips", input), call("POST", "trips", input)]);
  expect(results.map((result) => result.status).sort()).toEqual([200, 201]);
  const before = sqlite.prepare("SELECT COUNT(*) AS n FROM trips").get();
  sqlite.exec("CREATE TEMP TRIGGER reject_mobile_receipt BEFORE INSERT ON mobile_trip_submissions BEGIN SELECT RAISE(ABORT, 'test failure'); END");
  try {
    const response = await call("POST", "trips", trip());
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("test failure");
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM trips").get()).toEqual(before);
  } finally { sqlite.exec("DROP TRIGGER reject_mobile_receipt"); }
});

it("validates dates, times, numbers, unknown fields, JSON format and payload size", async () => {
  for (const patch of [{ date: "2026-02-30" }, { endTime: "07:00" }, { startTime: "0815" }, { odometerStart: -1 },
    { odometerStart: 1.5 }, { clientTripId: "not-a-uuid" }, { direction: "other" }, { routePairId: "1" }, { distanceKm: 20 }]) {
    expect((await call("POST", "trips", { ...trip(), ...patch })).status).toBe(400);
  }
  expect((await call("POST", "trips", { ...trip(), remark: "a".repeat(17000) })).status).toBe(413);
  for (const [body, contentType, status] of [["{", "application/json", 400], ["{}", "text/plain", 415]] as const) {
    const request = new Request("http://localhost/api/v1/trips", { method: "POST", body, headers: { Authorization: `Bearer ${token}`, "Content-Type": contentType } });
    expect((await handleMobileApi(request, ["trips"])).status).toBe(status);
  }
  expect((await call("GET", "trips?month=invalid")).status).toBe(400);
  expect((await call("GET", "trips?month=2026-09")).status).toBe(200);
  expect(await (await call("GET", "trips/suggested-odometer?date=2026-09-30")).json()).toEqual({ suggestedOdometerStart: 12365 });
  expect((await call("GET", "trips/suggested-odometer?date=2026-09-30&startTime=25:00")).status).toBe(400);
});

it("rejects archived routes while still acknowledging already accepted submissions", async () => {
  const input = trip();
  expect((await call("POST", "trips", input)).status).toBe(201);
  await archiveRoutePair(routeId);
  expect((await call("POST", "trips", input)).status).toBe(200);
  const unavailable = await call("POST", "trips", trip());
  expect(unavailable.status).toBe(409);
  expect((await unavailable.json()).code).toBe("ROUTE_UNAVAILABLE");
});

it("expires, logs out and revokes mobile sessions through the existing sessions table", async () => {
  const expired = createMobileSession(userId).accessToken;
  sqlite.prepare("UPDATE sessions SET expires_at = '2000-01-01' WHERE user_id = ?").run(userId);
  expect((await call("GET", "me", undefined, expired)).status).toBe(401);
  token = createMobileSession(userId).accessToken;
  expect((await call("POST", "auth/logout")).status).toBe(200);
  expect((await call("GET", "me")).status).toBe(401);
  token = createMobileSession(userId).accessToken;
  sqlite.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  expect((await call("GET", "me")).status).toBe(401);
});

it("requires the second factor and never issues a token before successful verification", async () => {
  const setup = await createTwoFactorSetup(userId, password);
  await enableTwoFactor(userId, password, setup.secret, await generate({ secret: setup.secret }));
  const response = await call("POST", "auth/login", { username, password }, null);
  const challenge = await response.json();
  expect(challenge.requiresTwoFactor).toBe(true);
  expect(challenge.accessToken).toBeUndefined();
  expect((await call("POST", "auth/two-factor", { challengeToken: challenge.challengeToken, code: "bad-code" }, null)).status).toBe(401);
  const body = { challengeToken: challenge.challengeToken, code: await generate({ secret: setup.secret }) };
  const success = await call("POST", "auth/two-factor", body, null);
  expect(success.status).toBe(200);
  expect((await success.json()).accessToken).toMatch(/^fbm_/);
  expect((await call("POST", "auth/two-factor", body, null)).status).toBe(401);
});

it("rate limits password attempts", async () => {
  for (let i = 0; i < 5; i++) expect((await call("POST", "auth/login", { username: "missing", password }, null)).status).toBe(401);
  const response = await call("POST", "auth/login", { username: "missing", password }, null);
  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBe("60");
});
