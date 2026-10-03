import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { emptyClaimTemplate } from "../../lib/claim-template";

test("Unterschrift zeichnen, hochladen, speichern und optional im Antrag drucken", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/login");
  await page.getByLabel("Benutzername").fill("admin");
  await page.getByLabel("Passwort", { exact: true }).fill("admin");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  expect((await page.request.patch("/api/settings/claim-template", { data: emptyClaimTemplate() })).ok()).toBe(true);
  await page.goto("/settings?tab=claim");
  await page.getByText("Unterschrift zeichnen", { exact: true }).click();
  await page.getByRole("button", { name: "Zeichnung übernehmen" }).click();
  await expect(page.getByRole("region", { name: "Unterschrift verwalten" }).getByRole("alert")).toContainText("noch keine Unterschrift");
  const canvas = page.getByLabel("Zeichenfläche für die Unterschrift");
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  // Deliberately synthetic zigzag; no person's actual signature is used.
  await page.mouse.move(box.x + 25, box.y + 40);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(box.x + 25 + i * 25, box.y + (i % 2 ? 70 : 40), { steps: 3 });
  await page.mouse.up();
  await page.getByRole("button", { name: "Zeichnung übernehmen" }).click();
  await expect(page.getByRole("img", { name: "Vorschau deiner Unterschrift" })).toBeVisible();
  await page.getByLabel("Antrag beim PDF-Export vorauswählen", { exact: true }).check();
  await page.getByRole("button", { name: "Antragsvorlage speichern" }).click();
  await expect(page.getByRole("status")).toHaveText("Die Antragsvorlage wurde gespeichert.");
  await page.reload();
  await expect(page.getByRole("img", { name: "Vorschau deiner Unterschrift" })).toBeVisible();
  const saved = await (await page.request.get("/api/settings/claim-template")).json();
  expect((await page.request.patch("/api/settings/claim-template", { data: { ...saved, signature: "data:image/png;base64,YmFk" } })).status()).toBe(400);
  expect((await (await page.request.get("/api/settings/claim-template")).json()).signature).toBe(saved.signature);

  const { route } = await (await page.request.post("/api/routes", { data: { placeA: "Signatur Start", placeB: "Signatur Ziel", distanceKm: 8, reimbursedKm: 8, durationMinutes: 15 } })).json();
  expect((await page.request.post("/api/trips", { data: { date: "2025-10-15", startTime: "08:00", endTime: "08:15", routePairId: route.id, direction: "A_TO_B", odometerStart: 2000 } })).ok()).toBe(true);
  await page.goto("/print?month=2025-10");
  await expect(page.locator(".print-pages")).toHaveAttribute("data-ready", "true");
  await expect(page.getByTestId("claim-signature")).toHaveCount(0);
  await page.getByLabel("Unterschrift einfügen", { exact: true }).check();
  await expect(page.getByTestId("claim-signature")).toHaveCount(1);
  await page.pdf({ path: "test-results/claim-with-signature.pdf", preferCSSPageSize: true, printBackground: true });
  await page.getByLabel("Unterschrift einfügen", { exact: true }).uncheck();
  await expect(page.getByTestId("claim-signature")).toHaveCount(0);
  await page.getByLabel("Unterschrift einfügen", { exact: true }).check();
  await page.getByLabel("Antrag voranstellen", { exact: true }).uncheck();
  await expect(page.getByTestId("claim-signature")).toHaveCount(0);
  await expect(page.getByLabel("Unterschrift einfügen", { exact: true })).toBeDisabled();
  await page.getByLabel("Antrag voranstellen", { exact: true }).check();
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const toolbar = page.locator(".print-toolbar");
    expect(await toolbar.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/settings?tab=claim");
  // A JPEG image with a synthetic TEST mark exercises conversion and whitespace cropping.
  const jpeg = await sharp(Buffer.from('<svg width="600" height="200"><rect width="600" height="200" fill="white"/><text x="150" y="120" fill="navy" font-size="50">TEST</text></svg>')).jpeg().toBuffer();
  await page.getByLabel("Unterschrift als Bild hochladen").setInputFiles({ name: "test.jpg", mimeType: "image/jpeg", buffer: jpeg });
  await expect(page.getByText("Unterschrift wird eingelesen …")).toHaveCount(0);
  await page.getByRole("button", { name: "Antragsvorlage speichern" }).click();
  await expect(page.getByRole("status")).toHaveText("Die Antragsvorlage wurde gespeichert.");
  const uploaded = await (await page.request.get("/api/settings/claim-template")).json();
  expect(uploaded.signature).toMatch(/^data:image\/png;base64,/);
  expect(uploaded.signature).not.toBe(saved.signature);
  const metadata = await sharp(Buffer.from(uploaded.signature.split(",")[1], "base64")).metadata();
  expect(metadata.width).toBeLessThan(300);
  await page.getByLabel("Unterschrift als Bild hochladen").setInputFiles({ name: "bad.png", mimeType: "image/png", buffer: Buffer.from("bad") });
  await expect(page.getByRole("region", { name: "Unterschrift verwalten" }).getByRole("alert")).toContainText("konnte nicht gelesen");
  await page.getByRole("button", { name: "Unterschrift entfernen" }).click();
  await page.getByRole("button", { name: "Antragsvorlage speichern" }).click();
  await expect.poll(async () => (await (await page.request.get("/api/settings/claim-template")).json()).signature).toBeNull();
  await page.reload();
  await expect(page.getByText("Keine Unterschrift hinterlegt.")).toBeVisible();
  await page.request.patch("/api/settings/claim-template", { data: emptyClaimTemplate() });
});
