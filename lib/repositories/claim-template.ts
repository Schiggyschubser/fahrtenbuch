import { eq } from "drizzle-orm";
import { db, ensureDatabaseReady } from "../db";
import { appSettings } from "../db/schema";
import { claimTemplateSchema, decodeClaimTemplate, type ClaimTemplate } from "../claim-template";
import { normalizeSignature } from "../signature-image";

export async function getClaimTemplate(): Promise<ClaimTemplate> {
  ensureDatabaseReady();
  const [row] = await db.select({ template: appSettings.claimTemplate }).from(appSettings).where(eq(appSettings.id, 1));
  return decodeClaimTemplate(row?.template);
}
export async function updateClaimTemplate(value: unknown): Promise<ClaimTemplate> {
  const template = claimTemplateSchema.parse(value);
  template.signature = await normalizeSignature(template.signature);
  ensureDatabaseReady();
  await db.update(appSettings).set({ claimTemplate: JSON.stringify(template), updatedAt: new Date().toISOString() }).where(eq(appSettings.id, 1));
  return template;
}
