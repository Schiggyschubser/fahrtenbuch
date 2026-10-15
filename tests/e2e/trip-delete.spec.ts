import { expect, test } from "@playwright/test";
import { parseTripCsv } from "../../lib/trip-csv";

for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
  test(`Löschen bleibt sichtbar und nummeriert Folgemonate neu (${viewport.width}px)`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(viewport);
    await page.goto("/login");
    await page.getByLabel("Benutzername").fill("admin");
    await page.getByLabel("Passwort", { exact: true }).fill("admin");
    await page.getByRole("button", { name: "Anmelden" }).click();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    const year = viewport.width === 1280 ? "2046" : "2047";
    const routeResponse = await page.request.post("/api/routes", { data: {
      placeA: `Löschtest ${year}`, placeB: "Ziel", distanceKm: 10, reimbursedKm: 10, durationMinutes: 20,
    } });
    expect(routeResponse.ok()).toBe(true);
    const routePairId = (await routeResponse.json()).route.id;
    for (const [index, date] of [`${year}-08-31`, `${year}-09-09`, `${year}-09-10`, `${year}-10-01`].entries()) {
      const response = await page.request.post("/api/trips", { data: {
        date, startTime: "09:15", endTime: "09:35", odometerStart: Number(year) * 1000 + index * 10,
        routePairId, direction: "A_TO_B", remark: "Fehleintrag-Test",
      } });
      expect(response.ok()).toBe(true);
    }
    const month = `${year}-09`;
    const readMonth = async (value: string) => (await (await page.request.get(`/api/trips?month=${value}`)).json()).trips;
    const before = await readMonth(month);
    const previousMonth = await readMonth(`${year}-08`);
    const nextMonth = await readMonth(`${year}-10`);
    const target = before[0];
    let deleteRequests = 0;
    page.on("request", request => { if (request.method() === "DELETE") deleteRequests++; });

    await page.goto(`/trips?month=${month}`);
    const rows = viewport.width === 1280 ? page.getByTestId("desktop-trip") : page.getByTestId("mobile-trip-card");
    if (viewport.width === 1280) await rows.first().locator("td").first().click();
    else await rows.first().getByRole("button").first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Fahrt löschen", exact: true }).click();
    const confirm = dialog.getByRole("button", { name: "Löschen", exact: true });
    // Check actual hit testing without Playwright scrolling the button into view.
    await expect.poll(() => confirm.evaluate(button => {
      const rect = button.getBoundingClientRect();
      return button.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
    })).toBe(true);
    await expect(confirm).toBeFocused();
    await expect(dialog).toContainText("nachfolgenden Fahrten");
    await page.screenshot({ path: `.verification/delete-confirm-${viewport.width}.png` });
    expect(deleteRequests).toBe(0);
    await dialog.getByRole("button", { name: "Abbrechen", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Fahrt löschen", exact: true })).toBeFocused();
    expect(await readMonth(month)).toEqual(before);
    await dialog.getByRole("button", { name: "Fahrt löschen", exact: true }).click();

    if (viewport.width === 1280) {
      // Both a lost connection and a non-JSON gateway response must stay actionable.
      await page.route(`**/api/trips/${target.id}`, route => route.abort("failed"), { times: 1 });
      await confirm.click();
      await expect(dialog.getByRole("alert")).toContainText("Fahrt konnte nicht gelöscht werden");
      await expect(confirm).toBeEnabled();
      await page.route(`**/api/trips/${target.id}`, route => route.fulfill({ status: 502, contentType: "text/html", body: "Bad Gateway" }), { times: 1 });
      await confirm.click();
      await expect(dialog.getByRole("alert")).toContainText("Fahrt konnte nicht gelöscht werden");
      await page.route(`**/api/trips/${target.id}`, route => route.fulfill({ status: 400, json: { error: "Test: Löschen vorübergehend gesperrt." } }), { times: 1 });
      await confirm.click();
      await expect(dialog.getByRole("alert")).toHaveText("Test: Löschen vorübergehend gesperrt.");
      expect(await readMonth(month)).toEqual(before);
    }

    const response = page.waitForResponse(res => res.request().method() === "DELETE" && res.url().endsWith(`/api/trips/${target.id}`));
    await confirm.click();
    expect((await response).ok()).toBe(true);
    await expect(dialog).toBeHidden();
    await expect(rows).toHaveCount(1);
    if (viewport.width === 1280) await expect(rows.first().locator('[data-column="sequenceNumber"]')).toHaveText(`${target.sequenceNumber}Bearbeiten`);
    else await expect(rows.first().getByText(String(target.sequenceNumber), { exact: true })).toBeVisible();
    expect(await readMonth(month)).toEqual([{ ...before[1], sequenceNumber: before[1].sequenceNumber - 1 }]);
    expect(await readMonth(`${year}-08`)).toEqual(previousMonth);
    expect(await readMonth(`${year}-10`)).toEqual([{ ...nextMonth[0], sequenceNumber: nextMonth[0].sequenceNumber - 1 }]);
    const csv = await page.request.get(`/api/trips/export?from=${year}-08-01&to=${year}-10-31`);
    const lines = (await csv.text()).replace(/^\uFEFF/, "").trim().split("\n");
    expect(lines.slice(1).map(line => Number(line.split(";")[0]))).toEqual([target.sequenceNumber - 1, target.sequenceNumber, target.sequenceNumber + 1]);
    expect(parseTripCsv(lines.join("\n"))).toHaveLength(3);
    await page.goto(`/print?month=${year}-10`);
    await page.getByLabel("Ausgabe für PDF und Druck", { exact: true }).selectOption("trips");
    await expect(page.locator('.print-pages tbody [data-column="sequenceNumber"]').first()).toHaveText(String(nextMonth[0].sequenceNumber - 1));
  });
}
