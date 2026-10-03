import { expect, it } from "vitest";
import sharp from "sharp";
import { normalizeSignature } from "@/lib/signature-image";
import { claimTemplateSchema, emptyClaimTemplate } from "@/lib/claim-template";

const dataUrl = (data: Buffer) => `data:image/png;base64,${data.toString("base64")}`;

it("normalizes PNG signatures, limits dimensions and removes metadata", async () => {
  const input = await sharp({ create: { width: 1500, height: 400, channels: 4, background: "navy" } }).withMetadata().png().toBuffer();
  const result = await normalizeSignature(dataUrl(input));
  const metadata = await sharp(Buffer.from(result!.split(",")[1], "base64")).metadata();
  expect(metadata.format).toBe("png");
  expect(metadata.width).toBeLessThanOrEqual(1000);
  expect(metadata.height).toBeLessThanOrEqual(220);
  expect(metadata.exif).toBeUndefined();
  expect(metadata.icc).toBeUndefined();
});

it("rejects invalid images and images exceeding the pixel limit", async () => {
  await expect(normalizeSignature(dataUrl(Buffer.from("not a PNG")))).rejects.toThrow();
  await expect(normalizeSignature(dataUrl(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))).rejects.toThrow();
  await expect(normalizeSignature("https://example.com/signature.png")).rejects.toThrow();
  await expect(normalizeSignature("data:image/svg+xml;base64,PHN2Zy8+" )).rejects.toThrow();
  const large = await sharp({ create: { width: 1200, height: 1000, channels: 3, background: "white" } }).png().toBuffer();
  await expect(normalizeSignature(dataUrl(large))).rejects.toThrow();
});

it("accepts removal and existing templates without a signature", async () => {
  expect(await normalizeSignature(null)).toBeNull();
  const { fields, includeByDefault } = emptyClaimTemplate();
  expect(claimTemplateSchema.parse({ fields, includeByDefault }).signature).toBeNull();
});
