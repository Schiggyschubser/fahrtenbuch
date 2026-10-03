import { expect, test } from "@playwright/test";
import type { RouteOptionDto } from "../../lib/types";

test("Reisewegsuche zeigt auf Desktop und mobil dieselbe Reihenfolge wie die APIs", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Benutzername").fill("admin");
  await page.getByLabel("Passwort", { exact: true }).fill("admin");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  for (const [placeA, placeB] of [["COII", "Zentrale"], ["AG", "COII"], ["COII", "Büro"]]) {
    const response = await page.request.post("/api/routes", { data: { placeA, placeB, distanceKm: 20, reimbursedKm: 15, durationMinutes: 30 } });
    expect(response.status()).toBe(201);
  }
  const login = await page.request.post("/api/v1/auth/login", { data: { username: "admin", password: "admin" } });
  expect(login.status()).toBe(200);
  const headers = { Authorization: `Bearer ${(await login.json()).accessToken}` };
  const expected = ["COII → AG", "COII → Büro", "COII → Zentrale", "AG → COII", "Büro → COII", "Zentrale → COII"];
  for (const endpoint of ["/api/routes", "/api/v1/routes", "/api/v1/bootstrap"]) {
    const response = await page.request.get(`${endpoint}?q=Coii`, { headers });
    expect(response.status()).toBe(200);
    expect((await response.json()).routeOptions.map((option: RouteOptionDto) => option.label)).toEqual(expected);
  }
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/trips?month=2039-01");
    await page.getByRole("button", { name: /Neue Fahrt/ }).click();
    const dialog = page.getByRole("dialog");
    const input = dialog.getByRole("combobox", { name: "Reiseweg" });
    await input.fill("Coii");
    const options = page.locator("#route-option-list").getByRole("option");
    await expect(options).toHaveCount(expected.length);
    for (let index = 0; index < expected.length; index++) {
      await expect(options.nth(index).locator("span.block").first()).toHaveText(expected[index].replaceAll(" ", ""));
    }
    await options.first().click();
    await expect(input).toHaveValue("COII → AG");
    await input.click();
    await expect(options.first().locator("span.block").first()).toHaveText("AG→COII");
    await input.fill("unbekannt");
    await expect(page.getByText("Kein passender Reiseweg gefunden.")).toBeVisible();
    await dialog.getByRole("button", { name: "Abbrechen", exact: true }).click();
  }
});
