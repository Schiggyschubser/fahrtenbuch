import { expect, test } from "@playwright/test";
import { parseTripCsv } from "../../lib/trip-csv";

test("Bemerkungsvorlagen, Fahrttexte und CSV funktionieren auf Desktop, mobil und im PDF", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/login");
  await page.getByLabel("Benutzername").fill("admin");
  await page.getByLabel("Passwort", { exact: true }).fill("admin");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/settings?tab=remarks");
  await page.getByRole("button", { name: "Vorlage hinzufügen" }).click();
  await page.getByLabel("Vorlage 1", { exact: true }).fill("Dienstbesprechung");
  await page.getByRole("button", { name: "Vorlage hinzufügen" }).click();
  await page.getByLabel("Vorlage 2", { exact: true }).fill("Ortstermin");
  await page.getByLabel("Standardbemerkung für neue Fahrten").selectOption("0");
  await page.getByRole("button", { name: "Bemerkungsvorlagen speichern" }).click();
  await expect(page.getByRole("status")).toHaveText("Bemerkungsvorlagen gespeichert.");
  await page.reload();
  await expect(page.getByLabel("Standardbemerkung für neue Fahrten")).toHaveValue("0");
  await page.screenshot({ path: "test-results/remark-settings.png", fullPage: true });

  const routeResponse = await page.request.post("/api/routes", { data: {
    placeA: "HH-Texte", placeB: "B-Texte", placeAFullName: "Hamburg Zentrale", placeBFullName: "Berlin Außenstelle",
    distanceKm: 18, reimbursedKm: 14, durationMinutes: 30,
  } });
  expect(routeResponse.ok()).toBe(true);
  const routeId = (await routeResponse.json()).route.id;
  await page.goto("/trips?month=2038-03");
  await page.getByRole("button", { name: /Neue Fahrt/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Bemerkung", { exact: true })).toHaveValue("Dienstbesprechung");
  await expect(dialog.getByLabel("Bemerkungsvorlage")).not.toHaveValue("");
  await dialog.getByLabel("Bemerkungsvorlage").selectOption({ label: "Ortstermin" });
  await expect(dialog.getByLabel("Bemerkung", { exact: true })).toHaveValue("Ortstermin");
  const staff = 'Müller; "Anna"\nSchmidt';
  const remark = 'Ortstermin; "Projekt"\nZusätzlicher Freitext';
  await dialog.getByLabel("Bemerkung", { exact: true }).fill(remark);
  await dialog.getByLabel("Mitgenommene Bedienstete").fill(staff);
  await dialog.getByRole("combobox", { name: "Reiseweg" }).fill("HH-Texte");
  await page.getByRole("option", { name: /HH-Texte.*B-Texte/ }).click();
  await dialog.getByLabel("Datum").fill("2038-03-01");
  await dialog.getByLabel("Beginn", { exact: true }).fill("08:00");
  await dialog.getByLabel("KM Beginn").fill("1000");
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("columnheader", { name: "Mitgenommene Bedienstete", exact: true })).toBeVisible();
  await expect(page.getByTestId("desktop-trip").getByText(remark, { exact: true })).toBeVisible();
  await page.getByTestId("desktop-trip").getByText(remark, { exact: true }).click();
  await expect(dialog.getByLabel("Bemerkung", { exact: true })).toHaveValue(remark);
  await expect(dialog.getByLabel("Mitgenommene Bedienstete")).toHaveValue(staff);
  await dialog.getByRole("button", { name: "Abbrechen", exact: true }).click();

  // The dashboard shortcut uses the same standard and allows explicit clearing.
  await page.goto("/?addTrip=1");
  await expect(dialog.getByLabel("Bemerkung", { exact: true })).toHaveValue("Dienstbesprechung");
  await dialog.getByLabel("Bemerkung", { exact: true }).fill("");
  await dialog.getByRole("combobox", { name: "Reiseweg" }).fill("HH-Texte");
  await page.getByRole("option", { name: /HH-Texte.*B-Texte/ }).click();
  await dialog.getByLabel("Datum").fill("2038-03-02");
  await dialog.getByLabel("Beginn", { exact: true }).fill("08:00");
  await dialog.getByLabel("KM Beginn").fill("1018");
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(dialog).toBeHidden();
  const tripResponse = await page.request.get("/api/trips?month=2038-03");
  const trips = (await tripResponse.json()).trips;
  expect(trips[1].remark).toBe("");

  const csvResponse = await page.request.get("/api/trips/export?from=2038-03-01&to=2038-03-02");
  expect(csvResponse.ok()).toBe(true);
  const csv = await csvResponse.text();
  expect(parseTripCsv(csv)[0]).toMatchObject({ originFullName: "Hamburg Zentrale", destinationFullName: "Berlin Außenstelle", accompanyingStaff: staff, remark });
  await page.goto("/settings?tab=transfer");
  await page.getByLabel("CSV-Datei auswählen").setInputFiles({ name: "roundtrip.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByRole("button", { name: "CSV importieren" }).click();
  await expect(page.getByText(/2 Dubletten wurden übersprungen/)).toBeVisible();

  const longRemark = "Ausführliche Besprechung mit zusätzlichen Informationen und mehreren beteiligten Stellen. ".repeat(8).trim();
  for (let day = 3; day <= 20; day++) {
    const response = await page.request.post("/api/trips", { data: {
      date: `2038-03-${String(day).padStart(2, "0")}`, startTime: "08:00", endTime: "08:30", odometerStart: 1000 + day * 18,
      routePairId: routeId, direction: day % 2 ? "A_TO_B" : "B_TO_A", accompanyingStaff: staff, remark: longRemark,
    } });
    expect(response.ok()).toBe(true);
  }
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/settings?tab=remarks");
  await expect(page.getByRole("tab", { name: "Bemerkungen", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.getByLabel("Vorlage 1", { exact: true }).fill("Geänderte Vorlage");
  await page.getByRole("button", { name: "Bemerkungsvorlagen speichern" }).click();
  await expect(page.getByRole("status")).toBeVisible();
  await page.goto("/trips?month=2038-03");
  await expect(page.getByTestId("mobile-trip-card").first()).toContainText(remark);
  await expect(page.getByTestId("mobile-trip-card").first()).toContainText(staff.replace("\n", " "));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.getByTestId("mobile-trip-card").first().getByRole("button").first().click();
  await expect(dialog.getByLabel("Bemerkung", { exact: true })).toHaveValue(remark);
  await dialog.getByRole("button", { name: "Abbrechen", exact: true }).click();
  await page.screenshot({ path: "test-results/remark-mobile.png", fullPage: true });
  await page.goto("/print?month=2038-03");
  await expect(page.getByTestId("print-table-wrap")).toContainText(remark);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("columnheader", { name: "Bemerkungen", exact: true }).first()).toBeVisible();
  const firstRow = page.getByTestId("print-table-wrap").locator("tbody tr").first();
  await expect(firstRow).toContainText(remark);
  await expect(firstRow.getByTestId("trip-place-note")).toContainText("Hamburg Zentrale");
  await expect(firstRow).toHaveCSS("break-inside", "avoid");
  const pdf = await page.pdf({ preferCSSPageSize: true, path: "test-results/remarks-print.pdf" });
  expect((pdf.toString("latin1").match(/\/Type\s*\/Page\b/g) ?? []).length).toBeGreaterThan(1);
  await page.screenshot({ path: "test-results/remarks-print.png", fullPage: true });
});
