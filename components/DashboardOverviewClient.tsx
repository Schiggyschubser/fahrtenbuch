"use client";

import { faCalendarDays, faCarSide, faChartLine, faClock, faRoad } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useState, useTransition } from "react";
import type { DashboardDataDto } from "@/lib/types";

function formatNumber(value: number, maximumFractionDigits = 0) {
  return value.toLocaleString("de-DE", { maximumFractionDigits });
}

function formatDate(date: string) {
  const [year, month, day] = date.split("-");
  return `${day}.${month}.${year}`;
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${formatNumber(hours)} h` : `${formatNumber(hours)} h ${rest} min`;
}

function periodTitle(period: string) {
  return period === "all" ? "Gesamter Zeitraum" : `Kalenderjahr ${period}`;
}

function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="text-sm font-bold text-[var(--muted)]">–</span>;
  const positive = value >= 0;
  return (
    <span className={`rounded-lg px-2 py-1 text-xs font-extrabold tabular-nums ${positive ? "bg-[var(--primary-soft)] text-[var(--primary)]" : "bg-[var(--danger-soft)] text-[var(--danger)]"}`}>
      {positive ? "+" : ""}{formatNumber(value, 1)} %
    </span>
  );
}

function KpiCard({ label, value, hint, icon }: { label: string; value: string; hint: string; icon: React.ReactNode }) {
  return (
    <div className="soft-card rounded-[18px] border border-[var(--line)] bg-[var(--surface)] px-4 py-3 shadow-[0_6px_22px_rgba(15,23,42,.045)] sm:px-5 sm:py-3">
      <div className="mb-2 flex items-start justify-between gap-3">
        <p className="text-[11px] font-extrabold uppercase tracking-[.1em] text-[var(--muted)]">{label}</p>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">{icon}</span>
      </div>
      <p className="text-[27px] font-extrabold tracking-[-.04em] text-[var(--ink)] sm:text-[30px]">{value}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>
    </div>
  );
}

function TrendChart({ data }: { data: DashboardDataDto }) {
  const maxKm = Math.max(...data.trend.map((item) => item.totalKm), 1);
  return (
    <section className="section-enter soft-card min-w-0 overflow-hidden rounded-[20px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[0_8px_28px_rgba(15,23,42,.05)] sm:p-6 lg:col-span-2">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[.1em] text-[var(--muted)]">Verlauf</p>
          <h2 className="mt-1 text-xl font-extrabold tracking-[-.025em]">{data.selectedPeriod === "all" ? "Kilometer nach Jahren" : "Kilometer nach Monaten"}</h2>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)]"><span className="h-2.5 w-2.5 rounded-sm bg-[var(--primary)]" /> Kilometer</div>
      </div>
      <div className="w-full max-w-full overflow-x-auto pb-1">
        <div className="stagger-enter flex h-[230px] w-full min-w-0 items-end gap-1 border-b border-[var(--line)] px-1 sm:gap-2">
          {data.trend.map((item) => {
            const height = item.totalKm === 0 ? 2 : Math.max(7, (item.totalKm / maxKm) * 100);
            return (
              <div key={item.key} className="group flex h-full min-w-0 flex-1 flex-col justify-end text-center" title={`${item.label}: ${formatNumber(item.totalKm)} km · ${item.tripCount} Fahrten`}>
                <span className="mb-2 text-[10px] font-bold tabular-nums text-[var(--muted)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">{item.totalKm || ""}</span>
                <span className="chart-bar-enter mx-auto w-full max-w-[42px] rounded-t-md bg-[var(--primary)] transition-colors group-hover:bg-[var(--primary)]" style={{ height: `${height}%` }} aria-hidden="true" />
                <span className="mt-2 pb-2 text-[10px] font-bold text-[var(--muted)] sm:text-[11px]">{item.label}</span>
                <span className="sr-only">{item.label}: {item.totalKm} Kilometer, {item.tripCount} Fahrten</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ComparisonCard({ data }: { data: DashboardDataDto }) {
  if (!data.comparison) {
    return (
      <section className="section-enter soft-card rounded-[20px] border border-[var(--line)] bg-[var(--feature)] p-5 text-[var(--feature-contrast)] shadow-[0_8px_28px_rgba(15,23,42,.10)] sm:p-6">
        <p className="text-[11px] font-extrabold uppercase tracking-[.1em] text-[var(--primary-muted)]">Datenbestand</p>
        <h2 className="mt-1 text-xl font-extrabold">Gesamter Zeitraum</h2>
        {data.dataRange ? (
          <div className="mt-8">
            <p className="text-3xl font-extrabold tracking-[-.04em]">{formatDate(data.dataRange.firstDate)}</p>
            <p className="my-2 text-sm text-[var(--primary-muted)]">bis</p>
            <p className="text-3xl font-extrabold tracking-[-.04em]">{formatDate(data.dataRange.lastDate)}</p>
            <p className="mt-5 text-sm text-[var(--line-strong)]">{data.availableYears.length} Kalenderjahre mit erfassten Fahrten</p>
          </div>
        ) : <p className="mt-8 text-sm text-[var(--line-strong)]">Noch keine Daten vorhanden.</p>}
      </section>
    );
  }
  const comparison = data.comparison;
  return (
    <section className="section-enter soft-card rounded-[20px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[0_8px_28px_rgba(15,23,42,.05)] sm:p-6">
      <p className="text-[11px] font-extrabold uppercase tracking-[.1em] text-[var(--muted)]">Vergleich</p>
      <h2 className="mt-1 text-xl font-extrabold tracking-[-.025em]">Zum Vorjahr</h2>
      <div className="mt-6 space-y-4">
        <div className="rounded-2xl bg-[var(--surface-muted)] p-4">
          <div className="flex items-center justify-between"><span className="text-sm font-bold">Kilometer</span><Delta value={comparison.kmDeltaPercent} /></div>
          <div className="mt-3 flex items-end justify-between gap-4"><div><p className="text-xs text-[var(--muted)]">{comparison.currentLabel}</p><p className="text-2xl font-extrabold tabular-nums">{formatNumber(comparison.current.totalKm)} km</p></div><div className="text-right"><p className="text-xs text-[var(--muted)]">{comparison.previousLabel}</p><p className="font-bold tabular-nums text-[var(--muted)]">{formatNumber(comparison.previous.totalKm)} km</p></div></div>
        </div>
        <div className="rounded-2xl bg-[var(--surface-muted)] p-4">
          <div className="flex items-center justify-between"><span className="text-sm font-bold">Fahrten</span><Delta value={comparison.tripDeltaPercent} /></div>
          <div className="mt-3 flex items-end justify-between gap-4"><div><p className="text-xs text-[var(--muted)]">{comparison.currentLabel}</p><p className="text-2xl font-extrabold tabular-nums">{formatNumber(comparison.current.tripCount)}</p></div><div className="text-right"><p className="text-xs text-[var(--muted)]">{comparison.previousLabel}</p><p className="font-bold tabular-nums text-[var(--muted)]">{formatNumber(comparison.previous.tripCount)}</p></div></div>
        </div>
      </div>
    </section>
  );
}

export function DashboardOverviewClient({ initialData }: { initialData: DashboardDataDto }) {
  const [data, setData] = useState(initialData);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function changePeriod(year: string) {
    if (year === data.selectedPeriod) return;
    setError("");
    startTransition(async () => {
      try {
        const response = await fetch(`/api/dashboard?year=${encodeURIComponent(year)}`);
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Dashboard konnte nicht geladen werden.");
        setData(result);
        window.history.replaceState(null, "", year === initialData.selectedPeriod ? "/" : `/?year=${encodeURIComponent(year)}`);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Dashboard konnte nicht geladen werden.");
      }
    });
  }

  const maxWeekdayKm = Math.max(...data.weekdays.map((day) => day.totalKm), 1);
  const maxRouteKm = Math.max(...data.topRoutes.map((route) => route.totalKm), 1);

  return (
    <section className={isPending ? "opacity-70 transition-opacity" : "transition-opacity"}>
      <div className="section-enter mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-extrabold uppercase tracking-[.16em] text-[var(--text-secondary)]">Auswertung</p>
          <h1 className="text-[30px] font-extrabold tracking-[-.04em] sm:text-[32px] lg:text-[34px]">Dashboard</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Entwicklung und Nutzung deines Fahrtenbuchs im Überblick.</p>
        </div>
        <label className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 shadow-sm sm:w-auto sm:min-w-[230px]">
          <span className="text-sm font-bold text-[var(--text-secondary)]">Zeitraum</span>
          <select className="focus-ring rounded-lg bg-[var(--primary-soft)] px-3 py-2 text-sm font-extrabold text-[var(--hero)] outline-none" value={data.selectedPeriod} onChange={(event) => changePeriod(event.target.value)} disabled={isPending}>
            {data.availableYears.map((year) => <option key={year} value={year}>{year}</option>)}
            <option value="all">Gesamt</option>
          </select>
        </label>
      </div>

      {error ? <p role="alert" className="status-enter mb-5 rounded-xl border border-[var(--danger-line)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">{error}</p> : null}

      <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-extrabold text-[var(--ink-soft)]">{periodTitle(data.selectedPeriod)}</h2>{isPending ? <span className="text-xs font-semibold text-[var(--muted)]">Wird geladen …</span> : null}</div>
      <div className="stagger-enter grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Kilometer" value={`${formatNumber(data.summary.totalKm)} km`} hint="Gesamte Strecke" icon={<FontAwesomeIcon icon={faRoad} className="h-5 w-5" />} />
        <KpiCard label="Fahrten" value={formatNumber(data.summary.tripCount)} hint="Erfasste Einträge" icon={<FontAwesomeIcon icon={faCarSide} className="h-5 w-5" />} />
        <KpiCard label="Aktive Tage" value={formatNumber(data.summary.activeDays)} hint="Tage mit Dienstfahrt" icon={<FontAwesomeIcon icon={faCalendarDays} className="h-5 w-5" />} />
        <KpiCard label="Fahrtdauer" value={formatDuration(data.summary.totalMinutes)} hint="Zeit unterwegs" icon={<FontAwesomeIcon icon={faClock} className="h-5 w-5" />} />
        <KpiCard label="Ø pro Fahrt" value={`${formatNumber(data.summary.averageKm, 1)} km`} hint="Durchschnittliche Strecke" icon={<FontAwesomeIcon icon={faChartLine} className="h-5 w-5" />} />
      </div>

      <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3">
        <TrendChart data={data} />
        <ComparisonCard data={data} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="section-enter soft-card rounded-[20px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[0_8px_28px_rgba(15,23,42,.05)] sm:p-6">
          <p className="text-[11px] font-extrabold uppercase tracking-[.1em] text-[var(--muted)]">Verteilung</p>
          <h2 className="mt-1 text-xl font-extrabold tracking-[-.025em]">Nach Wochentagen</h2>
          <div className="stagger-enter mt-6 space-y-3">
            {data.weekdays.map((day) => (
              <div key={day.key} className="grid grid-cols-[28px_1fr_auto] items-center gap-3">
                <span className="text-xs font-extrabold text-[var(--muted)]">{day.label}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-[var(--surface-hover)]"><span className="progress-enter block h-full rounded-full bg-[var(--focus)]" style={{ width: `${day.totalKm === 0 ? 0 : Math.max(3, (day.totalKm / maxWeekdayKm) * 100)}%` }} /></span>
                <span className="w-[88px] text-right text-xs font-bold tabular-nums text-[var(--text-secondary)]">{formatNumber(day.totalKm)} km <span className="text-[var(--subtle)]">· {day.tripCount}</span></span>
              </div>
            ))}
          </div>
        </section>

        <section className="section-enter soft-card rounded-[20px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[0_8px_28px_rgba(15,23,42,.05)] sm:p-6">
          <p className="text-[11px] font-extrabold uppercase tracking-[.1em] text-[var(--muted)]">Rangliste</p>
          <h2 className="mt-1 text-xl font-extrabold tracking-[-.025em]">Stärkste Reisewege</h2>
          <div className="stagger-enter mt-5 space-y-4">
            {data.topRoutes.length > 0 ? data.topRoutes.map((route, index) => (
              <div key={route.routeLabel}>
                <div className="mb-1.5 flex items-start justify-between gap-4 text-sm"><span className="min-w-0 font-bold"><span className="mr-2 text-[var(--muted)]">{index + 1}.</span>{route.routeLabel}</span><span className="shrink-0 font-extrabold tabular-nums text-[var(--primary)]">{formatNumber(route.totalKm)} km</span></div>
                <div className="flex items-center gap-3"><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-hover)]"><span className="progress-enter block h-full rounded-full bg-[var(--primary)]" style={{ width: `${Math.max(4, (route.totalKm / maxRouteKm) * 100)}%` }} /></span><span className="w-16 text-right text-[11px] font-semibold text-[var(--muted)]">{route.tripCount} Fahrten</span></div>
              </div>
            )) : <p className="py-10 text-center text-sm text-[var(--muted)]">Keine Reisewege im gewählten Zeitraum.</p>}
          </div>
          <p className="mt-5 text-[11px] leading-4 text-[var(--muted)]">Historische Mehrort-Strecken werden exakt nach ihrem gespeicherten Text ausgewertet.</p>
        </section>
      </div>

    </section>
  );
}
