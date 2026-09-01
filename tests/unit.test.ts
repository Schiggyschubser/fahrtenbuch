import { describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { generate } from "otplib";
import { defaultDateForMonth, monthBounds } from "@/lib/dates";
import { hasDefaultCredentials, isDefaultCredentialInput } from "@/lib/default-credentials";
import { unreimbursedKm } from "@/lib/kilometers";
import { formatEuro, potentialReimbursementCents } from "@/lib/money";
import { pairKey, toRouteOptions } from "@/lib/repositories/routes";
import { parseTripCsv, serializeTripCsv } from "@/lib/trip-csv";
import {
  createBackupCodes,
  createTwoFactorSecret,
  decryptTwoFactorSecret,
  encryptTwoFactorSecret,
  normalizeBackupCode,
  unwrapChallengeSecret,
  verifyTotp,
  wrapChallengeSecret,
} from "@/lib/two-factor-crypto";
import { createTripSchema, reimbursementSettingsSchema, routePairSchema } from "@/lib/validation";

describe("Standard-Zugang", () => {
  it("erkennt ausschließlich die Kombination admin / admin", async () => {
    const defaultPasswordHash = await bcrypt.hash("admin", 4);
    const changedPasswordHash = await bcrypt.hash("geändert", 4);

    expect(isDefaultCredentialInput("admin", "admin")).toBe(true);
    expect(isDefaultCredentialInput("admin", "geändert")).toBe(false);
    await expect(hasDefaultCredentials("admin", defaultPasswordHash)).resolves.toBe(true);
    await expect(hasDefaultCredentials("admin", changedPasswordHash)).resolves.toBe(false);
    await expect(hasDefaultCredentials("anderer-admin", defaultPasswordHash)).resolves.toBe(false);
  });
});

describe("Zwei-Faktor-Authentifizierung", () => {
  it("verschlüsselt das TOTP-Geheimnis mit dem Benutzerpasswort", async () => {
    const envelope = await encryptTwoFactorSecret("TEST-SECRET", "sicheres-passwort");

    await expect(decryptTwoFactorSecret(envelope, "sicheres-passwort")).resolves.toBe("TEST-SECRET");
    await expect(decryptTwoFactorSecret(envelope, "falsches-passwort")).rejects.toThrow();
  });

  it("bindet Login-Challenges an ihren zufälligen Token", () => {
    const envelope = wrapChallengeSecret("TEST-SECRET", "challenge-token-a");

    expect(unwrapChallengeSecret(envelope, "challenge-token-a")).toBe("TEST-SECRET");
    expect(() => unwrapChallengeSecret(envelope, "challenge-token-b")).toThrow();
  });

  it("erzeugt eindeutige, normalisierbare Backup-Codes", () => {
    const codes = createBackupCodes();

    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    expect(codes.every((code) => /^[A-Z2-9]{4}(?:-[A-Z2-9]{4}){2}$/.test(code))).toBe(true);
    expect(normalizeBackupCode(codes[0].toLowerCase())).toHaveLength(12);
  });

  it("prüft aktuelle sechsstellige Authenticator-Codes", async () => {
    const secret = createTwoFactorSecret();
    const token = await generate({ secret });

    await expect(verifyTotp(secret, token)).resolves.toBe(true);
    await expect(verifyTotp(secret, "123")).resolves.toBe(false);
  });
});

describe("Fahrten-CSV", () => {
  it("exportiert UTF-8 mit BOM und lässt sich verlustfrei wieder importieren", () => {
    const rows = [{
      date: "2026-07-28",
      startTime: "08:00",
      endTime: "08:30",
      routeLabel: 'Büro; "Nord" → Kunde',
      odometerStart: 1000,
      odometerEnd: 1018,
    }];
    const csv = serializeTripCsv(rows);

    expect(csv.startsWith("\uFEFFDatum;Beginn;Ende;Reiseweg;KM Beginn;KM Ende\r\n")).toBe(true);
    expect(parseTripCsv(csv)).toEqual(rows);
  });

  it("meldet die logische Zeile bei ungültigen Importwerten", () => {
    const csv = [
      "Datum;Beginn;Ende;Reiseweg;KM Beginn;KM Ende",
      "2026-02-30;08:00;09:00;Büro → Kunde;100;120",
    ].join("\n");

    expect(() => parseTripCsv(csv)).toThrow(/Zeile 2: Ungültiges Datum/);
  });

  it("weist inkonsistente Kilometer und falsche Kopfzeilen zurück", () => {
    expect(() => parseTripCsv("Datum;Beginn\n2026-01-01;08:00")).toThrow(/Kopfzeile/);
    expect(() => parseTripCsv([
      "Datum;Beginn;Ende;Reiseweg;KM Beginn;KM Ende",
      "2026-01-01;08:00;09:00;Test;120;120",
    ].join("\n"))).toThrow(/KM Ende muss größer/);
  });
});

describe("Monatslogik", () => {
  it("berechnet die Grenzen über einen Jahreswechsel", () => {
    expect(monthBounds("2026-12")).toEqual({ start: "2026-12-01", endExclusive: "2027-01-01" });
  });

  it("liefert immer ein Datum im gewählten Monat", () => {
    expect(defaultDateForMonth("2026-02")).toMatch(/^2026-02-(0[1-9]|1\d|2[0-8])$/);
  });
});

describe("Reisewege", () => {
  it("behandelt Gegenrichtungen als dasselbe Paar", () => {
    expect(pairKey(" Berlin ", "Hamburg")).toBe(pairKey("hamburg", "berlin"));
  });

  it("erzeugt beide auswählbaren Richtungen", () => {
    const options = toRouteOptions([{ id: 1, placeA: "Berlin", placeB: "Potsdam", distanceKm: 35, reimbursedKm: 30, unreimbursedKm: 5, durationMinutes: 40 }]);
    expect(options).toHaveLength(2);
    expect(options.map((option) => option.label)).toEqual(["Berlin → Potsdam", "Potsdam → Berlin"]);
  });

  it("weist identische Start- und Zielorte zurück", () => {
    expect(routePairSchema.safeParse({ placeA: "Berlin", placeB: "berlin", distanceKm: 10, reimbursedKm: 8, durationMinutes: 20 }).success).toBe(false);
  });

  it("begrenzt nicht abgerechnete Kilometer auf null", () => {
    expect(unreimbursedKm(10, 8)).toBe(2);
    expect(unreimbursedKm(1, 2)).toBe(0);
  });
});

describe("Fahrtvalidierung", () => {
  it("weist Endzeiten vor der Beginnzeit zurück", () => {
    const result = createTripSchema.safeParse({
      date: "2026-07-06",
      startTime: "14:00",
      endTime: "13:00",
      odometerStart: 12000,
      routePairId: 1,
      direction: "A_TO_B",
    });
    expect(result.success).toBe(false);
  });

  it("erlaubt nur ganze Kilometerstände", () => {
    const result = createTripSchema.safeParse({
      date: "2026-07-06",
      startTime: "08:00",
      endTime: "09:00",
      odometerStart: 12000.5,
      routePairId: 1,
      direction: "A_TO_B",
    });
    expect(result.success).toBe(false);
  });
});

describe("Fahrtkostenerstattung", () => {
  it("berechnet den Betrag in Cent ohne Rundungsfehler", () => {
    expect(potentialReimbursementCents(17, 40)).toBe(680);
    expect(formatEuro(680)).toBe("6,80 €");
  });

  it("akzeptiert nur nichtnegative Cent-Beträge", () => {
    expect(reimbursementSettingsSchema.safeParse({ reimbursementRateCents: 40 }).success).toBe(true);
    expect(reimbursementSettingsSchema.safeParse({ reimbursementRateCents: -1 }).success).toBe(false);
    expect(reimbursementSettingsSchema.safeParse({ reimbursementRateCents: 40.5 }).success).toBe(false);
  });
});
