// Run only in a disposable image container with a fresh /tmp database.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

assert.equal(process.env.DATABASE_PATH, "/tmp/mobile-smoke/fahrtenbuch.db");
let server;
const base = "http://127.0.0.1:3000";
async function start() {
  server = spawn(process.execPath, ["server.js"], { stdio: "ignore" });
  for (let i = 0; i < 100; i++) {
    try {
      const response = await fetch(`${base}/login`);
      if (response.ok) {
        const { version } = JSON.parse((await import("node:fs")).readFileSync("package.json", "utf8"));
        assert.ok((await response.text()).includes(`Version ${version}`));
        return;
      }
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
  assert.equal((await fetch(`${base}/api/settings/claim-template`)).status, 401);
  const claimUrl = `${base}/api/settings/claim-template`;
  const initialClaim = await (await fetch(claimUrl, { headers: { Cookie } })).json();
  assert.equal(initialClaim.signature, null);
  const signatureImage = await sharp({ create: { width: 150, height: 30, channels: 4, background: "navy" } }).png().toBuffer();
  const claim = { ...initialClaim, includeByDefault: true,
    fields: { ...initialClaim.fields, recipient: "Smoke Test", signaturePlace: "Testort" },
    signature: `data:image/png;base64,${signatureImage.toString("base64")}` };
  const patchClaim = body => fetch(claimUrl, { method: "PATCH", headers: { Cookie, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const savedClaimResponse = await patchClaim(claim);
  assert.equal(savedClaimResponse.status, 200);
  const savedClaim = await savedClaimResponse.json();
  assert.match(savedClaim.signature, /^data:image\/png;base64,/);
  assert.equal((await patchClaim({ ...claim, signature: "data:image/png;base64,YmFk" })).status, 400);
  assert.deepEqual(await (await fetch(claimUrl, { headers: { Cookie } })).json(), savedClaim);
  for (const page of [1, 2]) {
    const form = await fetch(`${base}/forms/travel-claim/page-${page}.svg`);
    assert.equal(form.status, 200);
    assert.match(await form.text(), /<svg/);
  }
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
  assert.deepEqual(await (await fetch(claimUrl, { headers: { Cookie } })).json(), savedClaim);
  assert.equal((await patchClaim({ ...savedClaim, signature: null })).status, 200);
  assert.equal((await (await fetch(claimUrl, { headers: { Cookie } })).json()).signature, null);
  const repeated = await post("/api/v1/trips", input, { Authorization });
  assert.equal(repeated.status, 200);
  assert.deepEqual(await repeated.json(), { ...saved, duplicate: true });
  const webTrips = await fetch(`${base}/api/trips?month=2026-09`, { headers: { Cookie } });
  const trips = (await webTrips.json()).trips;
  assert.equal(trips.length, 1);
  assert.equal(trips[0].id, saved.trip.id);
  const mutation = (method, body) => fetch(`${base}/api/v1/trips/${saved.trip.id}`, {
    method, headers: { Authorization, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const changed = await mutation("PUT", { expectedUpdatedAt: saved.trip.updatedAt, date: input.date,
    startTime: input.startTime, endTime: input.endTime, odometerStart: 1100, remark: "Im Container geÃ¤ndert" });
  assert.equal(changed.status, 200);
  const updated = (await changed.json()).trip;
  assert.equal(updated.odometerStart, 1100);
  assert.equal(updated.odometerEnd, 1120);
  assert.equal((await mutation("DELETE", { expectedUpdatedAt: saved.trip.updatedAt })).status, 409);
  assert.equal((await mutation("DELETE", { expectedUpdatedAt: updated.updatedAt })).status, 200);
  assert.equal((await post("/api/v1/trips", input, { Authorization })).status, 200);
  assert.equal((await (await fetch(`${base}/api/trips?month=2026-09`, { headers: { Cookie } })).json()).trips.length, 0);
  for (const [placeA, placeB] of [["COII", "Zentrale"], ["AG", "COII"], ["COII", "Büro"]]) {
    assert.equal((await post("/api/routes", { placeA, placeB, distanceKm: 20, reimbursedKm: 15, durationMinutes: 30 }, { Cookie })).status, 201);
  }
  for (const path of ["/api/routes", "/api/v1/routes", "/api/v1/bootstrap"]) {
    const response = await fetch(`${base}${path}?q=Coii`, { headers: { Cookie, Authorization } });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.routeOptions.map(option => option.label), [
      "COII → AG", "COII → Büro", "COII → Zentrale", "AG → COII", "Büro → COII", "Zentrale → COII",
    ]);
    assert.equal(body.routes.length, 4);
  }
  assert.equal((await post("/api/v1/auth/logout", {}, { Authorization })).status, 200);
  assert.equal((await fetch(`${base}/api/v1/me`, { headers: { Authorization } })).status, 401);
  console.log("Container smoke passed: web/mobile login, trip, restart/retry persistence, web visibility, edit/delete with revision checks, immutable receipt, logout, claim template and signature validation/persistence/removal, both form pages, route search order through web/mobile APIs and bootstrap.");
} finally { await stop(); }
