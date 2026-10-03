"use client";

import { faArrowLeft, faChevronDown, faPrint } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ALL_TRIP_COLUMN_IDS, TRIP_COLUMNS, type TripColumnId } from "@/lib/trip-columns";

export function PrintToolbar({ initialVisibleColumns, preparing = false, includeClaim, onIncludeClaim, signatureAvailable, includeSignature, onIncludeSignature }: { initialVisibleColumns: TripColumnId[]; preparing?: boolean; includeClaim: boolean; onIncludeClaim: (include: boolean) => void; signatureAvailable: boolean; includeSignature: boolean; onIncludeSignature: (include: boolean) => void }) {
  const router = useRouter();
  const [visibleColumns, setVisibleColumns] = useState(initialVisibleColumns);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    function closeOutside(event: Event) {
      if (event.target instanceof Node && !dropdownRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("focusin", closeOutside);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("focusin", closeOutside);
    };
  }, [open]);
  async function saveColumns(columns: TripColumnId[]) {
    const previousColumns = visibleColumns;
    setVisibleColumns(columns);
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/settings/print-columns", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visibleColumns: columns }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Druckspalten konnten nicht gespeichert werden.");
      setVisibleColumns(result.visibleColumns);
      startTransition(() => router.refresh());
    } catch (error) { setVisibleColumns(previousColumns); setError(error instanceof Error ? error.message : "Druckspalten konnten nicht gespeichert werden."); }
    finally { setSaving(false); }
  }
  return (
    <div className="print-toolbar page-enter sticky top-0 z-10 mx-auto mb-4 flex w-full max-w-[297mm] flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-translucent)] px-3 py-3 shadow-[0_8px_28px_rgba(15,23,42,.10)] backdrop-blur sm:mb-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4">
      <Link href="/trips" className="btn-secondary focus-ring w-full sm:w-auto"><FontAwesomeIcon icon={faArrowLeft} className="h-[18px] w-[18px]" /> Zurück zum Fahrtenbuch</Link>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={includeClaim} onChange={event => onIncludeClaim(event.target.checked)} />Antrag voranstellen</label>
        {signatureAvailable ? <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={includeSignature} disabled={!includeClaim} onChange={event => onIncludeSignature(event.target.checked)} />Unterschrift einfügen</label> : null}
        <div ref={dropdownRef} className="relative" onKeyDown={(event) => { if (event.key === "Escape") { setOpen(false); buttonRef.current?.focus(); } }}>
          <button ref={buttonRef} type="button" className="btn-secondary focus-ring w-full sm:w-auto" aria-expanded={open} aria-controls="print-columns-dropdown" onClick={() => setOpen(!open)}>
            Spalten für PDF/Druck <FontAwesomeIcon icon={faChevronDown} className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          {open ? <div id="print-columns-dropdown" className="popover-enter absolute right-0 top-full z-30 mt-2 max-h-[70vh] w-[310px] max-w-[calc(100vw-48px)] overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 shadow-[0_12px_35px_rgba(15,23,42,.14)]">
            <p className="mb-2 px-2 text-xs text-[var(--muted)]">Diese Auswahl gilt nur für PDF und Druck.</p>
            <fieldset disabled={saving || pending}>
              <legend className="sr-only">Spalten für PDF und Druck</legend>
              {TRIP_COLUMNS.map((column) => <label key={column.id} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2 py-1 text-sm hover:bg-[var(--surface-muted)]"><input type="checkbox" className="focus-ring h-4 w-4 shrink-0 accent-[var(--primary)]" checked={visibleColumns.includes(column.id)} disabled={visibleColumns.length === 1 && visibleColumns.includes(column.id)} onChange={(event) => void saveColumns(event.target.checked ? [...visibleColumns, column.id] : visibleColumns.filter((id) => id !== column.id))} />{column.label}</label>)}
            </fieldset>
            <button type="button" className="btn-secondary focus-ring mt-2 w-full" disabled={saving || pending} onClick={() => void saveColumns([...ALL_TRIP_COLUMN_IDS])}>Alle anzeigen</button>
          </div> : null}
        </div>
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
        <button type="button" className="btn-primary focus-ring w-full px-5 sm:w-auto" disabled={saving || pending || preparing} onClick={() => window.print()}>
          <FontAwesomeIcon icon={faPrint} className="h-[18px] w-[18px]" />
          Drucken / PDF
        </button>
      </div>
    </div>
  );
}
