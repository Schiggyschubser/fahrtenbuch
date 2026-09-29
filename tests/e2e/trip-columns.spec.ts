import { expect, test } from "@playwright/test";
import { TRIP_COLUMNS } from "../../lib/trip-columns";
import { parseTripCsv } from "../../lib/trip-csv";

test("Globale Spaltenauswahl, Desktopbreiten, mobile Ansicht und Druck", async ({ page, browser }) => {
  test.setTimeout(120_000);
  await page.goto("/login");
  expect((await page.request.get("/api/settings/trip-columns")).status()).toBe(401);
  expect((await page.request.patch("/api/settings/trip-columns", { data: { visibleColumns: ["date"] } })).status()).toBe(401);
  expect((await page.request.get("/api/settings/print-columns")).status()).toBe(401);
  expect((await page.request.patch("/api/settings/print-columns", { data: { visibleColumns: ["date"] } })).status()).toBe(401);
  await page.getByLabel("Benutzername").fill("admin");
  await page.getByLabel("Passwort", { exact: true }).fill("admin");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  expect((await page.request.patch("/api/settings/trip-columns", { data: { visibleColumns: [] } })).status()).toBe(400);
  await page.setViewportSize({ width: 1920, height: 1080 });
  for (const url of ["/", "/trips", "/settings"]) {
    await page.goto(url);
    await expect(page.locator("main.app-frame")).toHaveCSS("max-width", "1600px");
    const frames = await page.locator("main.app-frame, [data-testid=desktop-app-bar], .app-footer .app-frame").evaluateAll((elements) => elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, width: rect.width, padding: getComputedStyle(element).paddingLeft };
    }));
    expect(frames).toHaveLength(3);
    expect(frames).toEqual(Array(3).fill({ x: 160, width: 1600, padding: "32px" }));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
  const route = await page.request.post("/api/routes", { data: { placeA: "LangerStartortOhneTrennzeichen".repeat(3), placeB: "Außenstelle Spalten", distanceKm: 23, reimbursedKm: 17, durationMinutes: 30 } });
  expect(route.ok()).toBe(true);
  const routePairId = (await route.json()).route.id;
  const staff = 'Müller; "Anna"\nÖztürk und Schmidt';
  const remark = "LangerBemerkungstextOhneTrennzeichen".repeat(12) + "\nZweite Zeile";
  expect((await page.request.post("/api/trips", { data: { date: "2040-01-01", startTime: "08:00", endTime: "08:30", odometerStart: 1234567, routePairId, direction: "A_TO_B", accompanyingStaff: staff, remark } })).ok()).toBe(true);
  await page.request.patch("/api/settings/trip-columns", { data: { visibleColumns: TRIP_COLUMNS.map((column) => column.id) } });
  await page.goto("/trips?month=2040-01");
  const columnsButton = page.getByRole("button", { name: "Spalten", exact: true });
  const monthControls = page.locator("div").filter({ has: page.locator("#month-picker") }).filter({ has: columnsButton }).last();
  await expect(monthControls).toBeVisible();
  const tableTop = await page.locator("table").evaluate((table) => (table as HTMLElement).offsetTop);
  await columnsButton.click();
  await expect(columnsButton).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("checkbox")).toHaveCount(13);
  expect(await page.locator("table").evaluate((table) => (table as HTMLElement).offsetTop)).toBe(tableTop);
  await page.getByRole("checkbox").first().focus();
  await page.keyboard.press("Escape");
  await expect(columnsButton).toBeFocused();
  await expect(columnsButton).toHaveAttribute("aria-expanded", "false");
  await columnsButton.click();
  await page.getByRole("heading", { name: "Januar 2040" }).click();
  await expect(columnsButton).toHaveAttribute("aria-expanded", "false");
  for (const width of [1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(page.locator("table")).toBeVisible();
    await expect(page.locator("thead th")).toHaveText([...TRIP_COLUMNS.map((column) => column.headerInfo + column.headerTitle), "Übernommen"]);
    for (const column of TRIP_COLUMNS) {
      const header = page.locator(`thead th[data-column="${column.id}"]`);
      await expect(header.locator(".trip-column-info")).toHaveText(column.headerInfo);
      await expect(header.locator(".trip-column-title")).toHaveText(column.headerTitle);
    }
    expect(await page.locator(".trip-column-title").evaluateAll(elements => new Set(elements.map(element => element.getBoundingClientRect().top)).size)).toBe(1);
    await expect(page.getByTestId("desktop-trip").locator("td").first()).toHaveCSS("font-size", "14px");
    await expect(page.getByTestId("desktop-trip").locator("td")).toHaveCount(14);
    expect(await page.getByTestId("desktop-trip").locator("td").evaluateAll((cells) => new Set(cells.map((cell) => cell.getBoundingClientRect().top)).size)).toBe(1);
    expect(await page.locator("table").evaluate((table) => getComputedStyle(table.parentElement!).overflowX)).toBe("auto");
    await page.screenshot({ path: `test-results/columns-${width}.png`, fullPage: true });
    const overflowing = await page.locator("table").evaluate((table) => Array.from(table.querySelectorAll("th, td")).filter((cell) => cell.scrollWidth > cell.clientWidth + 1).map((cell) => ({ text: cell.textContent, scroll: cell.scrollWidth, client: cell.clientWidth, wrap: getComputedStyle(cell).overflowWrap, whitespace: getComputedStyle(cell).whiteSpace })));
    expect(overflowing, `${width}px`).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
  await page.getByRole("button", { name: "Als übernommen markieren", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Als nicht übernommen markieren" })).toHaveAttribute("aria-pressed", "true");
  await page.getByText("Spalten", { exact: true }).click();
  for (const id of ["distanceKm", "reimbursedKm", "unreimbursedKm", "potentialReimbursementCents", "remark"] as const) {
    const label = TRIP_COLUMNS.find((column) => column.id === id)!.label;
    await page.getByRole("checkbox", { name: label, exact: true }).uncheck();
    await expect(page.getByTestId("desktop-trip").getByText(label, { exact: true })).toHaveCount(0);
  }
  await page.reload();
  await expect(page.getByTestId("desktop-trip").locator('[data-column="remark"]')).toHaveCount(0);
  const second = await browser.newContext();
  const other = await second.newPage();
  await other.goto("http://127.0.0.1:3100/login");
  await other.getByLabel("Benutzername").fill("admin");
  await other.getByLabel("Passwort", { exact: true }).fill("admin");
  await other.getByRole("button", { name: "Anmelden" }).click();
  await expect(other.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await other.goto("http://127.0.0.1:3100/trips?month=2040-01");
  await expect(other.getByTestId("desktop-trip").locator('[data-column="remark"]')).toHaveCount(0);
  await second.close();
  await page.setViewportSize({ width: 375, height: 850 });
  await columnsButton.click();
  const dropdown = await page.locator("#trip-columns-dropdown").boundingBox();
  expect(dropdown!.x).toBeGreaterThanOrEqual(0);
  expect(dropdown!.x + dropdown!.width).toBeLessThanOrEqual(375);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("mobile-trip-card")).not.toContainText(remark);
  await expect(page.getByTestId("mobile-trip-card")).not.toContainText("mögliche Erstattung");
  await expect(page.getByTestId("mobile-trip-card")).toContainText(staff.replace("\n", " "));
  const csv = await page.request.get("/api/trips/export?from=2040-01-01&to=2040-01-01");
  expect(parseTripCsv(await csv.text())[0]).toMatchObject({ remark, accompanyingStaff: staff, reimbursedKm: 17, unreimbursedKm: 6 });
  expect((await page.request.patch("/api/settings/print-columns", { data: { visibleColumns: [] } })).status()).toBe(400);
  await page.request.patch("/api/settings/print-columns", { data: { visibleColumns: TRIP_COLUMNS.map((column) => column.id) } });
  await page.goto("/print?month=2040-01");
  await expect(page.getByTestId("print-table-wrap")).toContainText(remark);
  const printColumnsButton = page.getByRole("button", { name: "Spalten für PDF/Druck", exact: true });
  await printColumnsButton.click();
  await page.getByRole("checkbox", { name: "Bemerkungen", exact: true }).uncheck();
  await expect(page.getByTestId("print-table-wrap")).not.toContainText(remark);
  await expect(page.getByRole("checkbox", { name: "mögliche Erstattung", exact: true })).toBeEnabled();
  await page.getByRole("checkbox", { name: "mögliche Erstattung", exact: true }).uncheck();
  await expect(page.getByTestId("print-table-wrap")).not.toContainText("mögliche Erstattung");
  await page.reload();
  await expect(page.getByTestId("print-table-wrap")).not.toContainText(remark);
  expect((await (await page.request.get("/api/settings/trip-columns")).json()).visibleColumns).not.toContain("distanceKm");
  expect((await (await page.request.get("/api/settings/print-columns")).json()).visibleColumns).toContain("distanceKm");
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("columnheader", { name: "Bemerkungen" })).toHaveCount(0);
  await expect(page.getByText("mögliche Erstattung", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /übernommen/i })).toHaveCount(0);
  await expect(page.locator(".print-toolbar")).toBeHidden();
  await expect(page.getByRole("columnheader", { name: "Gefahrene KM", exact: true })).toBeVisible();
  for (const column of TRIP_COLUMNS.filter(column => !["remark", "potentialReimbursementCents"].includes(column.id))) {
    const header = page.locator(`.print-pages thead th[data-column="${column.id}"]`).first();
    await expect(header.locator(".trip-column-info")).toHaveText(column.headerInfo);
    await expect(header.locator(".trip-column-title")).toHaveText(column.headerTitle);
  }
  expect((await page.locator(".print-pages .print-document-header").first().boundingBox())!.height).toBeLessThan(60);
  expect((await page.locator(".print-pages .print-document-footer").first().boundingBox())!.height).toBeLessThan(24);
  await expect(page.getByRole("region", { name: "Gesamt im Monat" })).toHaveCount(0);
  expect(await page.locator(".print-pages thead th").evaluateAll(elements => elements.filter(element => element.scrollWidth > element.clientWidth + 1).map(element => element.textContent))).toEqual([]);
  await page.pdf({ path: "test-results/columns-selected.pdf", preferCSSPageSize: true });
  await page.emulateMedia({ media: "screen" });
  await page.goto("/trips?month=2040-01");
  await page.getByText("Spalten", { exact: true }).click();
  await page.getByRole("button", { name: "Alle anzeigen" }).click();
  await expect(page.getByTestId("desktop-trip").locator('[data-column="remark"]')).toBeVisible();
  // A reduced selection still uses a single table row and supports editing.
  await page.request.patch("/api/settings/trip-columns", { data: { visibleColumns: ["remark", "potentialReimbursementCents"] } });
  await page.reload();
  await expect(page.locator("thead th:not(:last-child)")).toHaveText(["Bemerkungen", "möglicheErstattung"]);
  await page.getByTestId("desktop-trip").locator("td").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Abbrechen", exact: true }).click();
  await page.request.patch("/api/settings/print-columns", { data: { visibleColumns: ["date"] } });
  await page.goto("/print?month=2040-01");
  await printColumnsButton.click();
  await expect(page.getByRole("checkbox", { name: "Datum", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Alle anzeigen" }).click();
  await expect(page.getByRole("columnheader", { name: "Bemerkungen", exact: true })).toBeVisible();
  await page.goto("/trips?month=2040-01");
  await expect(page.locator("thead th:not(:last-child)")).toHaveText(["Bemerkungen", "möglicheErstattung"]);
  // The last selected column cannot be unchecked.
  await page.request.patch("/api/settings/trip-columns", { data: { visibleColumns: ["date"] } });
  await page.reload();
  await page.getByText("Spalten", { exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Datum", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Alle anzeigen" }).click();
  await expect(page.getByTestId("desktop-trip").locator('[data-column="remark"]')).toBeVisible();
  // An individual entry taller than A4 continues without dropping its text.
  const longRemark = Array.from({ length: 120 }, (_, index) => `Zeile ${String(index + 1).padStart(3, "0")}\n`).join("").trim();
  expect((await page.request.post("/api/trips", { data: { date: "2041-01-01", startTime: "08:00", endTime: "08:30", odometerStart: 1234567, routePairId, direction: "A_TO_B", remark: longRemark } })).ok()).toBe(true);
  await page.goto("/print?month=2041-01");
  await expect(page.locator(".print-pages")).toHaveAttribute("data-ready", "true");
  expect(await page.locator(".print-pages .print-sheet").count()).toBeGreaterThan(1);
  expect((await page.locator('.print-pages tbody td[data-column="remark"]').allTextContents()).join("")).toBe(longRemark);
  await expect(page.locator(".print-pages tfoot")).toHaveCount(1);
  expect(await page.locator(".print-pages .print-page-content").evaluateAll(elements => elements.every(element => element.querySelector("table")!.getBoundingClientRect().bottom < element.querySelector("footer")!.getBoundingClientRect().top))).toBe(true);
  await printColumnsButton.click();
  await page.getByRole("checkbox", { name: "Bemerkungen", exact: true }).uncheck();
  await expect(page.locator(".print-pages .print-sheet")).toHaveCount(1);

});
