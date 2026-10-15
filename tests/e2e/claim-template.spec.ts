import { expect, test } from "@playwright/test";
import { THEMES } from "../../lib/themes";
import { claimOutputDate, emptyClaimTemplate } from "../../lib/claim-template";

function expectPdfPages(pdf: Buffer, count: number, orientation: "portrait" | "landscape") {
  const objects = Array.from(pdf.toString("latin1").matchAll(/\d+ 0 obj\b([\s\S]*?)endobj/g), match => match[1]);
  const pages = objects.filter(object => /\/Type\s*\/Page\b/.test(object));
  expect(pages).toHaveLength(count);
  for (const page of pages) {
    const box = page.match(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/);
    expect(box).not.toBeNull();
    const width = Number(box![3]) - Number(box![1]);
    const height = Number(box![4]) - Number(box![2]);
    expect(width).toBeCloseTo(orientation === "portrait" ? 595.28 : 841.89, 0);
    expect(height).toBeCloseTo(orientation === "portrait" ? 841.89 : 595.28, 0);
  }
}

test("Zeitraum bleibt lesbar; Antrag und Fahrtentabellen werden getrennt gedruckt", async ({ page }) => {
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
  await page.getByLabel("Antrag in der Druckansicht vorauswählen", { exact: true }).check();
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
  expect((await page.request.post("/api/trips", { data: { date: "2025-08-15", startTime: "08:00", endTime: "08:25", routePairId: route.id, direction: "A_TO_B", odometerStart: 900 } })).ok()).toBe(true);
  await page.goto("/print?month=2025-08");
  await expect(page.locator(".print-pages")).toHaveAttribute("data-ready", "true");
  const output = page.getByLabel("Ausgabe für PDF und Druck", { exact: true });
  await expect(output).toHaveValue("claim");
  await expect(page.locator(".claim-page-frame")).toHaveCount(2);
  await expect(page.locator(".print-pages .print-page-frame")).toHaveCount(0);
  await expect(page.locator(".print-toolbar")).toContainText("an der langen Kante");
  await expect(page.locator(".claim-page-frame").first()).toContainText(claimOutputDate());
  await expect(page.locator(".claim-page-frame").first()).toContainText("2025");
  // Browser PDF export uses the same document as Ctrl+P, without toolbar buttons.
  expectPdfPages(await page.pdf({ path: "test-results/claim-only.pdf", preferCSSPageSize: true, printBackground: true }), 2, "portrait");
  await page.screenshot({ path: "test-results/claim-print-preview.png", fullPage: true });
  await output.selectOption("trips");
  await expect(page.locator(".claim-page-frame")).toHaveCount(0);
  await expect(page.locator(".print-toolbar")).toContainText("an der kurzen Kante");
  await expect(page.locator(".print-document-footer").last()).toContainText("Seite 1 von 1");
  expectPdfPages(await page.pdf({ path: "test-results/trips-only.pdf", preferCSSPageSize: true, printBackground: true }), 1, "landscape");
  await page.screenshot({ path: "test-results/trips-print-preview.png", fullPage: true });
  // The explicit print button opens the dialog for the currently selected part.
  await page.evaluate(() => { window.print = () => { document.documentElement.dataset.printCalled = "true"; window.dispatchEvent(new Event("beforeprint")); }; });
  await page.getByRole("button", { name: "Fahrtentabellen drucken / PDF", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-print-called", "true");
  await output.selectOption("claim");
  await page.evaluate(() => { delete document.documentElement.dataset.printCalled; });
  await page.getByRole("button", { name: "Antrag drucken / PDF", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-print-called", "true");
  const remark = Array.from({ length: 120 }, (_, index) => `Zeile ${index + 1}`).join("\n");
  expect((await page.request.post("/api/trips", { data: { date: "2025-09-15", startTime: "08:00", endTime: "08:25", routePairId: route.id, direction: "A_TO_B", odometerStart: 912, remark } })).ok()).toBe(true);
  await page.goto("/print?month=2025-09");
  await expect(page.locator(".print-pages")).toHaveAttribute("data-ready", "true");
  await output.selectOption("trips");
  expect(await page.locator(".print-page-frame").count()).toBeGreaterThan(1);
  await expect(page.locator(".claim-page-frame")).toHaveCount(0);
  expect((await page.locator('.print-pages tbody td[data-column="remark"]').allTextContents()).join("")).toBe(remark);
  const tripPageCount = await page.locator(".print-page-frame").count();
  await expect(page.locator(".print-pages .print-document-footer").first()).toContainText(`Seite 1 von ${tripPageCount}`);
  await expect(page.locator(".print-pages .print-document-footer").last()).toContainText(`Seite ${tripPageCount} von ${tripPageCount}`);
  expectPdfPages(await page.pdf({ path: "test-results/trips-multiple-pages.pdf", preferCSSPageSize: true, printBackground: true }), tripPageCount, "landscape");
  await output.selectOption("claim");
  expectPdfPages(await page.pdf({ path: "test-results/claim-after-multiple-trips.pdf", preferCSSPageSize: true, printBackground: true }), 2, "portrait");
  await page.clock.install({ time: new Date("2026-10-03T22:30:00Z") });
  await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
  await expect(page.locator(".claim-page-frame").first()).toContainText("04.10.2026");
  await page.request.patch("/api/settings/claim-template", { data: emptyClaimTemplate() });
});
