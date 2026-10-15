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
  const printHtml = async () => (await fetch(`${base}/print?month=2026-09`, { headers: { Cookie } })).text();
  const claimHtml = await printHtml();
  assert.match(claimHtml, /id="print-output"/);
  assert.match(claimHtml, /Antrag drucken \/ PDF/);
  assert.equal((claimHtml.match(/<article class="claim-page-frame"/g) ?? []).length, 2);
  assert.equal((claimHtml.match(/<article class="print-sheet /g) ?? []).length, 0);
  assert.equal((await patchClaim({ ...savedClaim, includeByDefault: false })).status, 200);
  const tripsHtml = await printHtml();
  assert.match(tripsHtml, /Fahrtentabellen drucken \/ PDF/);
  assert.equal((tripsHtml.match(/<article class="claim-page-frame"/g) ?? []).length, 0);
  assert.equal((tripsHtml.match(/<article class="print-sheet /g) ?? []).length, 1);
  assert.equal((await patchClaim(savedClaim)).status, 200);
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
  const following = await post("/api/trips", { ...input, date: "2026-10-01", odometerStart: 1200 }, { Cookie });
  assert.equal(following.status, 201);
  const followingTrip = (await following.json()).trip;
  const conflict = await mutation("PUT", { expectedUpdatedAt: updated.updatedAt, date: updated.date,
    startTime: updated.startTime, endTime: updated.endTime, odometerStart: 1190 });
  assert.equal(conflict.status, 409);
  assert.equal((await conflict.json()).code, "TRIP_CHRONOLOGY_CONFLICT");
  const overlap = await post("/api/v1/trips", { ...input, clientTripId: randomUUID(), odometerStart: 1120 }, { Authorization });
  assert.equal(overlap.status, 409);
  assert.equal((await overlap.json()).code, "TRIP_CHRONOLOGY_CONFLICT");
  assert.equal((await mutation("DELETE", { expectedUpdatedAt: saved.trip.updatedAt })).status, 409);
  assert.equal((await mutation("DELETE", { expectedUpdatedAt: updated.updatedAt })).status, 200);
  assert.equal((await post("/api/v1/trips", input, { Authorization })).status, 200);
  assert.equal((await (await fetch(`${base}/api/trips?month=2026-09`, { headers: { Cookie } })).json()).trips.length, 0);
  const renumbered = (await (await fetch(`${base}/api/trips?month=2026-10`, { headers: { Cookie } })).json()).trips[0];
  assert.equal(renumbered.id, followingTrip.id);
  assert.equal(renumbered.sequenceNumber, followingTrip.sequenceNumber - 1);
  assert.equal(renumbered.odometerStart, followingTrip.odometerStart);
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
  // Exercise the bounded correction against the actual production image,
  // exclusively with this container's disposable /tmp database.
  const correctedRouteResponse = await post("/api/routes", { placeA: "KM Start", placeB: "KM Ziel", distanceKm: 30, reimbursedKm: 25, durationMinutes: 30 }, { Cookie });
  assert.equal(correctedRouteResponse.status, 201);
  const correctedRoute = (await correctedRouteResponse.json()).route;
  const odometerTrips = [];
  for (const [date, odometerStart] of [["2027-08-31", 2000], ["2027-09-01", 2035], ["2027-09-02", 2060], ["2027-09-03", 2100]]) {
    const response = await post("/api/trips", { ...input, date, odometerStart }, { Cookie });
    assert.equal(response.status, 201);
    odometerTrips.push((await response.json()).trip);
  }
  const edited = odometerTrips[0];
  const correction = { date: edited.date, startTime: edited.startTime, endTime: edited.endTime,
    odometerStart: edited.odometerStart, routePairId: correctedRoute.id, direction: "A_TO_B", expectedUpdatedAt: edited.updatedAt };
  const previewResponse = await post(`/api/trips/${edited.id}/odometer-adjustment`, correction, { Cookie });
  assert.equal(previewResponse.status, 200);
  const preview = (await previewResponse.json()).preview;
  assert.equal(preview.deltaKm, 10);
  assert.deepEqual(preview.followingTrips.map(t => t.id), odometerTrips.slice(1).map(t => t.id));
  const patchTrip = body => fetch(`${base}/api/trips/${edited.id}`, {
    method: "PATCH", headers: { Cookie, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const adjusted = await patchTrip({ ...correction, odometerAdjustment: { throughTripId: odometerTrips[2].id, revision: preview.revision } });
  assert.equal(adjusted.status, 200);
  const adjustedTrip = (await adjusted.json()).trip;
  assert.equal(adjustedTrip.odometerEnd, 2030);
  const readOdometerTrips = async () => (await (await fetch(`${base}/api/trips?month=2027-09`, { headers: { Cookie } })).json()).trips;
  const shifted = await readOdometerTrips();
  assert.deepEqual(shifted.map(t => [t.odometerStart, t.odometerEnd]), [[2045, 2065], [2070, 2090], [2100, 2120]]);
  assert.deepEqual(shifted[2], odometerTrips[3]);
  const boundaryConflict = { ...correction, expectedUpdatedAt: adjustedTrip.updatedAt, odometerStart: 2040 };
  const conflictPreview = (await (await post(`/api/trips/${edited.id}/odometer-adjustment`, boundaryConflict, { Cookie })).json()).preview;
  const rejected = await patchTrip({ ...boundaryConflict, odometerAdjustment: { throughTripId: shifted[1].id, revision: conflictPreview.revision } });
  assert.equal(rejected.status, 409);
  assert.deepEqual(await readOdometerTrips(), shifted);
  const onlyThisTrip = { ...correction, expectedUpdatedAt: adjustedTrip.updatedAt, routePairId: route.id };
  const onlyPreview = (await (await post(`/api/trips/${edited.id}/odometer-adjustment`, onlyThisTrip, { Cookie })).json()).preview;
  assert.equal(onlyPreview.deltaKm, -10);
  assert.equal((await patchTrip({ ...onlyThisTrip, odometerAdjustment: { throughTripId: null, revision: onlyPreview.revision } })).status, 200);
  assert.deepEqual(await readOdometerTrips(), shifted);
  assert.equal((await patchTrip({ ...onlyThisTrip, odometerAdjustment: { throughTripId: shifted[1].id, revision: onlyPreview.revision } })).status, 409);
  console.log("Bounded odometer correction passed: inclusive endpoint across months, unchanged following trip, variable private mileage, conflict rollback, preview and stale revision protection.");
  assert.equal((await post("/api/v1/auth/logout", {}, { Authorization })).status, 200);
  assert.equal((await fetch(`${base}/api/v1/me`, { headers: { Authorization } })).status, 401);
  console.log("Container smoke passed: chronology conflicts on create/edit, cross-month renumbering after deletion, separate claim/trip print outputs, web/mobile login, restart/retry persistence, edit/delete with revision checks, immutable receipt, logout, claim template and signature validation/persistence/removal, route search through web/mobile APIs.");
} finally { await stop(); }
