import { expect, test } from "@playwright/test";
import { generate } from "otplib";
import packageJson from "../../package.json";

const changelogButtonName = `Version ${packageJson.version} – Changelog öffnen`;

test("Login, Reiseweg und Fahrt lassen sich vollständig verwalten", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/login");
  const unauthorizedDashboard = await page.request.get("/api/dashboard");
  expect(unauthorizedDashboard.status()).toBe(401);
  await page.screenshot({ path: "test-results/login.png", fullPage: true });
  await page.getByLabel("Benutzername").fill("admin");
  await page.getByLabel("Passwort", { exact: true }).fill("admin");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("© Schudi, based on CelduinX", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: changelogButtonName }).click();
  await expect(page.getByRole("heading", { name: "Changelog" })).toBeVisible();
  await expect(page.getByText("Öffentliche Version 1.0.0", { exact: true })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Schließen", exact: true }).last().click();

  const fallbackDashboard = await page.request.get("/api/dashboard?year=unbekannt");
  expect(fallbackDashboard.ok()).toBe(true);
  expect((await fallbackDashboard.json()).selectedPeriod).toMatch(/^20\d{2}$/);

  await page.getByRole("link", { name: "Einstellungen", exact: true }).click();
  await page.getByRole("tab", { name: "Abrechnung" }).click();
  await expect(page.getByLabel("Erstattung pro abrechenbarem Kilometer")).toHaveValue("0,40");
  await page.getByLabel("Erstattung pro abrechenbarem Kilometer").fill("0,50");
  await page.getByRole("button", { name: "Erstattungssatz speichern" }).click();
  await expect(page.getByText("Der Erstattungssatz wurde gespeichert und gilt für neu angelegte Fahrten.")).toBeVisible();
  await page.getByRole("tab", { name: "Zugang" }).click();
  await expect(page.getByRole("heading", { name: "Benutzername & Passwort" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Zwei-Faktor-Authentifizierung" })).toBeVisible();
  await page.locator("#two-factor-current-password").fill("admin");
  await page.getByRole("button", { name: "2FA einrichten" }).click();
  await expect(page.getByAltText("QR-Code für die Authenticator-App")).toBeVisible();
  await page.screenshot({ path: "test-results/settings-access.png", fullPage: true });
  const twoFactorSecret = (await page.locator("details code").textContent())!;
  await page.getByLabel("Code aus der Authenticator-App").fill(await generate({ secret: twoFactorSecret }));
  await page.getByRole("button", { name: "2FA aktivieren" }).click();
  await expect(page.getByText("Backup-Codes jetzt sichern")).toBeVisible();
  const backupCode = (await page.locator("code").filter({ hasText: /^[A-Z2-9]{4}(?:-[A-Z2-9]{4}){2}$/ }).first().textContent())!;
  await page.getByRole("button", { name: "Abmelden", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Benutzername").fill("admin");
  await page.getByLabel("Passwort", { exact: true }).fill("admin");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByText("Zweiter Faktor erforderlich")).toBeVisible();
  await page.getByLabel("Bestätigungscode").fill(backupCode);
  await page.getByRole("button", { name: "Anmeldung abschließen" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.getByRole("link", { name: "Einstellungen", exact: true }).click();
  await page.getByRole("tab", { name: "Zugang" }).click();
  await page.getByRole("button", { name: "2FA deaktivieren" }).click();
  await page.locator("#two-factor-action-password").fill("admin");
  await page.locator("#two-factor-action-code").fill(await generate({ secret: twoFactorSecret }));
  await page.getByRole("button", { name: "2FA deaktivieren" }).click();
  await expect(page.getByText("Die Zwei-Faktor-Authentifizierung wurde deaktiviert.")).toBeVisible();
  await page.getByRole("tab", { name: "Reisewege" }).click();
  await page.getByRole("button", { name: /Reiseweg anlegen/ }).click();
  await expect(page.getByRole("dialog").getByRole("button", { name: /^Info zu/ })).toHaveCount(6);
  await page.getByRole("button", { name: "Info zu KM gesamt" }).hover();
  await expect(page.getByRole("tooltip").filter({ hasText: "Gesamte gefahrene Strecke für eine Richtung." })).toBeVisible();
  await page.screenshot({ path: "test-results/route-modal.png", fullPage: true });
  await page.getByRole("textbox", { name: "Ort A", exact: true }).fill("Büro");
  await page.getByRole("textbox", { name: "Ort B", exact: true }).fill("Kunde");
  await page.getByLabel("KM gesamt", { exact: true }).fill("18");
  await page.getByLabel("KM abrechenbar", { exact: true }).fill("14");
  await expect(page.getByLabel("KM nicht abrechenbar", { exact: true })).toHaveValue("4 km");
  await page.getByLabel("Fahrtdauer in Minuten", { exact: true }).fill("30");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.getByText("Büro", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await page.getByRole("link", { name: "Fahrt hinzufügen", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Neue Fahrt" })).toBeVisible();
  await page.getByRole("button", { name: "Abbrechen", exact: true }).click();

  await page.getByRole("link", { name: "Fahrten", exact: true }).click();
  await expect(page.getByText("Monatsübersicht", { exact: true })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: /Neue Fahrt/ }).click();
  await page.getByRole("button", { name: "Beginn-Auswahl öffnen" }).click();
  const dialogOverflow = await page.getByRole("dialog").evaluate((dialog) => ({
    scrollHeight: dialog.scrollHeight,
    clientHeight: dialog.clientHeight,
  }));
  expect(dialogOverflow.scrollHeight).toBeLessThanOrEqual(dialogOverflow.clientHeight + 1);
  await expect(page.getByRole("listbox", { name: "Beginn: Stunde" }).getByRole("option")).toHaveCount(13);
  await expect(page.getByRole("option", { name: "06", exact: true })).toBeVisible();
  await expect(page.getByRole("option", { name: "18", exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/time-picker.png", fullPage: true });
  await page.getByRole("option", { name: "08", exact: true }).click();
  await expect(page.getByRole("listbox", { name: "Beginn: Minute" }).getByRole("option")).toHaveCount(12);
  await expect(page.getByRole("option", { name: "05", exact: true })).toBeVisible();
  await expect(page.getByRole("option", { name: "55", exact: true })).toBeVisible();
  await page.getByRole("option", { name: "00", exact: true }).click();
  await expect(page.getByLabel("Beginn", { exact: true })).toHaveValue("08:00");
  await page.getByRole("combobox", { name: "Reiseweg" }).fill("Büro → Kunde");
  await page.getByRole("option", { name: /Büro.*Kunde/ }).click();
  await expect(page.getByLabel("Ende (automatisch)")).toHaveValue("08:30");
  await page.getByLabel("KM Beginn").fill("1000");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.getByRole("cell", { name: "1.018" })).toBeVisible();
  await page.getByRole("button", { name: "Als übernommen markieren" }).click();
  await expect(page.getByRole("button", { name: "Als nicht übernommen markieren" })).toBeVisible();
  await expect(page.getByText("18 km").first()).toBeVisible();
  await expect(page.locator("tbody").getByRole("cell", { name: "14 km", exact: true })).toBeVisible();
  await expect(page.locator("tbody").getByRole("cell", { name: "4 km", exact: true })).toBeVisible();
  await expect(page.locator("tbody").getByText("7,00 €", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/dashboard.png", fullPage: true });

  await page.getByRole("cell", { name: "1.018" }).click();
  await page.getByLabel("Ende", { exact: true }).fill("09:30");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.getByRole("cell", { name: "09:30", exact: true })).toBeVisible();

  await page.goto("/print?month=2026-07");
  await expect(page.getByRole("columnheader", { name: "KM abrechenbar", exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "KM nicht abrechenbar", exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Mögl. Erstattung", exact: true })).toBeVisible();
  await expect(page.getByText("4 km", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("7,00 €", { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: "test-results/print.png", fullPage: true });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("18 km").first()).toBeVisible();
  await page.getByLabel("Zeitraum").selectOption("all");
  await expect(page).toHaveURL(/year=all/);
  await expect(page.getByRole("heading", { name: "Letzte Fahrten" })).toHaveCount(0);

  await page.getByRole("link", { name: "Einstellungen", exact: true }).click();
  await page.getByRole("tab", { name: "Import / Export" }).click();
  await expect(page.getByRole("heading", { name: "Fahrten exportieren" })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV exportieren" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^fahrtenbuch-\d{4}-\d{2}-\d{2}-bis-\d{4}-\d{2}-\d{2}\.csv$/);
  const fullDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Alles exportieren" }).click();
  expect((await fullDownloadPromise).suggestedFilename()).toBe("fahrtenbuch-gesamt.csv");

  const importCsv = [
    "\uFEFFDatum;Beginn;Ende;Reiseweg;KM Beginn;KM Ende",
    "2025-01-15;07:15;08:00;Freier CSV-Reiseweg;500;512",
  ].join("\r\n");
  const csvFile = { name: "fahrten-import.csv", mimeType: "text/csv", buffer: Buffer.from(importCsv, "utf8") };
  await page.locator("#trip-csv-file").setInputFiles(csvFile);
  await page.getByRole("button", { name: "CSV importieren" }).click();
  await expect(page.getByText("1 Fahrten importiert, 0 Dubletten übersprungen.")).toBeVisible();

  await page.locator("#trip-csv-file").setInputFiles([]);
  await page.locator("#trip-csv-file").setInputFiles(csvFile);
  await page.getByRole("button", { name: "CSV importieren" }).click();
  await expect(page.getByText("Keine neue Fahrt importiert; 1 Dubletten wurden übersprungen.")).toBeVisible();

  await page.goto("/trips?month=2025-01");
  await expect(page.getByRole("cell", { name: "Freier CSV-Reiseweg", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "512", exact: true })).toBeVisible();
});

test("Dashboard bleibt auf Smartphone, Tablet und Desktop bedienbar", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Benutzername").fill("admin");
  await page.getByLabel("Passwort", { exact: true }).fill("admin");
  await page.getByRole("button", { name: "Anmelden" }).click();

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1600, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByLabel("Zeitraum")).toBeVisible();
    await expect(page.getByText("© Schudi, based on CelduinX", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: changelogButtonName })).toBeVisible();
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      offenders: Array.from(document.querySelectorAll("body *")).flatMap((element) => {
        const rect = element.getBoundingClientRect();
        return rect.right > document.documentElement.clientWidth + 1 || rect.left < -1
          ? [`${element.tagName}.${element.className}`]
          : [];
      }).slice(0, 8),
    }));
    expect(overflow.scrollWidth, `${viewport.width}px: ${overflow.offenders.join(" | ")}`).toBeLessThanOrEqual(overflow.clientWidth);
  }
});
