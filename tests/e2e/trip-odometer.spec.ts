import { expect, test } from "@playwright/test";
import type { TripDto } from "../../lib/types";

for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
  test(`Kilometer bis zur gewählten Fahrt einschließlich verschieben (${viewport.width}px)`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(viewport);
    await page.goto("/login");
    await page.getByLabel("Benutzername").fill("admin");
    await page.getByLabel("Passwort", { exact: true }).fill("admin");
    await page.getByRole("button", { name: "Anmelden" }).click();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    const year = viewport.width === 1280 ? 2050 : 2051;
    const km = year * 1000;
    const routeInput = { placeA: `KM-Bereich ${year}`, placeB: "Original", distanceKm: 20, reimbursedKm: 18, durationMinutes: 20 };
    const addRoute = async (placeB: string, distanceKm: number) => {
      const response = await page.request.post("/api/routes", { data: { ...routeInput, placeB, distanceKm } });
      expect(response.ok()).toBe(true);
      return (await response.json()).route.id;
    };
    const routePairId = await addRoute("Original", 20);
    await addRoute("Korrigiert", 30);
    await addRoute("Sehr lang", 60);
    for (const [date, distance] of [[`${year}-09-30`, 0], [`${year}-10-01`, 35], [`${year}-10-02`, 60], [`${year}-10-03`, 100]] as const) {
      expect((await page.request.post("/api/trips", { data: {
        date, odometerStart: km + distance, startTime: "09:00", endTime: "09:20", routePairId, direction: "A_TO_B",
      } })).ok()).toBe(true);
    }
    const read = async (month: string): Promise<TripDto[]> => (await (await page.request.get(`/api/trips?month=${month}`)).json()).trips;
    const currentBefore = (await read(`${year}-09`))[0];
    const followingBefore = await read(`${year}-10`);
    const dialog = page.getByRole("dialog");
    const open = async () => {
      await page.goto(`/trips?month=${year}-09`);
      const rows = viewport.width === 1280 ? page.getByTestId("desktop-trip") : page.getByTestId("mobile-trip-card");
      if (viewport.width === 1280) await rows.first().locator("td").first().click();
      else await rows.first().getByRole("button").first().click();
    };
    const chooseRoute = async (destination: string) => {
      await dialog.getByRole("combobox", { name: "Reiseweg" }).fill(`KM-Bereich ${year}`);
      await page.getByRole("option", { name: new RegExp(`KM-Bereich ${year}.*${destination}`) }).click();
    };
    const save = () => dialog.getByRole("button", { name: "Speichern", exact: true }).click();
    const confirm = dialog.getByRole("button", { name: "Änderung bestätigen", exact: true });
    const selection = dialog.getByLabel("Kilometer verschieben bis einschließlich");
    let patches = 0;
    page.on("request", request => { if (request.method() === "PATCH" && request.url().endsWith(`/trips/${currentBefore.id}`)) patches++; });

    await open();
    await chooseRoute("Korrigiert");
    await save();
    await expect(selection).toBeFocused();
    await expect(selection).toHaveValue("");
    await expect(selection.locator("option")).toHaveCount(4);
    expect(patches).toBe(0);
    expect(await read(`${year}-09`)).toEqual([currentBefore]);
    expect(await read(`${year}-10`)).toEqual(followingBefore);
    await dialog.getByRole("button", { name: "Zurück zur Bearbeitung" }).click();
    await expect(dialog.getByRole("combobox", { name: "Reiseweg" })).toHaveValue(`KM-Bereich ${year} → Korrigiert`);
    await save();
    await selection.selectOption(String(followingBefore[1].id));
    await expect(dialog.getByRole("status")).toContainText("2 nachfolgende Fahrten werden um +10 km verschoben");
    await expect(dialog.getByRole("status")).toContainText(`Ab Fahrt Nr. ${followingBefore[2].sequenceNumber}`);
    await expect.poll(() => confirm.evaluate(button => {
      const rect = button.getBoundingClientRect();
      return button.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
    })).toBe(true);
    await page.screenshot({ path: `.verification/odometer-confirm-${viewport.width}.png` });
    if (viewport.width === 1280) {
      await page.route(`**/api/trips/${currentBefore.id}`, route => route.abort("failed"), { times: 1 });
      await confirm.click();
      await expect(dialog.getByRole("alert")).toBeVisible();
      await expect(selection).toHaveValue(String(followingBefore[1].id));
      expect(await read(`${year}-10`)).toEqual(followingBefore);
    }
    await confirm.click();
    await expect(dialog).toBeHidden();
    const shifted = await read(`${year}-10`);
    expect(shifted).toEqual(followingBefore.map((trip, index) => index < 2 ? {
      ...trip, odometerStart: trip.odometerStart + 10, odometerEnd: trip.odometerEnd + 10, updatedAt: expect.any(String),
    } : trip));
    expect(shifted[0].odometerStart - (await read(`${year}-09`))[0].odometerEnd).toBe(15);
    expect(shifted[1].odometerStart - shifted[0].odometerEnd).toBe(5);
    expect(shifted[2].odometerStart - shifted[1].odometerEnd).toBe(10);

    // Explicitly leave following trips untouched: the private gap grows.
    await open();
    await chooseRoute("Original");
    await save();
    await expect(selection).toHaveValue("");
    await confirm.click();
    await expect(dialog).toBeHidden();
    expect(await read(`${year}-10`)).toEqual(shifted);
    const current = (await read(`${year}-09`))[0];
    expect(current.odometerEnd).toBe(km + 20);
    expect(shifted[0].odometerStart - current.odometerEnd).toBe(25);

    // A negative boundary gap rejects the whole operation; selecting another
    // endpoint remains possible in the same confirmation.
    await open();
    await chooseRoute("Sehr lang");
    await save();
    await selection.selectOption(String(followingBefore[1].id));
    await confirm.click();
    await expect(dialog.getByRole("alert")).toContainText("KM Ende");
    await expect(dialog.getByRole("alert")).toBeInViewport();
    expect(await read(`${year}-09`)).toEqual([current]);
    expect(await read(`${year}-10`)).toEqual(shifted);
    await selection.selectOption(String(followingBefore[2].id));
    await expect(dialog.getByRole("status")).toContainText("3 nachfolgende Fahrten");
    await dialog.getByRole("button", { name: "Zurück zur Bearbeitung" }).click();
    await dialog.getByRole("button", { name: "Abbrechen", exact: true }).click();
    await expect(dialog).toBeHidden();
    expect(await read(`${year}-10`)).toEqual(shifted);
  });
}
