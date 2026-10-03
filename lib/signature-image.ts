import sharp from "sharp";
import { MAX_SIGNATURE_DATA_LENGTH, signatureSchema } from "./claim-template";

export async function normalizeSignature(value: string | null): Promise<string | null> {
  if (value === null) return null;
  signatureSchema.parse(value);
  const bytes = Buffer.from(value.slice("data:image/png;base64,".length), "base64");
  if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    throw new Error("Die Unterschrift ist keine gültige PNG-Datei.");
  }
  try {
    const source = sharp(bytes, { limitInputPixels: 1_000_000, failOn: "warning" });
    const metadata = await source.metadata();
    if (metadata.format !== "png" || (metadata.pages ?? 1) !== 1) throw new Error("Unsupported image");
    const normalized = await source.resize({ width: 1000, height: 220, fit: "inside", withoutEnlargement: true }).png().toBuffer();
    const result = `data:image/png;base64,${normalized.toString("base64")}`;
    if (result.length > MAX_SIGNATURE_DATA_LENGTH) throw new Error("Image too large");
    return result;
  } catch {
    throw new Error("Die Unterschrift konnte nicht gelesen werden. Bitte erneut hochladen oder zeichnen.");
  }
}
