import { expect, test } from "@playwright/test";
import { THEMES } from "../../lib/themes";
import { claimOutputDate, emptyClaimTemplate } from "../../lib/claim-template";

test("Zeitraum bleibt in allen Themes lesbar; Antrag ist editierbar und optional vor den Fahrten", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/login");
  expect((await page.request.get("/api/settings/claim-template")).status()).toBe(401);
  expect((await page.request.patch("/api/settings/claim-template", { data: emptyClaimTemplate() })).status()).toBe(401);
  await page.getByLabel("Benutzername").fill("admin");
  await page.getByLabel("Passwort", { exact: true }).fill("admin");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  const period = page.getByLabel("Zeitraum", { exact: true });
  for (const theme of THEMES) {
    await page.evaluate(id => document.documentElement.dataset.theme = id, theme.id);
    await expect(period).toBeVisible();
    const contrast = await period.evaluate(element => {
      const style = getComputedStyle(element);
      const luminance = (color: string) => {
        const rgb = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(c => {
          const value = c / 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
        });
        return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
      };
      const a = luminance(style.color), b = luminance(style.backgroundColor);
      return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    });
    expect(contrast, theme.id).toBeGreaterThanOrEqual(4.5);
    expect((await period.boundingBox())!.width).toBeGreaterThanOrEqual(112);
  }
  await page.evaluate(() => localStorage.setItem("fahrtenbuch-theme", "night-drive"));
  await page.reload();
  await period.selectOption("all");
  await expect(page.getByRole("heading", { name: "Gesamter Zeitraum", exact: true }).first()).toBeVisible();
  await page.screenshot({ path: "test-results/claim-period-night.png", fullPage: true });
  expect((await page.request.patch("/api/settings/claim-template", { data: { ...emptyClaimTemplate(), fields: {} } })).status()).toBe(400);
  await page.goto("/settings?tab=claim");
  await page.getByLabel("Empfänger (Name und Amtsbezeichnung)", { exact: true }).fill("Erika Musterfrau");
  await page.getByLabel("Wohnort", { exact: true }).fill("Musterstadt");
  await page.getByLabel("Dienststelle", { exact: true }).fill("Musterbehörde");
  await page.getByLabel("Ort bei der Unterschrift", { exact: true }).fill("Coburg");
  await page.getByLabel("Antrag beim PDF-Export vorauswählen", { exact: true }).check();
  await page.getByRole("button", { name: "Antragsvorlage speichern" }).click();
  await expect(page.getByRole("status")).toHaveText("Die Antragsvorlage wurde gespeichert.");
  await page.getByRole("tab", { name: "Darstellung", exact: true }).click();
  await page.getByRole("tab", { name: "Antrag", exact: true }).click();
  await expect(page.getByLabel("Empfänger (Name und Amtsbezeichnung)", { exact: true })).toHaveValue("Erika Musterfrau");
  await page.reload();
  await expect(page.getByLabel("Empfänger (Name und Amtsbezeichnung)", { exact: true })).toHaveValue("Erika Musterfrau");
  await page.getByText("Vorschau der beiden Antragsseiten", { exact: true }).click();
  await page.screenshot({ path: "test-results/claim-settings.png", fullPage: true });
  // Known export month; the signature date must be today, not this month.
  const { route } = await (await page.request.post("/api/routes", { data: { placeA: "Antrag Start", placeB: "Antrag Ziel", distanceKm: 12, reimbursedKm: 12, durationMinutes: 25 } })).json();
  expect((await page.request.post("/api/trips", { data: { date: "2025-08-15", startTime: "08:00", endTime: "08:25", routePairId: route.id, direction: "A_TO_B", odometerStart: 1000 } })).ok()).toBe(true);
  await page.goto("/print?month=2025-08");
  await expect(page.locator(".print-pages")).toHaveAttribute("data-ready", "true");
  await expect(page.locator(".claim-page-frame")).toHaveCount(2);
  await expect(page.locator(".claim-page-frame").first()).toContainText(claimOutputDate());
  await expect(page.locator(".claim-page-frame").first()).toContainText("2025");
  await expect(page.locator(".print-document-footer").last()).toContainText("Seite 3 von 3");
  await page.pdf({ path: "test-results/claim-with-trips.pdf", preferCSSPageSize: true, printBackground: true });
  await page.getByLabel("Antrag voranstellen", { exact: true }).uncheck();
  await expect(page.locator(".claim-page-frame")).toHaveCount(0);
  await expect(page.locator(".print-document-footer").last()).toContainText("Seite 1 von 1");
  await page.pdf({ path: "test-results/trips-without-claim.pdf", preferCSSPageSize: true, printBackground: true });
  await page.getByLabel("Antrag voranstellen", { exact: true }).check();
  const remark = Array.from({ length: 120 }, (_, index) => `Zeile ${index + 1}`).join("\n");
  expect((await page.request.post("/api/trips", { data: { date: "2025-09-15", startTime: "08:00", endTime: "08:25", routePairId: route.id, direction: "A_TO_B", odometerStart: 1012, remark } })).ok()).toBe(true);
  await page.goto("/print?month=2025-09");
  await expect(page.locator(".print-pages")).toHaveAttribute("data-ready", "true");
  expect(await page.locator(".print-page-frame").count()).toBeGreaterThan(1);
  expect((await page.locator('.print-pages tbody td[data-column="remark"]').allTextContents()).join("")).toBe(remark);
  await page.pdf({ path: "test-results/claim-with-multiple-trip-pages.pdf", preferCSSPageSize: true, printBackground: true });
  await page.clock.install({ time: new Date("2026-10-03T22:30:00Z") });
  await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
  await expect(page.locator(".claim-page-frame").first()).toContainText("04.10.2026");
  await page.request.patch("/api/settings/claim-template", { data: emptyClaimTemplate() });
});
