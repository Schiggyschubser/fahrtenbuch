import { eq } from "drizzle-orm";
import { db, ensureDatabaseReady } from "../db";
import { appSettings } from "../db/schema";
import type { ReimbursementSettingsDto } from "../types";

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
