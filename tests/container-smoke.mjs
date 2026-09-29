// Run only in a disposable image container with a fresh /tmp database.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomUUID } from "node:crypto";

assert.equal(process.env.DATABASE_PATH, "/tmp/mobile-smoke/fahrtenbuch.db");
let server;
const base = "http://127.0.0.1:3000";
async function start() {
  server = spawn(process.execPath, ["server.js"], { stdio: "ignore" });
  for (let i = 0; i < 100; i++) {
    try {
      const response = await fetch(`${base}/login`);
      if (response.ok) { assert.match(await response.text(), /1\.0\.12/); return; }
    } catch { /* startup */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Test server did not start");
}
async function stop() {
  if (server && server.exitCode === null) {
    const stopped = once(server, "exit");
    server.kill("SIGTERM");
    await stopped;
  }
}
const post = (path, body, headers = {}) => fetch(`${base}${path}`, {
  method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body),
});
try {
  await start();
  assert.equal((await fetch(`${base}/api/v1/me`)).status, 401);
  const credentials = { username: "admin", password: "admin" }; // Disposable default account only.
  const webLogin = await post("/api/auth/login", credentials);
  assert.equal(webLogin.status, 200);
  const Cookie = webLogin.headers.get("set-cookie").split(";")[0];
  const routeResponse = await post("/api/routes", { placeA: "Smoke A", placeB: "Smoke B", distanceKm: 20, reimbursedKm: 15, durationMinutes: 30 }, { Cookie });
  assert.equal(routeResponse.status, 201);
  const route = (await routeResponse.json()).route;
  const login = await post("/api/v1/auth/login", credentials);
  assert.equal(login.status, 200);
  const Authorization = `Bearer ${(await login.json()).accessToken}`;
  const bootstrap = await fetch(`${base}/api/v1/bootstrap`, { headers: { Authorization } });
  assert.equal((await bootstrap.json()).routes[0].id, route.id);
  const input = { clientTripId: randomUUID(), date: "2026-09-29", startTime: "08:15", endTime: "08:45", routePairId: route.id, direction: "A_TO_B", odometerStart: 1000 };
  const created = await post("/api/v1/trips", input, { Authorization });
  assert.equal(created.status, 201);
  const saved = await created.json();
  assert.equal(saved.trip.odometerEnd, 1020);
  await stop();
  await start();
  const repeated = await post("/api/v1/trips", input, { Authorization });
  assert.equal(repeated.status, 200);
  assert.deepEqual(await repeated.json(), { ...saved, duplicate: true });
  const webTrips = await fetch(`${base}/api/trips?month=2026-09`, { headers: { Cookie } });
  const trips = (await webTrips.json()).trips;
  assert.equal(trips.length, 1);
  assert.equal(trips[0].id, saved.trip.id);
  assert.equal((await post("/api/v1/auth/logout", {}, { Authorization })).status, 200);
  assert.equal((await fetch(`${base}/api/v1/me`, { headers: { Authorization } })).status, 401);
  console.log("Container smoke passed: web login, route creation, mobile login, bootstrap, trip, restart/retry persistence, web visibility, logout.");
} finally { await stop(); }
