import { z } from "zod";

export const CLAIM_FIELDS = [
  { id: "recipient", label: "Empfänger (Name und Amtsbezeichnung)", max: 60 },
  { id: "residence", label: "Wohnort", max: 45 },
  { id: "office", label: "Dienststelle", max: 45 },
  { id: "approvedAt", label: "Dienstreise genehmigt am", max: 15 },
  { id: "approver", label: "Genehmigt durch", max: 45 },
  { id: "approvalAuthority", label: "DR-Genehmigung des", max: 22 },
  { id: "iban", label: "IBAN", max: 42 },
  { id: "bic", label: "BIC", max: 11 },
  { id: "bank", label: "Bank", max: 45 },
  { id: "signaturePlace", label: "Ort bei der Unterschrift", max: 35 },
  { id: "fiscalYear", label: "Haushaltsjahr", max: 10 },
  { id: "authorityNumber", label: "Behördennummer", max: 12 },
  { id: "documentType", label: "Satzart (SA)", max: 2 },
  { id: "bookingKey", label: "Buchungsschlüssel", max: 3 },
  { id: "advance", label: "Erhaltener Abschlag / Vorschuss in Euro", max: 9 },
  { id: "notes", label: "Zusatz auf Seite 2 (optional)", max: 100 },
] as const;
export type ClaimFieldId = typeof CLAIM_FIELDS[number]["id"];
export const MAX_SIGNATURE_DATA_LENGTH = 350_000;
export const signatureSchema = z.string().max(MAX_SIGNATURE_DATA_LENGTH, "Die Unterschrift ist zu groß.")
  .regex(/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/, "Bitte eine gültige Unterschrift als PNG verwenden.").nullable();
export type ClaimTemplate = { includeByDefault: boolean; fields: Record<ClaimFieldId, string>; signature: string | null };
const fieldSchema = z.object(Object.fromEntries(CLAIM_FIELDS.map(field => [field.id,
  z.string().trim().max(field.max, `${field.label}: höchstens ${field.max} Zeichen.`).refine(value => !/[\r\n\u0000-\u001f]/.test(value), "Bitte einzeiligen Text eingeben."),
])) as unknown as Record<ClaimFieldId, z.ZodType<string>>).strict();
export const claimTemplateSchema = z.object({ includeByDefault: z.boolean(), fields: fieldSchema, signature: signatureSchema.default(null) }).strict();
export function emptyClaimTemplate(): ClaimTemplate {
  return { includeByDefault: false, signature: null, fields: { ...Object.fromEntries(CLAIM_FIELDS.map(field => [field.id, ""])),
    fiscalYear: "{{jahr}}", documentType: "1", authorityNumber: "47300000", bookingKey: "110",
  } as Record<ClaimFieldId, string> };
}
export function decodeClaimTemplate(json: string | null | undefined): ClaimTemplate {
  if (!json) return emptyClaimTemplate();
  return claimTemplateSchema.parse(JSON.parse(json));
}
export function claimOutputDate(now = new Date()): string {
  return new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" }).format(now);
}
export function claimText(value: string, month: string): string {
  return value.replaceAll("{{jahr}}", month.slice(0, 4));
}
