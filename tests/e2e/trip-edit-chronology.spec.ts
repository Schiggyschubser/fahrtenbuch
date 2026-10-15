import { expect, test } from "@playwright/test";

for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
  test(`Bearbeiten zeigt Chronologiefehler sichtbar und speichert erst nach Korrektur (${viewport.width}px)`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize(viewport);
    await page.goto("/login");
    await page.getByLabel("Benutzername").fill("admin");
    await page.getByLabel("Passwort", { exact: true }).fill("admin");
    await page.getByRole("button", { name: "Anmelden" }).click();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    const year = viewport.width === 1280 ? 2048 : 2049;
    const odometerStart = year * 1000;
    const date = `${year}-09-09`;
    const routeInput = { placeA: `Chronologie ${year}`, placeB: "Ziel", distanceKm: 10, reimbursedKm: 10, durationMinutes: 20 };
    const { route } = await (await page.request.post("/api/routes", { data: routeInput })).json();
    expect((await page.request.post("/api/routes", { data: { ...routeInput, placeB: "Lang", distanceKm: 50 } })).ok()).toBe(true);
    for (const [startTime, endTime, km] of [["09:00", "09:20", odometerStart], ["10:00", "10:20", odometerStart + 20]]) {
      expect((await page.request.post("/api/trips", { data: { date, startTime, endTime, odometerStart: km, routePairId: route.id, direction: "A_TO_B" } })).ok()).toBe(true);
    }
    const read = async () => (await (await page.request.get(`/api/trips?month=${year}-09`)).json()).trips;
    const original = await read();
    await page.goto(`/trips?month=${year}-09`);
    const rows = viewport.width === 1280 ? page.getByTestId("desktop-trip") : page.getByTestId("mobile-trip-card");
    if (viewport.width === 1280) await rows.first().locator("td").first().click();
    else await rows.first().getByRole("button").first().click();
    const dialog = page.getByRole("dialog");
    const save = dialog.getByRole("button", { name: "Speichern", exact: true });
    await dialog.getByLabel("KM Beginn", { exact: true }).fill(String(odometerStart + 11));
    await save.click();
    await dialog.getByRole("button", { name: "Änderung bestätigen", exact: true }).click();
    const alert = dialog.getByRole("alert");
    await expect(alert).toContainText("KM Ende");
    await expect(alert).toBeInViewport();
    expect(await read()).toEqual(original);
    await dialog.getByRole("button", { name: "Zurück zur Bearbeitung", exact: true }).click();
    await dialog.getByLabel("KM Beginn", { exact: true }).fill(String(odometerStart));
    await dialog.getByLabel("Ende", { exact: true }).fill("10:01");
    await save.click();
    await expect(alert).toContainText("überschneidet");
    expect(await read()).toEqual(original);
    await dialog.getByLabel("Ende", { exact: true }).fill("09:20");
    await dialog.getByRole("combobox", { name: "Reiseweg" }).fill(`Chronologie ${year}`);
    await page.getByRole("option", { name: new RegExp(`Chronologie ${year}.*Lang`) }).click();
    await save.click();
    await dialog.getByRole("button", { name: "Änderung bestätigen", exact: true }).click();
    await expect(alert).toContainText("KM Ende");
    expect(await read()).toEqual(original);
    await dialog.getByRole("button", { name: "Zurück zur Bearbeitung", exact: true }).click();
    await dialog.getByRole("combobox", { name: "Reiseweg" }).fill(`Chronologie ${year}`);
    await page.getByRole("option", { name: new RegExp(`Chronologie ${year}.*Ziel`) }).click();
    await dialog.getByLabel("KM Beginn", { exact: true }).fill(String(odometerStart + 5));
    await save.click();
    await dialog.getByRole("button", { name: "Änderung bestätigen", exact: true }).click();
    await expect(dialog).toBeHidden();
    const updated = await read();
    expect(updated[0]).toMatchObject({ id: original[0].id, odometerStart: odometerStart + 5, odometerEnd: odometerStart + 15 });
    expect(updated[1]).toEqual(original[1]);
  });
}
