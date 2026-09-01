"use client";

import { faCheck, faChevronLeft, faChevronRight, faPlus, faPrint } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useState, useTransition } from "react";
import { defaultDateForMonth } from "@/lib/dates";
import { formatEuro } from "@/lib/money";
import type { MonthDataDto, RouteOptionDto, TripDto } from "@/lib/types";
import { TripModal } from "./TripModal";

function monthTitle(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(new Date(year, monthNumber - 1, 1));
}

function shiftMonth(month: string, delta: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const value = new Date(year, monthNumber - 1 + delta, 1);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

function formatDate(date: string) {
  const [year, month, day] = date.split("-");
  return `${day}.${month}.${year}`;
}

export function DashboardClient({ initialMonth, todayMonth, initialData, routeOptions }: {
  initialMonth: string;
  todayMonth: string;
  initialData: MonthDataDto;
  routeOptions: RouteOptionDto[];
}) {
  const [month, setMonth] = useState(initialMonth);
  const [data, setData] = useState(initialData);
  const [modal, setModal] = useState<{ key: string; trip?: TripDto } | null>(null);
  const [error, setError] = useState("");
  const [checkingTripId, setCheckingTripId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  async function loadMonth(nextMonth: string) {
    const response = await fetch(`/api/trips?month=${encodeURIComponent(nextMonth)}`);
    if (response.status === 401) {
      window.location.href = "/login";
      return;
    }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Monat konnte nicht geladen werden.");
    setMonth(nextMonth);
    setData(result);
  }

  function navigate(nextMonth: string) {
    if (nextMonth === month) return;
    setError("");
    startTransition(async () => {
      try { await loadMonth(nextMonth); }
      catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Monat konnte nicht geladen werden."); }
    });
  }

  function refreshAfterChange(date: string) {
    const targetMonth = date.slice(0, 7);
    setModal(null);
    startTransition(async () => {
      try { await loadMonth(targetMonth); }
      catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Daten konnten nicht aktualisiert werden."); }
    });
  }

  async function toggleChecked(trip: TripDto) {
    setCheckingTripId(trip.id);
    try {
      const response = await fetch(`/api/trips/${trip.id}/checked`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isChecked: !trip.isChecked }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Status konnte nicht geändert werden.");
      setData((current) => ({ ...current, trips: current.trips.map((item) => item.id === trip.id ? result.trip : item) }));
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Status konnte nicht geändert werden.");
    } finally {
      setCheckingTripId(null);
    }
  }

  return (
    <section>
      <div className="section-enter mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-extrabold uppercase tracking-[.16em] text-[var(--text-secondary)]">Monatsübersicht</p>
          <h1 className="text-[30px] font-extrabold capitalize tracking-[-.04em] sm:text-[32px] lg:text-[34px]">{monthTitle(month)}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Alle Dienstfahrten und Kilometer auf einen Blick.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <a className="btn-secondary focus-ring px-3 sm:px-5" href={`/print?month=${month}`} target="_blank" rel="noopener noreferrer">
            <FontAwesomeIcon icon={faPrint} className="h-[18px] w-[18px]" />
            Drucken
          </a>
          <button className="btn-primary focus-ring px-3 sm:px-5" type="button" onClick={() => setModal({ key: `new-${Date.now()}` })} disabled={routeOptions.length === 0}>
            <FontAwesomeIcon icon={faPlus} className="h-[18px] w-[18px]" /> Neue Fahrt
          </button>
        </div>
      </div>

      <div className="section-enter mb-4 flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-2.5 shadow-[0_2px_12px_rgba(15,23,42,.035)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1">
          <button className="btn-ghost focus-ring h-11 w-11 p-0 text-xl lg:h-10 lg:w-10" type="button" aria-label="Vorheriger Monat" onClick={() => navigate(shiftMonth(month, -1))}><FontAwesomeIcon icon={faChevronLeft} className="h-4 w-4" /></button>
          <button className="btn-ghost focus-ring h-11 w-11 p-0 text-xl lg:h-10 lg:w-10" type="button" aria-label="Nächster Monat" onClick={() => navigate(shiftMonth(month, 1))}><FontAwesomeIcon icon={faChevronRight} className="h-4 w-4" /></button>
          <button className="btn-secondary focus-ring ml-1" type="button" onClick={() => navigate(todayMonth)}>Heute</button>
        </div>
        <div className="flex w-full items-center gap-3 sm:w-auto">
          {isPending ? <span className="text-sm text-[var(--muted)]">Wird geladen …</span> : null}
          <label className="shrink-0 text-sm font-semibold text-[var(--text-secondary)]" htmlFor="month-picker">Monat</label>
          <input id="month-picker" className="field min-w-0 flex-1 py-2 sm:!w-[175px] sm:flex-none" type="month" value={month} onChange={(event) => navigate(event.target.value)} />
        </div>
      </div>

      {error ? <p className="status-enter mb-4 rounded-xl border border-[var(--danger-line)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">{error}</p> : null}

      {routeOptions.length === 0 ? (
        <div className="status-enter mb-4 flex flex-col gap-3 rounded-2xl border border-[var(--hero-muted)] bg-[var(--primary-soft)] px-5 py-4 text-sm text-[var(--primary)] sm:flex-row sm:items-center sm:justify-between">
          <span><strong>Noch kein Reiseweg vorhanden.</strong> Lege zuerst mindestens eine Strecke an.</span>
          <a href="/settings" className="font-extrabold underline underline-offset-4">Zu den Einstellungen</a>
        </div>
      ) : null}

      <div key={`desktop-${month}`} className={`section-enter hidden overflow-x-auto rounded-[20px] border border-[var(--line)] bg-[var(--surface)] shadow-[0_8px_28px_rgba(15,23,42,.055)] transition-opacity lg:block ${isPending ? "opacity-65" : ""}`}>
        <table className="w-full min-w-[1320px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--line)] bg-[var(--surface-muted)] text-[11px] font-extrabold uppercase tracking-[.09em] text-[var(--muted)]">
              <th className="px-3 py-4 text-center">Übernommen</th>
              <th className="px-5 py-4">Datum</th>
              <th className="px-4 py-4">Beginn</th>
              <th className="px-4 py-4">Ende</th>
              <th className="px-4 py-4">Reiseweg</th>
              <th className="px-4 py-4 text-right">KM Beginn</th>
              <th className="px-4 py-4 text-right">KM Ende</th>
              <th className="px-5 py-4 text-right">KM gesamt</th>
              <th className="px-4 py-4 text-right">KM abrechenbar</th>
              <th className="px-5 py-4 text-right">KM nicht abrechenbar</th>
              <th className="px-5 py-4 text-right">Mögl. Erstattung</th>
            </tr>
          </thead>
          <tbody>
            {data.trips.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-6 py-20 text-center">
                  <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-[var(--primary-soft)] text-2xl text-[var(--feature-muted)]">↗</div>
                  <p className="font-extrabold text-[var(--ink-soft)]">Noch keine Fahrten in diesem Monat</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">Mit „Neue Fahrt“ erstellst du den ersten Eintrag.</p>
                </td>
              </tr>
            ) : data.trips.map((trip) => (
              <tr key={trip.id} className={`group cursor-pointer border-b border-[var(--divider)] text-sm transition-colors last:border-0 hover:bg-[var(--surface-muted)] ${trip.isChecked ? "bg-[var(--success-soft)]" : ""}`} onClick={() => setModal({ key: `edit-${trip.id}`, trip })}>
                <td className="px-3 py-[17px] text-center"><button type="button" className={`focus-ring grid h-8 w-8 place-items-center rounded-lg border ${trip.isChecked ? "border-[var(--success-line)] bg-[var(--success-soft)] text-[var(--success)]" : "border-[var(--line-strong)] bg-[var(--surface)] text-transparent hover:border-[var(--focus)]"}`} aria-label={trip.isChecked ? "Als nicht übernommen markieren" : "Als übernommen markieren"} aria-pressed={trip.isChecked} disabled={checkingTripId === trip.id} onClick={(event) => { event.stopPropagation(); void toggleChecked(trip); }}><FontAwesomeIcon icon={faCheck} className="h-5 w-5" /></button></td>
                <td className="px-5 py-[17px] font-bold text-[var(--ink-soft)]">{formatDate(trip.date)}</td>
                <td className="px-4 py-[17px] tabular-nums text-[var(--text-secondary)]">{trip.startTime}</td>
                <td className="px-4 py-[17px] tabular-nums text-[var(--text-secondary)]">{trip.endTime}</td>
                <td className="px-4 py-[17px] font-semibold">{trip.routeLabel}</td>
                <td className="px-4 py-[17px] text-right tabular-nums text-[var(--text-secondary)]">{trip.odometerStart.toLocaleString("de-DE")}</td>
                <td className="px-4 py-[17px] text-right tabular-nums text-[var(--text-secondary)]">{trip.odometerEnd.toLocaleString("de-DE")}</td>
                <td className="px-5 py-[17px] text-right"><span className="inline-flex min-w-16 justify-center rounded-lg bg-[var(--primary-soft)] px-2.5 py-1 font-extrabold tabular-nums text-[var(--primary)]">{trip.distanceKm} km</span></td>
                <td className="px-4 py-[17px] text-right font-bold tabular-nums text-[var(--text-secondary)]">{trip.reimbursedKm} km</td>
                <td className="px-5 py-[17px] text-right font-extrabold tabular-nums text-[var(--warning)]">{trip.unreimbursedKm} km</td>
                <td className="px-5 py-[17px] text-right">
                  <span className="block font-extrabold tabular-nums text-[var(--success)]">{formatEuro(trip.potentialReimbursementCents)}</span>
                  <span className="block text-[10px] tabular-nums text-[var(--muted)]">{formatEuro(trip.reimbursementRateCents)}/km</span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-[var(--line)] bg-[var(--surface-muted)]">
              <td colSpan={7} className="px-5 py-4 text-right text-xs font-extrabold uppercase tracking-[.1em] text-[var(--muted)]">Gesamt im Monat</td>
              <td className="px-5 py-4 text-right text-base font-extrabold tabular-nums text-[var(--primary)]">{data.totalKm.toLocaleString("de-DE")} km</td>
              <td className="px-4 py-4 text-right text-base font-extrabold tabular-nums text-[var(--text-secondary)]">{data.totalReimbursedKm.toLocaleString("de-DE")} km</td>
              <td className="px-5 py-4 text-right text-base font-extrabold tabular-nums text-[var(--warning)]">{data.totalUnreimbursedKm.toLocaleString("de-DE")} km</td>
              <td className="px-5 py-4 text-right text-base font-extrabold tabular-nums text-[var(--success)]">{formatEuro(data.totalPotentialReimbursementCents)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div key={`mobile-${month}`} className={`stagger-enter space-y-3 transition-opacity lg:hidden ${isPending ? "opacity-65" : ""}`}>
        {data.trips.length === 0 ? (
          <div className="rounded-[20px] border border-[var(--line)] bg-[var(--surface)] px-5 py-14 text-center shadow-[0_8px_28px_rgba(15,23,42,.055)]">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-[var(--primary-soft)] text-2xl text-[var(--feature-muted)]">↗</div>
            <p className="font-extrabold text-[var(--ink-soft)]">Noch keine Fahrten in diesem Monat</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Mit „Neue Fahrt“ erstellst du den ersten Eintrag.</p>
          </div>
        ) : data.trips.map((trip) => (
          <article key={trip.id} data-testid="mobile-trip-card" className={`soft-card rounded-[18px] border p-4 shadow-[0_5px_18px_rgba(15,23,42,.05)] transition-colors ${trip.isChecked ? "border-[var(--success-line)] bg-[var(--success-soft)]" : "border-[var(--line)] bg-[var(--surface)]"}`}>
          <button type="button" className="focus-ring w-full text-left" onClick={() => setModal({ key: `edit-${trip.id}`, trip })}>
            <span className="mb-3 flex items-start justify-between gap-3">
              <span><span className="block text-xs font-bold uppercase tracking-[.08em] text-[var(--muted)]">{formatDate(trip.date)}</span><span className="mt-1 block font-extrabold text-[var(--ink-soft)]">{trip.routeLabel}</span></span>
              <span className="shrink-0 rounded-lg bg-[var(--primary-soft)] px-2.5 py-1 text-sm font-extrabold text-[var(--primary)]">{trip.distanceKm} km</span>
            </span>
            <span className="grid grid-cols-2 gap-3 border-t border-[var(--divider)] pt-3 text-sm">
              <span><span className="block text-[10px] font-bold uppercase tracking-[.08em] text-[var(--muted)]">Uhrzeit</span><span className="mt-0.5 block font-semibold tabular-nums">{trip.startTime} – {trip.endTime}</span></span>
              <span className="text-right"><span className="block text-[10px] font-bold uppercase tracking-[.08em] text-[var(--muted)]">Kilometerstand</span><span className="mt-0.5 block font-semibold tabular-nums">{trip.odometerStart.toLocaleString("de-DE")} → {trip.odometerEnd.toLocaleString("de-DE")}</span></span>
            </span>
            <span className="mt-3 grid grid-cols-2 gap-3 border-t border-[var(--divider)] pt-3 text-sm">
              <span><span className="block text-[10px] font-bold uppercase tracking-[.08em] text-[var(--muted)]">KM abrechenbar</span><span className="mt-0.5 block font-extrabold tabular-nums">{trip.reimbursedKm} km</span></span>
              <span className="text-right"><span className="block text-[10px] font-bold uppercase tracking-[.08em] text-[var(--muted)]">KM nicht abrechenbar</span><span className="mt-0.5 block font-extrabold tabular-nums text-[var(--warning)]">{trip.unreimbursedKm} km</span></span>
            </span>
            <span className="mt-3 flex items-end justify-between gap-3 rounded-xl bg-[var(--success-soft)] px-3 py-2.5 text-sm">
              <span><span className="block text-[10px] font-bold uppercase tracking-[.08em] text-[var(--muted)]">Mögliche Erstattung</span><span className="mt-0.5 block text-[10px] tabular-nums text-[var(--muted)]">{formatEuro(trip.reimbursementRateCents)} je abrechenbarem km</span></span>
              <span className="font-extrabold tabular-nums text-[var(--success)]">{formatEuro(trip.potentialReimbursementCents)}</span>
            </span>
          </button>
          <button type="button" className={`focus-ring mt-3 flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-extrabold ${trip.isChecked ? "border-[var(--success-line)] bg-[var(--success-soft)] text-[var(--success)]" : "border-[var(--line-strong)] bg-[var(--surface)] text-[var(--text-secondary)]"}`} aria-pressed={trip.isChecked} disabled={checkingTripId === trip.id} onClick={() => void toggleChecked(trip)}>{trip.isChecked ? "✓ Ins analoge Fahrtenbuch übernommen" : "Als übernommen markieren"}</button>
          </article>
        ))}
        <div className="rounded-2xl border border-[var(--primary-muted)] bg-[var(--primary-soft)] px-4 py-3">
          <span className="block text-xs font-extrabold uppercase tracking-[.08em] text-[var(--text-secondary)]">Gesamt im Monat</span>
          <span className="mt-2 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <span><span className="block text-[9px] font-bold uppercase text-[var(--muted)]">KM gesamt</span><span className="font-extrabold tabular-nums text-[var(--primary)]">{data.totalKm.toLocaleString("de-DE")} km</span></span>
            <span className="text-right sm:text-center"><span className="block text-[9px] font-bold uppercase text-[var(--muted)]">KM abrechenbar</span><span className="font-extrabold tabular-nums">{data.totalReimbursedKm.toLocaleString("de-DE")} km</span></span>
            <span><span className="block text-[9px] font-bold uppercase text-[var(--muted)]">KM nicht abrechenbar</span><span className="font-extrabold tabular-nums text-[var(--warning)]">{data.totalUnreimbursedKm.toLocaleString("de-DE")} km</span></span>
            <span className="text-right"><span className="block text-[9px] font-bold uppercase text-[var(--muted)]">Mögl. Erstattung</span><span className="font-extrabold tabular-nums text-[var(--success)]">{formatEuro(data.totalPotentialReimbursementCents)}</span></span>
          </span>
        </div>
      </div>

      <p className="mt-3 text-right text-xs text-[var(--muted)]">{data.trips.length} {data.trips.length === 1 ? "Fahrt" : "Fahrten"}</p>

      {modal ? (
        <TripModal
          key={modal.key}
          trip={modal.trip}
          month={month}
          defaultDate={defaultDateForMonth(month)}
          suggestedOdometerStart={data.suggestedOdometerStart}
          routeOptions={routeOptions}
          onClose={() => setModal(null)}
          onSaved={refreshAfterChange}
        />
      ) : null}
    </section>
  );
}
