import { beforeAll, expect, it } from "vitest";
import { ensureDatabaseReady, sqlite } from "@/lib/db";
import { createMobileSession } from "@/lib/mobile-auth";
import { handleMobileApi } from "@/lib/mobile-api";
import { archiveRoutePair, createRoutePair } from "@/lib/repositories/routes";
import type { RouteOptionDto } from "@/lib/types";

let token: string;
let archivedId: number;
const call = (path: string, authenticated = true) => handleMobileApi(new Request(`http://localhost/api/v1/${path}`, {
  headers: authenticated ? { Authorization: `Bearer ${token}` } : {},
}), [path.split("?")[0]]);

beforeAll(async () => {
  ensureDatabaseReady();
  const user = sqlite.prepare("SELECT id FROM users LIMIT 1").get() as { id: number };
  token = createMobileSession(user.id).accessToken;
  for (const [placeA, placeB] of [["COII", "Zentrale"], ["AG", "COII"], ["COII", "Büro"]]) {
    await createRoutePair({ placeA, placeB, distanceKm: 20, reimbursedKm: 15, durationMinutes: 30 });
  }
  archivedId = (await createRoutePair({ placeA: "COII", placeB: "Archiv", distanceKm: 10, reimbursedKm: 10, durationMinutes: 15 })).id;
  await archiveRoutePair(archivedId);
});

it("liefert dieselbe Suchreihenfolge für routes und bootstrap und erhält die Streckenpaare", async () => {
  for (const endpoint of ["routes", "bootstrap"]) {
    const response = await call(`${endpoint}?q=%20Coii%20`);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = await response.json();
    expect(body.routeOptions.map((option: RouteOptionDto) => option.label)).toEqual([
      "COII → AG", "COII → Büro", "COII → Zentrale", "AG → COII", "Büro → COII", "Zentrale → COII",
    ]);
    expect(body.routeOptions.find((option: RouteOptionDto) => option.label === "COII → AG")).toMatchObject({
      direction: "B_TO_A", origin: "COII", destination: "AG", distanceKm: 20,
    });
    expect(body.routes).toHaveLength(3);
    expect(body.routes.some((route: { id: number }) => route.id === archivedId)).toBe(false);
    expect(body.routes).toEqual((await (await call(endpoint)).json()).routes);
    if (endpoint === "bootstrap") expect(body.capabilities.routeSearch).toBe(true);
  }
});

it("liefert ohne Suche beide Richtungen alphabetisch und bei unbekannter Suche keine Optionen", async () => {
  expect((await (await call("routes")).json()).routeOptions.map((option: RouteOptionDto) => option.label)).toEqual([
    "AG → COII", "Büro → COII", "COII → AG", "COII → Büro", "COII → Zentrale", "Zentrale → COII",
  ]);
  for (const endpoint of ["routes", "bootstrap"]) {
    const body = await (await call(`${endpoint}?q=unbekannt`)).json();
    expect(body.routeOptions).toEqual([]);
    expect(body.routes).toHaveLength(3);
    expect((await call(`${endpoint}?q=Coii`, false)).status).toBe(401);
  }
});
