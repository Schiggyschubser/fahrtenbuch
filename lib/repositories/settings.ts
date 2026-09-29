import { decodeTripColumns, tripColumnsSettingsSchema, type TripColumnId } from "../trip-columns";
import { eq } from "drizzle-orm";
import { db, ensureDatabaseReady } from "../db";
import { appSettings } from "../db/schema";
import type { ReimbursementSettingsDto } from "../types";
import { vehicleSettingsSchema } from "../validation";

export async function getVehicleSettings() {
  ensureDatabaseReady();
  const [settings] = await db.select({ licensePlate: appSettings.licensePlate }).from(appSettings).where(eq(appSettings.id, 1));
  return { licensePlate: settings?.licensePlate ?? "" };
}

export async function updateVehicleSettings(licensePlate: string) {
  const input = vehicleSettingsSchema.parse({ licensePlate });
  ensureDatabaseReady();
  await db.update(appSettings).set({ ...input, updatedAt: new Date().toISOString() }).where(eq(appSettings.id, 1));
  return getVehicleSettings();
}

export async function getReimbursementSettings(): Promise<ReimbursementSettingsDto> {
  ensureDatabaseReady();
  const [settings] = await db.select({
    reimbursementRateCents: appSettings.reimbursementRateCents,
  }).from(appSettings).where(eq(appSettings.id, 1)).limit(1);
  if (!settings) throw new Error("Die Abrechnungseinstellungen konnten nicht geladen werden.");
  return settings;
}

export async function updateReimbursementSettings(reimbursementRateCents: number): Promise<ReimbursementSettingsDto> {
  ensureDatabaseReady();
  const [settings] = await db.update(appSettings).set({
    reimbursementRateCents,
    updatedAt: new Date().toISOString(),
  }).where(eq(appSettings.id, 1)).returning({
    reimbursementRateCents: appSettings.reimbursementRateCents,
  });
  if (!settings) throw new Error("Die Abrechnungseinstellungen konnten nicht gespeichert werden.");
  return settings;
}

export async function getTripColumnSettings() {
  ensureDatabaseReady();
  const [settings] = await db.select({ tripColumns: appSettings.tripColumns }).from(appSettings).where(eq(appSettings.id, 1));
  return { visibleColumns: decodeTripColumns(settings?.tripColumns) };
}
export async function getPrintColumnSettings() {
  ensureDatabaseReady();
  const [settings] = await db.select({ printColumns: appSettings.printColumns }).from(appSettings).where(eq(appSettings.id, 1));
  return { visibleColumns: decodeTripColumns(settings?.printColumns) };
}
export async function updatePrintColumnSettings(visibleColumns: TripColumnId[]) {
  const input = tripColumnsSettingsSchema.parse({ visibleColumns });
  ensureDatabaseReady();
  await db.update(appSettings).set({ printColumns: JSON.stringify(input.visibleColumns), updatedAt: new Date().toISOString() }).where(eq(appSettings.id, 1));
  return getPrintColumnSettings();
}
export async function updateTripColumnSettings(visibleColumns: TripColumnId[]) {
  const input = tripColumnsSettingsSchema.parse({ visibleColumns });
  ensureDatabaseReady();
  await db.update(appSettings).set({ tripColumns: JSON.stringify(input.visibleColumns), updatedAt: new Date().toISOString() }).where(eq(appSettings.id, 1));
  return getTripColumnSettings();
}
