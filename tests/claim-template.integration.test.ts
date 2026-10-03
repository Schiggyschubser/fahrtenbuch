import { expect, it } from "vitest";
import { claimOutputDate, claimTemplateSchema, claimText, emptyClaimTemplate } from "@/lib/claim-template";
import { getClaimTemplate, updateClaimTemplate } from "@/lib/repositories/claim-template";
import { createBackup, restoreBackup } from "@/lib/backups";
import sharp from "sharp";

it("stores editable fields and restores them with the database backup", async () => {
  const template = emptyClaimTemplate();
  template.fields.recipient = "Erika Musterfrau";
  template.fields.iban = "DE00 TEST";
  template.includeByDefault = true;
  const image = await sharp({ create: { width: 200, height: 40, channels: 4, background: "navy" } }).png().toBuffer();
  template.signature = `data:image/png;base64,${image.toString("base64")}`;
  const stored = await updateClaimTemplate(template);
  expect(stored.signature).toMatch(/^data:image\/png;base64,/);
  expect(await getClaimTemplate()).toEqual(stored);
  const backup = await createBackup();
  await updateClaimTemplate(emptyClaimTemplate());
  await restoreBackup(backup.id);
  expect(await getClaimTemplate()).toEqual(stored);
  await expect(updateClaimTemplate({ ...stored, signature: "data:image/png;base64,YmFk" })).rejects.toThrow();
  expect(await getClaimTemplate()).toEqual(stored);
  await updateClaimTemplate({ ...stored, signature: null });
  expect((await getClaimTemplate()).signature).toBeNull();
});

it("validates field lengths and does not accept arbitrary fields or stored output dates", () => {
  const template = emptyClaimTemplate();
  expect(claimTemplateSchema.safeParse({ ...template, outputDate: "2026-08-01" }).success).toBe(false);
  expect(claimTemplateSchema.safeParse({ ...template, fields: { ...template.fields, recipient: "X".repeat(61) } }).success).toBe(false);
  expect(claimTemplateSchema.safeParse({ ...template, fields: { ...template.fields, bank: "A\nB" } }).success).toBe(false);
});

it("uses the Berlin output day, independently of the journey month and UTC day", () => {
  expect(claimOutputDate(new Date("2026-10-02T22:30:00Z"))).toBe("03.10.2026");
  expect(claimOutputDate(new Date("2026-01-02T23:30:00Z"))).toBe("03.01.2026");
  expect(claimText("{{jahr}}", "2025-08")).toBe("2025");
});
