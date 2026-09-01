"use client";

import { faArrowLeft, faPrint } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";

export function PrintToolbar() {
  return (
    <div className="print-toolbar page-enter sticky top-0 z-10 mx-auto mb-4 flex w-full max-w-[210mm] flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-translucent)] px-3 py-3 shadow-[0_8px_28px_rgba(15,23,42,.10)] backdrop-blur sm:mb-5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
      <Link href="/" className="btn-secondary focus-ring w-full sm:w-auto"><FontAwesomeIcon icon={faArrowLeft} className="h-[18px] w-[18px]" /> Zurück zum Fahrtenbuch</Link>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
        <span className="hidden text-sm text-[var(--muted)] md:block">Im Druckdialog Drucker oder „Als PDF speichern“ wählen.</span>
        <button type="button" className="btn-primary focus-ring w-full px-5 sm:w-auto" onClick={() => window.print()}>
          <FontAwesomeIcon icon={faPrint} className="h-[18px] w-[18px]" />
          Drucken / PDF
        </button>
      </div>
    </div>
  );
}
