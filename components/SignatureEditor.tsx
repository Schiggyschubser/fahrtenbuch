"use client";

import { useRef, useState, type PointerEvent } from "react";
import { MAX_SIGNATURE_DATA_LENGTH } from "@/lib/claim-template";

function signatureFromCanvas(canvas: HTMLCanvasElement): string {
  const context = canvas.getContext("2d")!;
  const { width, height } = canvas;
  const pixels = context.getImageData(0, 0, width, height).data;
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = (y * width + x) * 4;
    if (pixels[index + 3] > 30 && Math.min(pixels[index], pixels[index + 1], pixels[index + 2]) < 235) {
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  if (right < left) throw new Error("Es ist noch keine Unterschrift zu erkennen.");
  left = Math.max(0, left - 8); top = Math.max(0, top - 8);
  right = Math.min(width - 1, right + 8); bottom = Math.min(height - 1, bottom + 8);
  const cropWidth = right - left + 1, cropHeight = bottom - top + 1;
  const scale = Math.min(1, 1000 / cropWidth, 220 / cropHeight);
  const result = document.createElement("canvas");
  result.width = Math.max(1, Math.round(cropWidth * scale)); result.height = Math.max(1, Math.round(cropHeight * scale));
  result.getContext("2d")!.drawImage(canvas, left, top, cropWidth, cropHeight, 0, 0, result.width, result.height);
  const data = result.toDataURL("image/png");
  if (data.length > MAX_SIGNATURE_DATA_LENGTH) throw new Error("Bitte eine kleinere Bilddatei mit gut sichtbarer Unterschrift verwenden.");
  return data;
}

export function SignatureEditor({ value, onChange, onBusy, disabled }: { value: string | null; onChange: (value: string | null) => void; onBusy: (busy: boolean) => void; disabled: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const activePointer = useRef<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  function point(event: PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * event.currentTarget.width / rect.width, y: (event.clientY - rect.top) * event.currentTarget.height / rect.height };
  }
  async function upload(file: File) {
    setError(""); setLoading(true); onBusy(true);
    let url: string | null = null;
    try {
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 5_000_000) throw new Error("Bitte PNG, JPG oder WebP bis 5 MB auswählen.");
      url = URL.createObjectURL(file);
      const source = new window.Image();
      await new Promise<void>((resolve, reject) => { source.onload = () => resolve(); source.onerror = () => reject(new Error("Die Bilddatei konnte nicht gelesen werden.")); source.src = url!; });
      if (source.naturalWidth * source.naturalHeight > 8_000_000) throw new Error("Bitte ein Bild mit höchstens 8 Megapixeln auswählen.");
      const target = document.createElement("canvas");
      const scale = Math.min(1, 1600 / Math.max(source.naturalWidth, source.naturalHeight));
      target.width = Math.max(1, Math.round(source.naturalWidth * scale)); target.height = Math.max(1, Math.round(source.naturalHeight * scale));
      target.getContext("2d")!.drawImage(source, 0, 0, target.width, target.height);
      onChange(signatureFromCanvas(target));
    } catch (error) { setError(error instanceof Error ? error.message : "Die Unterschrift konnte nicht geladen werden."); }
    finally { if (url) URL.revokeObjectURL(url); setLoading(false); onBusy(false); }
  }
  return <section className="space-y-3 rounded-xl border border-[var(--line)] p-4" aria-label="Unterschrift verwalten">
    <h3 className="font-bold">Unterschrift</h3>
    <p className="text-sm text-[var(--muted)]">Bild hochladen oder mit Finger, Stift oder Maus zeichnen. Anschließend die Antragsvorlage speichern. In der Druckvorschau bestimmst du, ob die Unterschrift eingefügt wird.</p>
    <label className="block text-sm font-semibold">Unterschrift als Bild hochladen
      <input type="file" className="mt-2 block max-w-full text-sm" accept="image/png,image/jpeg,image/webp" disabled={disabled || loading} onChange={event => {
        const input = event.currentTarget; const file = input.files?.[0]; input.value = ""; if (file) void upload(file);
      }} />
    </label>
    {loading ? <p role="status" className="text-sm">Unterschrift wird eingelesen …</p> : null}
    <details><summary className="cursor-pointer text-sm font-semibold">Unterschrift zeichnen</summary>
      <canvas ref={canvas} width={1000} height={220} aria-label="Zeichenfläche für die Unterschrift" className="mt-3 block w-full max-w-[700px] touch-none rounded-lg border border-gray-400 bg-white"
        onPointerDown={event => {
          if (disabled || activePointer.current !== null || (event.pointerType === "mouse" && event.button !== 0)) return;
          event.preventDefault(); activePointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId);
          const p = point(event), context = event.currentTarget.getContext("2d")!;
          context.strokeStyle = "#172b4d"; context.fillStyle = "#172b4d"; context.lineWidth = 3; context.lineCap = "round"; context.lineJoin = "round";
          context.beginPath(); context.arc(p.x, p.y, 1.5, 0, Math.PI * 2); context.fill(); context.beginPath(); context.moveTo(p.x, p.y);
        }}
        onPointerMove={event => {
          if (disabled || activePointer.current !== event.pointerId) return;
          event.preventDefault(); const p = point(event), context = event.currentTarget.getContext("2d")!; context.lineTo(p.x, p.y); context.stroke();
        }}
        onPointerUp={event => { if (activePointer.current === event.pointerId) { activePointer.current = null; event.currentTarget.releasePointerCapture(event.pointerId); } }}
        onPointerCancel={() => { activePointer.current = null; }} onLostPointerCapture={() => { activePointer.current = null; }} />
      <div className="mt-3 flex flex-wrap gap-3">
        <button type="button" className="btn-secondary focus-ring" disabled={disabled || loading} onClick={() => {
          try { onChange(signatureFromCanvas(canvas.current!)); setError(""); } catch (error) { setError((error as Error).message); }
        }}>Zeichnung übernehmen</button>
        <button type="button" className="btn-secondary focus-ring" disabled={disabled || loading} onClick={() => { canvas.current?.getContext("2d")?.clearRect(0, 0, 1000, 220); setError(""); }}>Zeichenfläche leeren</button>
      </div>
    </details>
    {value ? <div className="flex flex-wrap items-center gap-4">
      <svg className="h-20 w-72 rounded border border-gray-300 bg-white" viewBox="0 0 300 80" role="img" aria-label="Vorschau deiner Unterschrift"><image href={value} x={8} y={6} width={284} height={68} preserveAspectRatio="xMidYMid meet" /></svg>
      <button type="button" className="btn-secondary focus-ring" disabled={disabled || loading} onClick={() => { onChange(null); setError(""); }}>Unterschrift entfernen</button>
    </div> : <p className="text-sm text-[var(--muted)]">Keine Unterschrift hinterlegt.</p>}
    {error ? <p role="alert" className="text-sm text-[var(--danger)]">{error}</p> : null}
  </section>;
}
