"use client";

import { useState } from "react";
import type { RemarkSettingsDto } from "@/lib/types";

export function RemarkSettingsCard({ settings, onSaved }: { settings: RemarkSettingsDto; onSaved: (settings: RemarkSettingsDto) => void }) {
  const [templates, setTemplates] = useState<Array<{ id?: number; text: string }>>(settings.templates);
  const [defaultIndex, setDefaultIndex] = useState<number | null>(() => {
    const index = settings.templates.findIndex((template) => template.id === settings.defaultTemplateId);
    return index < 0 ? null : index;
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setPending(true); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/settings/remarks", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templates, defaultTemplateIndex: defaultIndex }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Bemerkungen konnten nicht gespeichert werden.");
      setTemplates(result.templates);
      const index = (result as RemarkSettingsDto).templates.findIndex((template) => template.id === result.defaultTemplateId);
      setDefaultIndex(index < 0 ? null : index);
      onSaved(result); setSuccess("Bemerkungsvorlagen gespeichert.");
    } catch (error) { setError(error instanceof Error ? error.message : "Speichern fehlgeschlagen."); }
    finally { setPending(false); }
  }

  function remove(index: number) {
    setTemplates((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setDefaultIndex((current) => current === index ? null : current !== null && current > index ? current - 1 : current);
    setSuccess("");
  }

  return <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
    <div className="border-b border-[var(--line)] px-5 py-5 sm:px-6">
      <h2 className="text-lg font-extrabold">Bemerkungsvorlagen</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">Speichere häufige Texte. Der Standard wird bei neuen Fahrten vorausgefüllt; bestehende Fahrten behalten ihren Text.</p>
    </div>
    <form onSubmit={save} className="space-y-5 px-5 py-5 sm:px-6">
      <fieldset disabled={pending} className="space-y-5">
        {templates.map((template, index) => <div key={index} className="space-y-2 rounded-xl border border-[var(--line)] p-4">
          <label className="label" htmlFor={`remark-template-${index}`}>Vorlage {index + 1}</label>
          <textarea id={`remark-template-${index}`} className="field" rows={3} required maxLength={2000} value={template.text} onChange={(event) => { setTemplates((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value } : item)); setSuccess(""); }} />
          <button type="button" className="btn-danger focus-ring" onClick={() => remove(index)} aria-label={`Vorlage ${index + 1} löschen`}>Vorlage löschen</button>
        </div>)}
        <button type="button" className="btn-secondary focus-ring" disabled={templates.length >= 200} onClick={() => { setTemplates((current) => [...current, { text: "" }]); setSuccess(""); }}>Vorlage hinzufügen</button>
        <div>
          <label className="label" htmlFor="default-remark">Standardbemerkung für neue Fahrten</label>
          <select id="default-remark" className="field" value={defaultIndex ?? ""} onChange={(event) => { setDefaultIndex(event.target.value === "" ? null : Number(event.target.value)); setSuccess(""); }}>
            <option value="">Kein Standard</option>
            {templates.map((template, index) => <option key={index} value={index}>{template.text || `Vorlage ${index + 1}`}</option>)}
          </select>
        </div>
      </fieldset>
      {error ? <p role="alert" className="text-sm text-[var(--danger)]">{error}</p> : null}
      {success ? <p role="status" className="text-sm text-[var(--success)]">{success}</p> : null}
      <button type="submit" className="btn-primary focus-ring" disabled={pending}>{pending ? "Speichern …" : "Bemerkungsvorlagen speichern"}</button>
    </form>
  </section>;
}
