"use client";

import {
  faArrowsLeftRight,
  faCheck,
  faCircleInfo,
  faClipboard,
  faClock,
  faDatabase,
  faDownload,
  faEuroSign,
  faFileArrowDown,
  faFileArrowUp,
  faKey,
  faLocationDot,
  faPalette,
  faPlus,
  faQrcode,
  faReceipt,
  faRoute,
  faRoad,
  faShieldHalved,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { BackupDto, BackupKind, ReimbursementSettingsDto, RoutePairDto, TripCsvImportResultDto, TripDateRangeDto, TwoFactorSetupDto, TwoFactorStatusDto } from "@/lib/types";
import { THEMES } from "@/lib/themes";
import { Modal } from "./Modal";
import { ThemeSelector } from "./ThemeSelector";

export type SettingsTab = "appearance" | "routes" | "reimbursement" | "backups" | "transfer" | "credentials";

export function SettingsClient({ initialRoutes, initialBackups, initialReimbursementSettings, initialTwoFactorStatus, initialTripDateRange, initialTab, username }: {
  initialRoutes: RoutePairDto[];
  initialBackups: BackupDto[];
  initialReimbursementSettings: ReimbursementSettingsDto;
  initialTwoFactorStatus: TwoFactorStatusDto;
  initialTripDateRange: TripDateRangeDto;
  initialTab: SettingsTab;
  username: string;
}) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [routes, setRoutes] = useState(initialRoutes);
  const [backups, setBackups] = useState(initialBackups);
  const [reimbursementSettings, setReimbursementSettings] = useState(initialReimbursementSettings);
  const [routeModal, setRouteModal] = useState<{ key: string; route?: RoutePairDto } | null>(null);

  function selectTab(tab: SettingsTab) {
    setActiveTab(tab);
    window.history.replaceState(null, "", `/settings?tab=${tab}`);
  }

  async function reloadRoutes() {
    const response = await fetch("/api/routes");
    const result = await response.json();
    if (response.ok) setRoutes(result.routes);
  }

  async function reloadAllData() {
    const [routesResponse, backupsResponse, reimbursementResponse] = await Promise.all([
      fetch("/api/routes"),
      fetch("/api/backups"),
      fetch("/api/settings/reimbursement"),
    ]);
    const [routesResult, backupsResult, reimbursementResult] = await Promise.all([
      routesResponse.json(),
      backupsResponse.json(),
      reimbursementResponse.json(),
    ]);
    if (routesResponse.ok) setRoutes(routesResult.routes);
    if (backupsResponse.ok) setBackups(backupsResult.backups);
    if (reimbursementResponse.ok) setReimbursementSettings(reimbursementResult);
  }

  return (
    <div>
      <div role="tablist" aria-label="Einstellungsbereiche" className="section-enter mb-5 flex gap-2 overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-2 shadow-[var(--card-shadow)] md:mb-6 md:grid md:grid-cols-3 md:overflow-visible xl:grid-cols-6">
        <SettingsTabButton active={activeTab === "appearance"} icon="appearance" title="Darstellung" description={`${THEMES.length} helle und dunkle Themes`} onClick={() => selectTab("appearance")} />
        <SettingsTabButton active={activeTab === "routes"} icon="routes" title="Reisewege" description={`${routes.length} gespeicherte Strecken`} onClick={() => selectTab("routes")} />
        <SettingsTabButton active={activeTab === "reimbursement"} icon="reimbursement" title="Abrechnung" description={`${(reimbursementSettings.reimbursementRateCents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2 })} € pro km`} onClick={() => selectTab("reimbursement")} />
        <SettingsTabButton active={activeTab === "backups"} icon="backups" title="Sicherungen" description={`${backups.length} Backups vorhanden`} onClick={() => selectTab("backups")} />
        <SettingsTabButton active={activeTab === "transfer"} icon="transfer" title="Import / Export" description="Fahrten als CSV" onClick={() => selectTab("transfer")} />
        <SettingsTabButton active={activeTab === "credentials"} icon="credentials" title="Zugang" description="Benutzername und Passwort" onClick={() => selectTab("credentials")} />
      </div>

      <div key={activeTab} role="tabpanel" className="section-enter">
        {activeTab === "appearance" ? <ThemeSelector /> : null}
        {activeTab === "routes" ? (
          <RoutesCard routes={routes} onCreate={() => setRouteModal({ key: `new-${Date.now()}` })} onEdit={(route) => setRouteModal({ key: `edit-${route.id}`, route })} />
        ) : null}
        {activeTab === "reimbursement" ? (
          <ReimbursementCard settings={reimbursementSettings} onSaved={setReimbursementSettings} />
        ) : null}
        {activeTab === "backups" ? <BackupsCard backups={backups} setBackups={setBackups} onRestored={reloadAllData} /> : null}
        {activeTab === "transfer" ? <TransferCard initialDateRange={initialTripDateRange} onImported={reloadAllData} /> : null}
        {activeTab === "credentials" ? <CredentialsCard username={username} initialTwoFactorStatus={initialTwoFactorStatus} /> : null}
      </div>

      {routeModal ? <RouteModal key={routeModal.key} route={routeModal.route} onClose={() => setRouteModal(null)} onSaved={async () => { setRouteModal(null); await reloadRoutes(); }} /> : null}
    </div>
  );
}

function SettingsTabIcon({ type }: { type: SettingsTab }) {
  const icons: Record<SettingsTab, IconDefinition> = {
    appearance: faPalette,
    routes: faRoute,
    reimbursement: faEuroSign,
    backups: faDatabase,
    transfer: faFileArrowUp,
    credentials: faKey,
  };
  return <FontAwesomeIcon icon={icons[type]} className="h-5 w-5" />;
}

function SettingsTabButton({ active, icon, title, description, onClick }: { active: boolean; icon: SettingsTab; title: string; description: string; onClick: () => void }) {
  return (
    <button type="button" role="tab" aria-label={title} aria-selected={active} className={`focus-ring min-w-[155px] flex-1 rounded-xl px-4 py-3.5 text-left transition-[background-color,color,box-shadow,transform] active:scale-[.99] md:min-w-0 md:px-5 ${active ? "bg-[var(--primary)] text-[var(--primary-contrast)] shadow-sm" : "text-[var(--ink-soft)] hover:bg-[var(--surface-hover)]"}`} onClick={onClick}>
      <span className="flex items-center gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${active ? "bg-white/15 text-[var(--primary-contrast)]" : "bg-[var(--primary-soft)] text-[var(--primary)]"}`}><SettingsTabIcon type={icon} /></span>
        <span className="min-w-0">
          <span className="block font-extrabold">{title}</span>
          <span className={`mt-0.5 block text-xs ${active ? "text-[var(--primary-contrast-muted)]" : "text-[var(--muted)]"}`}>{description}</span>
        </span>
      </span>
    </button>
  );
}

function RoutesCard({ routes, onCreate, onEdit }: { routes: RoutePairDto[]; onCreate: () => void; onEdit: (route: RoutePairDto) => void }) {
  return (
    <section className="overflow-hidden rounded-[20px] border border-[var(--line)] bg-[var(--surface)] shadow-[0_7px_24px_rgba(15,23,42,.045)]">
      <header className="flex flex-col gap-4 border-b border-[var(--line)] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div><h2 className="text-lg font-extrabold tracking-[-.02em]">Reisewege</h2><p className="mt-1 text-sm text-[var(--muted)]">Jede Strecke ist automatisch auch in Gegenrichtung verfügbar.</p></div>
        <button className="btn-primary focus-ring w-full sm:w-auto" type="button" onClick={onCreate}><FontAwesomeIcon icon={faPlus} className="h-4 w-4" /> Reiseweg anlegen</button>
      </header>
      {routes.length === 0 ? (
        <div className="px-6 py-14 text-center"><p className="font-bold">Noch keine Reisewege angelegt</p><p className="mt-1 text-sm text-[var(--muted)]">Lege Ort A, Ort B und die Entfernung einmalig fest.</p></div>
      ) : (
        <div className="divide-y divide-[var(--divider)]">
          {routes.map((route) => (
            <button key={route.id} type="button" className="interactive-row focus-ring group flex w-full items-center justify-between gap-3 px-4 py-4 text-left hover:bg-[var(--surface-muted)] sm:px-6" onClick={() => onEdit(route)}>
              <div className="flex min-w-0 items-center gap-3 sm:gap-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]"><FontAwesomeIcon icon={faArrowsLeftRight} className="h-4 w-4" /></span><div className="min-w-0"><p className="break-words font-extrabold"><span>{route.placeA}</span><span className="mx-2 text-[var(--muted)]">↔</span><span>{route.placeB}</span></p><p className="mt-0.5 hidden text-xs text-[var(--muted)] sm:block">Beide Fahrtrichtungen verfügbar</p></div></div>
              <div className="flex shrink-0 items-center gap-2 sm:gap-5">
                <span className="rounded-lg bg-[var(--primary-soft)] px-2.5 py-1.5 text-right text-xs font-extrabold tabular-nums text-[var(--primary)] sm:px-3">
                  <span className="block">KM gesamt: {route.distanceKm} km</span>
                  <span className="block text-[var(--text-secondary)]">KM abrechenbar: {route.reimbursedKm} km · {route.durationMinutes || "–"} Min.</span>
                </span>
                <span className="text-xl text-[var(--subtle)] transition-transform group-hover:translate-x-0.5">›</span>
              </div>
            </button>
          ))}
        </div>
      )}
      <footer className="border-t border-[var(--line)] bg-[var(--surface-muted)] px-6 py-3 text-xs leading-5 text-[var(--muted)]">Änderungen gelten nur für neue Fahrten. Bereits gespeicherte Fahrten behalten ihre historischen Angaben.</footer>
    </section>
  );
}

function ReimbursementCard({ settings, onSaved }: {
  settings: ReimbursementSettingsDto;
  onSaved: (settings: ReimbursementSettingsDto) => void;
}) {
  const [rate, setRate] = useState((settings.reimbursementRateCents / 100).toFixed(2).replace(".", ","));
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const normalized = rate.trim().replace(",", ".");
    if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
      setError("Bitte gib einen Betrag mit höchstens zwei Nachkommastellen ein.");
      return;
    }
    const reimbursementRateCents = Math.round(Number(normalized) * 100);
    if (reimbursementRateCents < 0 || reimbursementRateCents > 10000) {
      setError("Der Erstattungssatz muss zwischen 0,00 € und 100,00 € liegen.");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/settings/reimbursement", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reimbursementRateCents }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Der Erstattungssatz konnte nicht gespeichert werden.");
        return;
      }
      onSaved(result);
      setRate((result.reimbursementRateCents / 100).toFixed(2).replace(".", ","));
      setSuccess("Der Erstattungssatz wurde gespeichert und gilt für neu angelegte Fahrten.");
    });
  }

  return (
    <section className="overflow-hidden rounded-[20px] border border-[var(--line)] bg-[var(--surface)] shadow-[0_7px_24px_rgba(15,23,42,.045)]">
      <header className="border-b border-[var(--line)] px-5 py-5 sm:px-6">
        <h2 className="text-lg font-extrabold tracking-[-.02em]">Kilometer-Erstattung</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Lege fest, welcher Betrag pro abrechenbarem Kilometer angesetzt wird.</p>
      </header>
      <form onSubmit={submit} className="px-5 py-5 sm:px-6 sm:py-6">
        <div className="max-w-md">
          <label className="label" htmlFor="reimbursement-rate">Erstattung pro abrechenbarem Kilometer</label>
          <div className="relative">
            <input
              className="field pr-12 tabular-nums"
              id="reimbursement-rate"
              name="reimbursementRate"
              inputMode="decimal"
              autoComplete="off"
              value={rate}
              onChange={(event) => setRate(event.target.value)}
              aria-describedby="reimbursement-rate-help"
              required
            />
            <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center font-bold text-[var(--muted)]">€</span>
          </div>
          <p id="reimbursement-rate-help" className="mt-2 text-xs leading-5 text-[var(--muted)]">
            Der neue Satz wird als historischer Wert nur bei künftig neu angelegten Fahrten gespeichert. Bereits vorhandene Fahrten behalten ihren damaligen Satz.
          </p>
        </div>
        {error ? <p role="alert" className="status-enter mt-4 rounded-xl border border-[var(--danger-line)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">{error}</p> : null}
        {success ? <p className="status-enter mt-4 rounded-xl border border-[var(--primary-muted)] bg-[var(--primary-soft)] px-4 py-3 text-sm text-[var(--primary)]">{success}</p> : null}
        <div className="mt-5">
          <button type="submit" className="btn-primary focus-ring w-full sm:w-auto" disabled={isPending}>
            {isPending ? "Wird gespeichert …" : "Erstattungssatz speichern"}
          </button>
        </div>
      </form>
    </section>
  );
}

function TransferCard({ initialDateRange, onImported }: {
  initialDateRange: TripDateRangeDto;
  onImported: () => Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(initialDateRange.firstDate ?? today);
  const [to, setTo] = useState(initialDateRange.lastDate ?? today);
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [exportError, setExportError] = useState("");
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState("");
  const [isExportPending, startExportTransition] = useTransition();
  const [isImportPending, startImportTransition] = useTransition();

  function exportTrips(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runExport(`/api/trips/export?${new URLSearchParams({ from, to })}`, `fahrtenbuch-${from}-bis-${to}.csv`);
  }

  function exportAllTrips() {
    runExport("/api/trips/export?all=1", "fahrtenbuch-gesamt.csv");
  }

  function runExport(url: string, filename: string) {
    setExportError("");
    startExportTransition(async () => {
      const response = await fetch(url);
      if (!response.ok) {
        const result = await response.json();
        setExportError(result.error ?? "Die CSV-Datei konnte nicht erstellt werden.");
        return;
      }
      const blobUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(blobUrl);
    });
  }

  function importTrips(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setImportError("");
    setImportSuccess("");
    startImportTransition(async () => {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/trips/import", { method: "POST", body });
      const result = await response.json() as TripCsvImportResultDto & { error?: string };
      if (!response.ok) {
        setImportError(result.error ?? "Die CSV-Datei konnte nicht importiert werden.");
        return;
      }
      if (result.dateRange.firstDate && result.dateRange.lastDate) {
        setFrom(result.dateRange.firstDate);
        setTo(result.dateRange.lastDate);
      }
      setImportSuccess(
        result.imported > 0
          ? `${result.imported} Fahrten importiert, ${result.skipped} Dubletten übersprungen. Vor dem Import wurde eine Sicherheitskopie erstellt.`
          : `Keine neue Fahrt importiert; ${result.skipped} Dubletten wurden übersprungen.`,
      );
      setFile(null);
      setFileInputKey((current) => current + 1);
      await onImported();
    });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="overflow-hidden rounded-[20px] border border-[var(--line)] bg-[var(--surface)] shadow-[0_7px_24px_rgba(15,23,42,.045)]">
        <header className="flex items-start gap-3 border-b border-[var(--line)] px-5 py-5 sm:px-6">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]"><FontAwesomeIcon icon={faFileArrowDown} className="h-5 w-5" /></span>
          <div><h2 className="text-lg font-extrabold tracking-[-.02em]">Fahrten exportieren</h2><p className="mt-1 text-sm text-[var(--muted)]">Lade einen frei wählbaren Zeitraum als CSV-Datei herunter.</p></div>
        </header>
        <form onSubmit={exportTrips} className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="export-from">Von einschließlich</label><input className="field" id="export-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} required /></div>
            <div><label className="label" htmlFor="export-to">Bis einschließlich</label><input className="field" id="export-to" type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} required /></div>
          </div>
          <div className="rounded-xl bg-[var(--surface-muted)] px-4 py-3 text-sm leading-6 text-[var(--text-secondary)]">Exportiert werden <strong>Datum, Beginn, Ende, Reiseweg, KM Beginn und KM Ende</strong>. Die Datei kann später unverändert wieder importiert werden.</div>
          {exportError ? <p role="alert" className="status-enter rounded-xl border border-[var(--danger-line)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">{exportError}</p> : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="submit" className="btn-primary focus-ring w-full sm:w-auto" disabled={isExportPending || !from || !to || to < from}><FontAwesomeIcon icon={faFileArrowDown} className="h-4 w-4" /> {isExportPending ? "Export wird erstellt …" : "CSV exportieren"}</button>
            <button type="button" className="btn-secondary focus-ring w-full sm:w-auto" disabled={isExportPending} onClick={exportAllTrips}><FontAwesomeIcon icon={faDatabase} className="h-4 w-4" /> Alles exportieren</button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-[20px] border border-[var(--line)] bg-[var(--surface)] shadow-[0_7px_24px_rgba(15,23,42,.045)]">
        <header className="flex items-start gap-3 border-b border-[var(--line)] px-5 py-5 sm:px-6">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]"><FontAwesomeIcon icon={faFileArrowUp} className="h-5 w-5" /></span>
          <div><h2 className="text-lg font-extrabold tracking-[-.02em]">Fahrten importieren</h2><p className="mt-1 text-sm text-[var(--muted)]">Übernimm eigenständige Fahrten aus einer CSV-Datei.</p></div>
        </header>
        <form onSubmit={importTrips} className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
          <div className="rounded-xl border border-[var(--primary-muted)] bg-[var(--primary-soft)] px-4 py-3 text-sm leading-6 text-[var(--primary)]">
            <strong>Erwartete Kopfzeile:</strong>
            <code className="mt-2 block overflow-x-auto whitespace-nowrap rounded-lg bg-[var(--surface-overlay)] px-3 py-2 text-xs">Datum;Beginn;Ende;Reiseweg;KM Beginn;KM Ende</code>
            <strong className="mt-3 block">Beispielzeile:</strong>
            <code className="mt-2 block overflow-x-auto whitespace-nowrap rounded-lg bg-[var(--surface-overlay)] px-3 py-2 text-xs">2026-07-28;08:00;09:30;Büro → Kunde;1000;1018</code>
          </div>
          <div>
            <label className="label" htmlFor="trip-csv-file">CSV-Datei auswählen</label>
            <input key={fileInputKey} className="field file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--primary-soft)] file:px-3 file:py-1.5 file:font-bold file:text-[var(--primary)]" id="trip-csv-file" type="file" accept=".csv,text/csv" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required />
            <p className="mt-2 text-xs text-[var(--muted)]">UTF-8, Semikolon-getrennt, maximal 5 MB und 10.000 Fahrten.</p>
          </div>
          <div className="rounded-xl bg-[var(--warning-soft)] px-4 py-3 text-sm leading-6 text-[var(--warning-strong)]">Die Datei wird vollständig geprüft. Vor neuen Einträgen wird automatisch eine Sicherheitskopie erstellt; vorhandene Dubletten werden übersprungen.</div>
          {importError ? <p role="alert" className="status-enter rounded-xl border border-[var(--danger-line)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">{importError}</p> : null}
          {importSuccess ? <p className="status-enter rounded-xl border border-[var(--success-line)] bg-[var(--success-soft)] px-4 py-3 text-sm text-[var(--success-strong)]">{importSuccess}</p> : null}
          <button type="submit" className="btn-primary focus-ring w-full sm:w-auto" disabled={isImportPending || !file}><FontAwesomeIcon icon={faFileArrowUp} className="h-4 w-4" /> {isImportPending ? "CSV wird importiert …" : "CSV importieren"}</button>
        </form>
      </section>
    </div>
  );
}

function BackupsCard({ backups, setBackups, onRestored }: {
  backups: BackupDto[];
  setBackups: React.Dispatch<React.SetStateAction<BackupDto[]>>;
  onRestored: () => Promise<void>;
}) {
  const [restoreTarget, setRestoreTarget] = useState<BackupDto | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();

  function createManualBackup() {
    setError("");
    setSuccess("");
    startTransition(async () => {
      const response = await fetch("/api/backups", { method: "POST" });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Die Sicherung konnte nicht erstellt werden.");
        return;
      }
      setBackups((current) => [result.backup, ...current]);
      setSuccess("Die manuelle Sicherung wurde erfolgreich erstellt.");
    });
  }

  async function handleRestored(result: { routes: number; trips: number }) {
    setRestoreTarget(null);
    await onRestored();
    setSuccess(`Wiederherstellung abgeschlossen: ${result.routes} Reisewege und ${result.trips} Fahrten wurden übernommen.`);
  }

  return (
    <section className="overflow-hidden rounded-[20px] border border-[var(--line)] bg-[var(--surface)] shadow-[0_7px_24px_rgba(15,23,42,.045)]">
      <header className="flex flex-col gap-4 border-b border-[var(--line)] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div><h2 className="text-lg font-extrabold tracking-[-.02em]">Sicherungen</h2><p className="mt-1 text-sm text-[var(--muted)]">Automatisch einmal täglich sowie jederzeit manuell.</p></div>
        <button className="btn-primary focus-ring w-full sm:w-auto" type="button" onClick={createManualBackup} disabled={isPending}><FontAwesomeIcon icon={faPlus} className="h-4 w-4" />{isPending ? "Wird gesichert …" : "Jetzt sichern"}</button>
      </header>

      <div className="border-b border-[var(--line)] bg-[var(--primary-soft)] px-5 py-4 text-sm leading-6 text-[var(--primary)] sm:px-6">
        <strong>Automatischer Schutz aktiv.</strong> Beim ersten Zugriff nach 24 Stunden wird eine neue SQLite-Sicherung unter <code className="rounded bg-[var(--surface-overlay)] px-1.5 py-0.5">data/backups</code> angelegt. Sicherungen werden nicht automatisch gelöscht.
      </div>

      {error ? <p className="status-enter m-5 rounded-xl border border-[var(--danger-line)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">{error}</p> : null}
      {success ? <p className="status-enter m-5 rounded-xl border border-[var(--primary-muted)] bg-[var(--primary-soft)] px-4 py-3 text-sm text-[var(--primary)]">{success}</p> : null}

      {backups.length === 0 ? (
        <div className="px-6 py-14 text-center"><p className="font-bold">Noch keine Sicherung vorhanden</p><p className="mt-1 text-sm text-[var(--muted)]">Erstelle jetzt die erste manuelle Sicherung.</p></div>
      ) : (
        <div className="divide-y divide-[var(--divider)]">
          {backups.map((backup) => (
            <div key={backup.id} className="interactive-row flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex items-center gap-4">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">◴</span>
                <div><p className="font-extrabold">{backupKindLabel(backup.kind)}</p><p className="mt-0.5 text-xs text-[var(--muted)]">{formatBackupDate(backup.createdAt)} · {formatBytes(backup.sizeBytes)}</p></div>
              </div>
              <button type="button" className="btn-secondary focus-ring w-full sm:w-auto" onClick={() => { setSuccess(""); setError(""); setRestoreTarget(backup); }}>Wiederherstellen</button>
            </div>
          ))}
        </div>
      )}
      {restoreTarget ? <RestoreModal backup={restoreTarget} onClose={() => setRestoreTarget(null)} onRestored={handleRestored} /> : null}
    </section>
  );
}

function backupKindLabel(kind: BackupKind) {
  if (kind === "automatic") return "Automatische Sicherung";
  if (kind === "manual") return "Manuelle Sicherung";
  if (kind === "pre-restore") return "Sicherung vor Wiederherstellung";
  return "Sicherheitskopie";
}

function formatBackupDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB`;
}

function RestoreModal({ backup, onClose, onRestored }: { backup: BackupDto; onClose: () => void; onRestored: (result: { routes: number; trips: number }) => void }) {
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [isPending, startTransition] = useTransition();
  const canRestore = confirmation === "WIEDERHERSTELLEN" && currentPassword.length > 0;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canRestore) return;
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/backups/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backupId: backup.id, currentPassword, confirmation }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Die Sicherung konnte nicht wiederhergestellt werden.");
        return;
      }
      onRestored({ routes: result.routes, trips: result.trips });
    });
  }

  return (
    <Modal title="Sicherung wiederherstellen" description={formatBackupDate(backup.createdAt)} onClose={onClose}>
      {(requestClose) => (
      <form onSubmit={submit}>
        <div className="space-y-5 px-5 py-5 sm:px-7 sm:py-6">
          <div className="rounded-xl border border-[var(--warning-line)] bg-[var(--warning-soft)] px-4 py-3 text-sm leading-6 text-[var(--warning-strong)]"><strong>Der aktuelle Stand der Fahrten und Reisewege wird ersetzt.</strong> Vorher wird automatisch eine weitere Sicherheitskopie erstellt. Benutzername und Passwort bleiben unverändert.</div>
          <div><label className="label" htmlFor="restore-password">Aktuelles Passwort</label><input className="field" id="restore-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></div>
          <div><label className="label" htmlFor="restore-confirmation">Zur Bestätigung WIEDERHERSTELLEN eingeben</label><input className="field" id="restore-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" required /></div>
          {error ? <p role="alert" className="status-enter rounded-xl border border-[var(--danger-line)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">{error}</p> : null}
        </div>
        <footer className="sticky bottom-0 z-10 grid grid-cols-2 gap-2 border-t border-[var(--line)] bg-[var(--surface-muted)] px-5 py-4 sm:flex sm:justify-end sm:px-7"><button type="button" className="btn-secondary focus-ring" onClick={requestClose}>Abbrechen</button><button type="submit" className="btn-danger focus-ring" disabled={!canRestore || isPending}>{isPending ? "Wird wiederhergestellt …" : "Jetzt wiederherstellen"}</button></footer>
      </form>
      )}
    </Modal>
  );
}

function BackupCodesPanel({ codes, onDismiss }: { codes: string[]; onDismiss: () => void }) {
  const text = `Fahrtenbuch Backup-Codes\n\n${codes.join("\n")}\n\nJeder Code kann nur einmal verwendet werden.`;

  async function copyCodes() {
    await navigator.clipboard.writeText(codes.join("\n"));
  }

  function downloadCodes() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "fahrtenbuch-backup-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="status-enter rounded-2xl border border-[var(--primary-line)] bg-[var(--primary-soft)] p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--surface)] text-[var(--primary)] shadow-sm"><FontAwesomeIcon icon={faKey} className="h-5 w-5" /></span>
        <div><h3 className="font-extrabold text-[var(--hero)]">Backup-Codes jetzt sichern</h3><p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">Diese Codes werden nur dieses eine Mal angezeigt. Jeder Code kann genau einmal anstelle des Authenticator-Codes verwendet werden.</p></div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 rounded-xl border border-[var(--primary-muted)] bg-[var(--surface)] p-4 font-mono text-sm font-bold tracking-[.08em] text-[var(--ink)] sm:grid-cols-2">
        {codes.map((code) => <code key={code}>{code}</code>)}
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button type="button" className="btn-secondary focus-ring" onClick={() => void copyCodes()}><FontAwesomeIcon icon={faClipboard} className="h-4 w-4" /> Kopieren</button>
        <button type="button" className="btn-secondary focus-ring" onClick={downloadCodes}><FontAwesomeIcon icon={faDownload} className="h-4 w-4" /> Als Textdatei</button>
        <button type="button" className="btn-primary focus-ring sm:ml-auto" onClick={onDismiss}><FontAwesomeIcon icon={faCheck} className="h-4 w-4" /> Sicher verwahrt</button>
      </div>
    </div>
  );
}

function CredentialsCard({ username, initialTwoFactorStatus }: { username: string; initialTwoFactorStatus: TwoFactorStatusDto }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [twoFactorStatus, setTwoFactorStatus] = useState(initialTwoFactorStatus);
  const [setup, setSetup] = useState<TwoFactorSetupDto | null>(null);
  const [setupPassword, setSetupPassword] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [protectedAction, setProtectedAction] = useState<"disable" | "regenerate" | null>(null);
  const [isPending, startTransition] = useTransition();

  function submitCredentials(formData: FormData) {
    setError("");
    setSuccess("");
    const newPassword = String(formData.get("newPassword") ?? "");
    if (newPassword !== formData.get("confirmPassword")) { setError("Die neuen Passwörter stimmen nicht überein."); return; }
    startTransition(async () => {
      const response = await fetch("/api/settings/credentials", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: formData.get("currentPassword"), username: formData.get("username"), newPassword }) });
      const result = await response.json();
      if (!response.ok) { setError(result.error ?? "Die Zugangsdaten konnten nicht geändert werden."); return; }
      setSuccess("Zugangsdaten wurden erfolgreich geändert.");
      router.refresh();
    });
  }

  function startSetup(formData: FormData) {
    const currentPassword = String(formData.get("currentPassword") ?? "");
    setError("");
    setSuccess("");
    startTransition(async () => {
      const response = await fetch("/api/settings/two-factor/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword }) });
      const result = await response.json();
      if (!response.ok) { setError(result.error ?? "Die 2FA-Einrichtung konnte nicht gestartet werden."); return; }
      setSetupPassword(currentPassword);
      setSetup(result);
    });
  }

  function confirmSetup(formData: FormData) {
    if (!setup) return;
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/settings/two-factor/enable", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: setupPassword, secret: setup.secret, code: formData.get("code") }) });
      const result = await response.json();
      if (!response.ok) { setError(result.error ?? "2FA konnte nicht aktiviert werden."); return; }
      setTwoFactorStatus(result.status);
      setBackupCodes(result.backupCodes);
      setSetup(null);
      setSetupPassword("");
      setSuccess("Die Zwei-Faktor-Authentifizierung ist jetzt aktiv.");
    });
  }

  function runProtectedAction(formData: FormData) {
    if (!protectedAction) return;
    const action = protectedAction;
    setError("");
    setSuccess("");
    startTransition(async () => {
      const endpoint = action === "disable" ? "disable" : "backup-codes";
      const response = await fetch(`/api/settings/two-factor/${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: formData.get("currentPassword"), code: formData.get("code") }) });
      const result = await response.json();
      if (!response.ok) { setError(result.error ?? "Die 2FA-Einstellung konnte nicht geändert werden."); return; }
      if (action === "disable") {
        setTwoFactorStatus(result);
        setSuccess("Die Zwei-Faktor-Authentifizierung wurde deaktiviert.");
      } else {
        setTwoFactorStatus(result.status);
        setBackupCodes(result.backupCodes);
        setSuccess("Neue Backup-Codes wurden erzeugt. Alle bisherigen Codes sind ungültig.");
      }
      setProtectedAction(null);
    });
  }

  return (
    <div className="space-y-5">
      {error ? <p role="alert" className="status-enter rounded-xl border border-[var(--danger-line)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">{error}</p> : null}
      {success ? <p className="status-enter rounded-xl border border-[var(--primary-muted)] bg-[var(--primary-soft)] px-4 py-3 text-sm text-[var(--primary)]">{success}</p> : null}
      {backupCodes.length > 0 ? <BackupCodesPanel codes={backupCodes} onDismiss={() => setBackupCodes([])} /> : null}

      <div className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
        <section className="overflow-hidden rounded-[20px] border border-[var(--line)] bg-[var(--surface)] shadow-[0_7px_24px_rgba(15,23,42,.045)]">
          <header className="flex items-start gap-3 border-b border-[var(--line)] px-5 py-5 sm:px-6"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]"><FontAwesomeIcon icon={faKey} className="h-5 w-5" /></span><div><h2 className="text-lg font-extrabold tracking-[-.02em]">Benutzername & Passwort</h2><p className="mt-1 text-sm text-[var(--muted)]">Aktualisiere deine persönlichen Zugangsdaten.</p></div></header>
          <form action={submitCredentials} className="px-5 py-5 sm:px-6 sm:py-6">
            <div className="space-y-4">
              <div><label className="label" htmlFor="settings-username">Benutzername</label><input className="field" id="settings-username" name="username" minLength={3} maxLength={80} defaultValue={username} required autoComplete="username" /></div>
              <div><label className="label" htmlFor="settings-current-password">Aktuelles Passwort</label><input className="field" id="settings-current-password" name="currentPassword" type="password" required autoComplete="current-password" /></div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <div><label className="label" htmlFor="settings-new-password">Neues Passwort</label><input className="field" id="settings-new-password" name="newPassword" type="password" minLength={8} required autoComplete="new-password" /></div>
                <div><label className="label" htmlFor="settings-confirm-password">Passwort wiederholen</label><input className="field" id="settings-confirm-password" name="confirmPassword" type="password" minLength={8} required autoComplete="new-password" /></div>
              </div>
            </div>
            <div className="mt-5 flex justify-end"><button className="btn-primary focus-ring w-full sm:w-auto" type="submit" disabled={isPending}>{isPending ? "Speichern …" : "Zugangsdaten speichern"}</button></div>
          </form>
        </section>

        <section className="overflow-hidden rounded-[20px] border border-[var(--line)] bg-[var(--surface)] shadow-[0_7px_24px_rgba(15,23,42,.045)]">
          <header className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-5 py-5 sm:px-6">
            <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]"><FontAwesomeIcon icon={faShieldHalved} className="h-5 w-5" /></span><div><h2 className="text-lg font-extrabold tracking-[-.02em]">Zwei-Faktor-Authentifizierung</h2><p className="mt-1 text-sm text-[var(--muted)]">Zusätzlicher Schutz durch eine Authenticator-App.</p></div></div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold ${twoFactorStatus.enabled ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--surface-hover)] text-[var(--muted)]"}`}>{twoFactorStatus.enabled ? "Aktiv" : "Inaktiv"}</span>
          </header>
          <div className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
            {setup ? (
              <form action={confirmSetup} className="space-y-5">
                <div className="rounded-2xl border border-[var(--primary-muted)] bg-[var(--surface-muted)] p-4">
                  <div className="flex items-center gap-2 font-extrabold text-[var(--hero)]"><FontAwesomeIcon icon={faQrcode} className="h-4 w-4" /> Authenticator verbinden</div>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Scanne den QR-Code und bestätige anschließend den sechsstelligen Code deiner App.</p>
                  <div className="mt-4 grid place-items-center rounded-xl bg-[var(--logo-surface)] p-4"><Image src={setup.qrCodeDataUrl} alt="QR-Code für die Authenticator-App" width={240} height={240} unoptimized /></div>
                  <details className="mt-3 text-sm text-[var(--text-secondary)]"><summary className="cursor-pointer font-bold">Manuellen Schlüssel anzeigen</summary><code className="mt-2 block break-all rounded-lg bg-[var(--surface)] p-3 font-mono text-xs">{setup.secret}</code></details>
                </div>
                <div><label className="label" htmlFor="two-factor-setup-code">Code aus der Authenticator-App</label><input className="field text-center font-mono text-lg tracking-[.25em]" id="two-factor-setup-code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus /></div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" className="btn-secondary focus-ring" onClick={() => { setSetup(null); setSetupPassword(""); }}>Abbrechen</button><button type="submit" className="btn-primary focus-ring" disabled={isPending}>2FA aktivieren</button></div>
              </form>
            ) : protectedAction ? (
              <form action={runProtectedAction} className="space-y-4">
                <div className={`rounded-xl px-4 py-3 text-sm leading-6 ${protectedAction === "disable" ? "border border-[var(--danger-line)] bg-[var(--danger-soft)] text-[var(--danger-strong)]" : "border border-[var(--warning-line)] bg-[var(--warning-soft)] text-[var(--warning-strong)]"}`}><FontAwesomeIcon icon={faTriangleExclamation} className="mr-2 h-4 w-4" />{protectedAction === "disable" ? "Nach der Deaktivierung genügt wieder nur dein Passwort zur Anmeldung." : "Alle bisherigen Backup-Codes werden sofort ungültig."}</div>
                <div><label className="label" htmlFor="two-factor-action-password">Aktuelles Passwort</label><input className="field" id="two-factor-action-password" name="currentPassword" type="password" autoComplete="current-password" required /></div>
                <div><label className="label" htmlFor="two-factor-action-code">Authenticator- oder Backup-Code</label><input className="field font-mono tracking-[.12em]" id="two-factor-action-code" name="code" autoComplete="one-time-code" maxLength={32} required /></div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" className="btn-secondary focus-ring" onClick={() => setProtectedAction(null)}>Abbrechen</button><button type="submit" className={protectedAction === "disable" ? "btn-danger focus-ring" : "btn-primary focus-ring"} disabled={isPending}>{protectedAction === "disable" ? "2FA deaktivieren" : "Neue Codes erzeugen"}</button></div>
              </form>
            ) : twoFactorStatus.enabled ? (
              <>
                <div className="rounded-xl border border-[var(--success-line)] bg-[var(--success-soft)] px-4 py-3 text-sm leading-6 text-[var(--success-strong)]"><strong>Dein Zugang ist zusätzlich geschützt.</strong> Nach dem Passwort wird bei jeder neuen Anmeldung ein Authenticator- oder Backup-Code verlangt.</div>
                <div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-[var(--surface-muted)] p-4"><p className="text-xs font-bold uppercase tracking-[.08em] text-[var(--muted)]">Backup-Codes</p><p className="mt-1 text-xl font-extrabold">{twoFactorStatus.remainingBackupCodes}</p><p className="text-xs text-[var(--muted)]">noch verfügbar</p></div><div className="rounded-xl bg-[var(--surface-muted)] p-4"><p className="text-xs font-bold uppercase tracking-[.08em] text-[var(--muted)]">Aktiv seit</p><p className="mt-1 text-sm font-extrabold">{twoFactorStatus.enabledAt ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(twoFactorStatus.enabledAt)) : "–"}</p></div></div>
                <div className="flex flex-col gap-2 sm:flex-row"><button type="button" className="btn-secondary focus-ring flex-1" onClick={() => setProtectedAction("regenerate")}><FontAwesomeIcon icon={faKey} className="h-4 w-4" /> Neue Backup-Codes</button><button type="button" className="btn-danger focus-ring" onClick={() => setProtectedAction("disable")}>2FA deaktivieren</button></div>
              </>
            ) : (
              <form action={startSetup} className="space-y-4">
                <p className="text-sm leading-6 text-[var(--muted)]">Nach der Aktivierung benötigst du bei der Anmeldung zusätzlich einen zeitbasierten Code aus einer kompatiblen Authenticator-App.</p>
                <div className="rounded-xl bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text-secondary)]"><strong>Bereithalten:</strong> Authenticator-App und dein aktuelles Passwort.</div>
                <div><label className="label" htmlFor="two-factor-current-password">Aktuelles Passwort</label><input className="field" id="two-factor-current-password" name="currentPassword" type="password" autoComplete="current-password" required /></div>
                <button type="submit" className="btn-primary focus-ring w-full" disabled={isPending}><FontAwesomeIcon icon={faQrcode} className="h-4 w-4" /> 2FA einrichten</button>
              </form>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function RouteModal({ route, onClose, onSaved }: { route?: RoutePairDto; onClose: () => void; onSaved: () => void }) {
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [distanceKm, setDistanceKm] = useState(route ? String(route.distanceKm) : "");
  const [reimbursedKm, setReimbursedKm] = useState(route ? String(route.reimbursedKm) : "");
  const [isPending, startTransition] = useTransition();
  const parsedDistanceKm = Number(distanceKm);
  const parsedReimbursedKm = Number(reimbursedKm);
  const calculatedUnreimbursedKm = distanceKm !== "" && reimbursedKm !== "" && Number.isInteger(parsedDistanceKm) && Number.isInteger(parsedReimbursedKm)
    ? Math.max(parsedDistanceKm - parsedReimbursedKm, 0)
    : null;

  function submit(formData: FormData) {
    setError("");
    startTransition(async () => {
      const response = await fetch(route ? `/api/routes/${route.id}` : "/api/routes", { method: route ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ placeA: formData.get("placeA"), placeB: formData.get("placeB"), distanceKm: Number(formData.get("distanceKm")), reimbursedKm: Number(formData.get("reimbursedKm")), durationMinutes: Number(formData.get("durationMinutes")) }) });
      const result = await response.json();
      if (!response.ok) { setError(result.error ?? "Der Reiseweg konnte nicht gespeichert werden."); return; }
      onSaved();
    });
  }

  function remove() {
    if (!route) return;
    startTransition(async () => {
      const response = await fetch(`/api/routes/${route.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) { setError(result.error ?? "Der Reiseweg konnte nicht archiviert werden."); return; }
      onSaved();
    });
  }

  return (
    <Modal title={route ? "Reiseweg bearbeiten" : "Reiseweg anlegen"} description="Die Gegenrichtung wird automatisch mit denselben Kilometerwerten angelegt." onClose={onClose}>
      {(requestClose) => (
      <form action={submit}>
        <div className="space-y-5 px-5 py-5 sm:px-7 sm:py-6">
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
            <RouteField id="route-place-a" name="placeA" label="Ort A" icon={faLocationDot} help="Start- oder Zielort des Reisewegs." defaultValue={route?.placeA} maxLength={120} required autoFocus />
            <span className="hidden pb-3 text-[var(--muted)] sm:block"><FontAwesomeIcon icon={faArrowsLeftRight} className="h-4 w-4" /></span>
            <RouteField id="route-place-b" name="placeB" label="Ort B" icon={faLocationDot} help="Der zweite Ort des Reisewegs." defaultValue={route?.placeB} maxLength={120} required />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <RouteField id="route-distance" name="distanceKm" label="KM gesamt" icon={faRoad} help="Gesamte gefahrene Strecke für eine Richtung." type="number" min="1" step="1" value={distanceKm} onChange={(event) => setDistanceKm(event.target.value)} required />
            <RouteField id="route-reimbursed" name="reimbursedKm" label="KM abrechenbar" icon={faReceipt} help="Kilometer, die beim Arbeitgeber abgerechnet werden können." type="number" min="0" step="1" value={reimbursedKm} onChange={(event) => setReimbursedKm(event.target.value)} required />
            <RouteField id="route-unreimbursed" label="KM nicht abrechenbar" icon={faCircleInfo} help="Wird automatisch aus Gesamt- minus abrechenbaren Kilometern berechnet." className="font-bold text-[var(--primary)]" readOnly value={calculatedUnreimbursedKm === null ? "–" : `${calculatedUnreimbursedKm} km`} />
            <RouteField id="route-duration" name="durationMinutes" label="Fahrtdauer in Minuten" icon={faClock} help="Übliche Fahrtdauer für eine Richtung." type="number" min="1" max="1439" step="1" defaultValue={route?.durationMinutes || ""} required />
          </div>
          <div className="rounded-xl bg-[var(--primary-soft)] px-4 py-3 text-sm leading-6 text-[var(--primary)]">Nach dem Speichern stehen <strong>Ort A → Ort B</strong> und <strong>Ort B → Ort A</strong> zur Auswahl.</div>
          {error ? <p className="status-enter rounded-xl border border-[var(--danger-line)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">{error}</p> : null}
          {confirmDelete ? <div className="status-enter flex items-center justify-between rounded-xl border border-[var(--danger-line)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger-strong)]"><span>Reiseweg wirklich archivieren?</span><button type="button" className="btn-danger min-h-8 px-3 py-1" onClick={remove} disabled={isPending}>Archivieren</button></div> : null}
        </div>
        <footer className="sticky bottom-0 z-10 flex flex-col-reverse gap-3 border-t border-[var(--line)] bg-[var(--surface-muted)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7"><div>{route && !confirmDelete ? <button type="button" className="btn-danger focus-ring" onClick={() => setConfirmDelete(true)}>Reiseweg archivieren</button> : null}</div><div className="grid grid-cols-2 gap-2 sm:flex"><button type="button" className="btn-secondary focus-ring" onClick={requestClose}>Abbrechen</button><button type="submit" className="btn-primary focus-ring" disabled={isPending}>{isPending ? "Speichern …" : "Speichern"}</button></div></footer>
      </form>
      )}
    </Modal>
  );
}

function RouteField({ id, label, icon, help, className = "", ...inputProps }: {
  id: string;
  label: string;
  icon: IconDefinition;
  help: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "id">) {
  const helpId = `${id}-help`;
  return (
    <div>
      <label className="label flex items-center gap-2" htmlFor={id}>
        <FontAwesomeIcon icon={icon} className="h-3.5 w-3.5 text-[var(--primary)]" />
        {label}
      </label>
      <div className="relative">
        <input {...inputProps} className={`field pr-11 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${className}`} id={id} aria-describedby={helpId} />
        <button type="button" className="peer focus-ring absolute right-2.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary)] focus:bg-[var(--primary-soft)] focus:text-[var(--primary)]" aria-label={`Info zu ${label}`}>
          <FontAwesomeIcon icon={faCircleInfo} className="h-4 w-4" />
        </button>
        <span id={helpId} role="tooltip" className="pointer-events-none invisible absolute right-0 top-[calc(100%+6px)] z-30 w-max max-w-[240px] rounded-lg bg-[var(--tooltip)] px-3 py-2 text-xs font-semibold leading-4 text-[var(--tooltip-text)] opacity-0 shadow-lg transition-opacity peer-hover:visible peer-hover:opacity-100 peer-focus:visible peer-focus:opacity-100">
          {help}
        </span>
      </div>
    </div>
  );
}
