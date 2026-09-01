import { z } from "zod";

const datePattern = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const dateSchema = z.string().regex(datePattern, "Ungültiges Datum.").refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}, "Ungültiges Datum.");
export const tripExportRangeSchema = z.object({
  from: dateSchema,
  to: dateSchema,
}).refine((value) => value.to >= value.from, {
  message: "Das Bis-Datum muss am oder nach dem Von-Datum liegen.",
  path: ["to"],
});
export const directionSchema = z.enum(["A_TO_B", "B_TO_A"]);

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(80),
  password: z.string().min(1).max(200),
});

export const credentialsSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  username: z.string().trim().min(3, "Der Benutzername muss mindestens 3 Zeichen haben.").max(80),
  newPassword: z.string().min(8, "Das neue Passwort muss mindestens 8 Zeichen haben.").max(200),
});

const twoFactorCodeSchema = z.string().trim().min(6, "Der Sicherheitscode fehlt.").max(32, "Der Sicherheitscode ist ungültig.");

export const twoFactorChallengeSchema = z.object({
  challengeToken: z.string().min(32).max(200),
  code: twoFactorCodeSchema,
});

export const twoFactorPasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
});

export const twoFactorEnableSchema = twoFactorPasswordSchema.extend({
  secret: z.string().trim().min(16).max(200),
  code: twoFactorCodeSchema,
});

export const twoFactorProtectedActionSchema = twoFactorPasswordSchema.extend({
  code: twoFactorCodeSchema,
});

export const reimbursementSettingsSchema = z.object({
  reimbursementRateCents: z.number().int().nonnegative("Der Erstattungssatz darf nicht negativ sein.").max(10000),
});

export const restoreBackupSchema = z.object({
  backupId: z.string().min(1).max(240),
  currentPassword: z.string().min(1).max(200),
  confirmation: z.literal("WIEDERHERSTELLEN", { error: "Bitte die Bestätigung vollständig eingeben." }),
});

export const routePairSchema = z.object({
  placeA: z.string().trim().min(1, "Ort A fehlt.").max(120),
  placeB: z.string().trim().min(1, "Ort B fehlt.").max(120),
  distanceKm: z.number().int().positive("Die Entfernung muss größer als 0 sein.").max(100000),
  reimbursedKm: z.number().int().nonnegative("Die abgerechneten Kilometer dürfen nicht negativ sein.").max(100000),
  durationMinutes: z.number().int().positive("Die Fahrtdauer muss größer als 0 sein.").max(1439),
}).refine((value) => value.placeA.localeCompare(value.placeB, "de", { sensitivity: "base" }) !== 0, {
  message: "Start und Ziel müssen unterschiedlich sein.",
  path: ["placeB"],
});

const tripBaseSchema = z.object({
  date: z.string().regex(datePattern, "Ungültiges Datum."),
  startTime: z.string().regex(timePattern, "Ungültige Beginnzeit."),
  endTime: z.string().regex(timePattern, "Ungültige Endzeit."),
  odometerStart: z.number().int().nonnegative("Der Kilometerstand darf nicht negativ sein.").max(100000000),
}).refine((value) => value.endTime > value.startTime, {
  message: "Das Ende muss nach dem Beginn liegen.",
  path: ["endTime"],
});

export const createTripSchema = tripBaseSchema.and(z.object({
  routePairId: z.number().int().positive(),
  direction: directionSchema,
}));

export const updateTripSchema = tripBaseSchema.and(z.object({
  routePairId: z.number().int().positive().optional(),
  direction: directionSchema.optional(),
}).refine((value) => Boolean(value.routePairId) === Boolean(value.direction), {
  message: "Reiseweg und Richtung müssen gemeinsam geändert werden.",
}));

export function firstZodMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Die Eingaben sind ungültig.";
}
