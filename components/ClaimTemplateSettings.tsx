"use client";

import { useState } from "react";
import { CLAIM_FIELDS, claimOutputDate, claimTemplateSchema, type ClaimTemplate } from "@/lib/claim-template";
import { ClaimPages } from "./ClaimPages";
import { SignatureEditor } from "./SignatureEditor";

export function ClaimTemplateSettings({ initialTemplate, onSaved }: { initialTemplate: ClaimTemplate; onSaved: (value: ClaimTemplate) => void }) {
  const [template, setTemplate] = useState(initialTemplate);
  const [saving, setSaving] = useState(false);
  const [signatureLoading, setSignatureLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const today = claimOutputDate();
  async function save() {
    if (signatureLoading || saving) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/settings/claim-template", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(template) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Vorlage konnte nicht gespeichert werden.");
      setTemplate(result); onSaved(result); setMessage("Die Antragsvorlage wurde gespeichert.");
    } catch (error) { setError(error instanceof Error ? error.message : "Speichern fehlgeschlagen."); }
    finally { setSaving(false); }
  }
  return <section className="rounded-[20px] border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6">
    <h2 className="text-lg font-extrabold">Reisekostenantrag</h2>
    <p className="mt-2 text-sm text-[var(--muted)]">Bearbeite die Angaben für das zweitseitige Originalformular. Beim PDF-Export kannst du den Antrag vor die Fahrtenliste setzen. Das Datum bei deiner Unterschrift ist automatisch der Tag der Ausgabe.</p>
    <form className="mt-5 space-y-5" onSubmit={event => { event.preventDefault(); void save(); }}>
      <fieldset disabled={saving} className="space-y-5">
        <label className="flex items-center gap-3"><input type="checkbox" checked={template.includeByDefault} onChange={e => setTemplate({ ...template, includeByDefault: e.target.checked })} />Antrag beim PDF-Export vorauswählen</label>
        <div className="grid gap-4 sm:grid-cols-2">
          {CLAIM_FIELDS.map(field => <label key={field.id} className="block text-sm font-semibold">{field.label}
            <input className="focus-ring mt-1 block w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[var(--ink)]" value={template.fields[field.id]} maxLength={field.max} onChange={e => setTemplate({ ...template, fields: { ...template.fields, [field.id]: e.target.value } })} />
          </label>)}
        </div>
        <p className="text-sm text-[var(--muted)]">Im Haushaltsjahr übernimmt {"{{jahr}}"} das Jahr des ausgewählten Fahrtenmonats. Das Ausgabedatum wird unabhängig davon stets aktuell eingesetzt. Beträge und behördliche Vermerke bleiben wie im Original zur weiteren Bearbeitung frei.</p>
        <SignatureEditor value={template.signature} disabled={saving} onBusy={setSignatureLoading} onChange={signature => setTemplate(current => ({ ...current, signature }))} />
        <button type="submit" disabled={signatureLoading} className="btn-primary focus-ring">{saving ? "Wird gespeichert …" : "Antragsvorlage speichern"}</button>
      </fieldset>
      {message ? <p role="status">{message}</p> : null}
      {error ? <p role="alert" className="text-[var(--danger)]">{error}</p> : null}
    </form>
    <details className="mt-6"><summary className="cursor-pointer font-bold">Vorschau der beiden Antragsseiten</summary>
      <div className="claim-settings-preview mt-4"><ClaimPages template={template} month={`${today.slice(-4)}-01`} outputDate={today} showSignature /></div>
    </details>
    <details className="mt-6 text-sm"><summary className="cursor-pointer font-bold">Gespeicherte Vorlage importieren</summary>
      <p className="my-3 text-[var(--muted)]">Eine zuvor vorbereitete Antragsvorlage als JSON laden, prüfen und anschließend speichern.</p>
      <input type="file" accept="application/json,.json" aria-label="Antragsvorlage importieren" disabled={saving || signatureLoading} onChange={async e => {
        const file = e.target.files?.[0]; if (!file) return;
        try { if (file.size > 400_000) throw new Error("Die Vorlagendatei ist zu groß."); setTemplate(claimTemplateSchema.parse(JSON.parse(await file.text()))); setError(""); setMessage("Vorlage geladen. Bitte prüfen und speichern."); }
        catch { setError("Die Datei ist keine gültige Antragsvorlage."); }
        e.target.value = "";
      }} />
    </details>
  </section>;
}
