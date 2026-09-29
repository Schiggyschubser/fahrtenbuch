"use client";

import { useState, useTransition } from "react";

export function VehicleSettingsCard({ settings, onSaved }: {
  settings: { licensePlate: string }; onSaved: (settings: { licensePlate: string }) => void;
}) {
  const [licensePlate, setLicensePlate] = useState(settings.licensePlate);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pending, startTransition] = useTransition();
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setSuccess("");
    startTransition(async () => {
      try {
        const response = await fetch("/api/settings/vehicle", {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ licensePlate }),
        });
        const result = await response.json();
        if (!response.ok) { setError(result.error ?? "Das Kennzeichen konnte nicht gespeichert werden."); return; }
        onSaved(result); setLicensePlate(result.licensePlate); setSuccess("Das Kennzeichen wurde gespeichert.");
      } catch { setError("Das Kennzeichen konnte nicht gespeichert werden. Bitte versuche es erneut."); }
    });
  }
  return <section className="mb-5 rounded-[20px] border border-[var(--line)] bg-[var(--surface)] shadow-[0_7px_24px_rgba(15,23,42,.045)]">
    <header className="border-b border-[var(--line)] px-5 py-4 sm:px-6">
      <h2 className="text-lg font-extrabold">Fahrzeug</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">Dein amtliches KFZ-Kennzeichen erscheint im Druck und PDF unter dem Erstelldatum.</p>
    </header>
    <form onSubmit={submit} className="px-5 py-5 sm:px-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full max-w-sm"><label htmlFor="license-plate" className="label">Amtliches KFZ-Kennzeichen</label>
          <input id="license-plate" className="field uppercase" value={licensePlate} onChange={(event) => { setLicensePlate(event.target.value); setSuccess(""); }} required maxLength={20} placeholder="z. B. CO-AB 123" autoComplete="off" /></div>
        <button className="btn-primary" type="submit" disabled={pending}>{pending ? "Speichert …" : "Kennzeichen speichern"}</button>
      </div>
      {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
      {success ? <p role="status" className="mt-3 text-sm text-green-700">{success}</p> : null}
    </form>
  </section>;
}
