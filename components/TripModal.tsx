"use client";

import { faChevronDown, faClock, faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import type { RemarkSettingsDto, RouteOptionDto, TripDto } from "@/lib/types";
import { normalizeTimeInput } from "@/lib/time-input";
import { searchRouteOptions } from "@/lib/route-options";
import { Modal } from "./Modal";
import { useAnimatedPresence } from "./useAnimatedPresence";

export const PICKER_HOURS = Array.from({ length: 13 }, (_, index) => String(index + 6).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, "0"));

function calculateEndTime(startTime: string, durationMinutes: number) {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(startTime) || durationMinutes <= 0) return "";
  const startMinutes = Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3, 5));
  const endMinutes = startMinutes + durationMinutes;
  if (endMinutes >= 24 * 60) return "";
  return `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
}

function TimeField({ id, label, value, alignRight = false, onChange }: {
  id: string;
  label: string;
  value: string;
  alignRight?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pickerStep, setPickerStep] = useState<"hour" | "minute">("hour");
  const containerRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [pickerPosition, setPickerPosition] = useState<{ left: number; top: number } | null>(null);
  const pickerPresence = useAnimatedPresence(open);
  const validTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
  const hour = validTime ? value.slice(0, 2) : "";
  const minute = validTime ? value.slice(3, 5) : "";

  useEffect(() => {
    if (!open) return;
    function closeOnOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      if (containerRef.current && !containerRef.current.contains(target) && !pickerRef.current?.contains(target)) setOpen(false);
    }
    function updatePosition() {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = 280;
      const gap = 8;
      const viewportPadding = 8;
      const preferredLeft = alignRight ? rect.right - width : rect.left;
      const left = Math.max(viewportPadding, Math.min(preferredLeft, window.innerWidth - width - viewportPadding));
      const pickerHeight = pickerRef.current?.offsetHeight ?? 370;
      const fitsBelow = rect.bottom + gap + pickerHeight <= window.innerHeight - viewportPadding;
      const top = fitsBelow ? rect.bottom + gap : Math.max(viewportPadding, rect.top - pickerHeight - gap);
      setPickerPosition({ left, top });
    }
    updatePosition();
    document.addEventListener("mousedown", closeOnOutsideClick);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [alignRight, open]);

  function selectHour(nextHour: string) {
    onChange(`${nextHour}:${minute || "00"}`);
    setPickerStep("minute");
  }

  function selectMinute(nextMinute: string) {
    if (!hour) return;
    onChange(`${hour}:${nextMinute}`);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="label" htmlFor={id}>{label}</label>
      <div className={`flex rounded-xl border bg-[var(--surface)] transition-[border-color,box-shadow] ${open ? "border-[var(--focus)] shadow-[0_0_0_3px_rgba(37,99,235,.10)]" : "border-[var(--line)]"}`}>
        <input
          className="min-w-0 flex-1 bg-transparent py-[11px] pl-3 pr-1 tabular-nums text-[var(--ink)] outline-none"
          id={id}
          type="text"
          inputMode="numeric"
          placeholder="HH:MM"
          maxLength={5}
          pattern="(?:[01][0-9]|2[0-3]):[0-5][0-9]"
          title="Uhrzeit als HH:MM oder vier Ziffern eingeben, zum Beispiel 0815 für 08:15."
          value={value}
          required
          autoComplete="off"
          onChange={(event) => { onChange(normalizeTimeInput(event.target.value)); setOpen(false); }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && open) {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
            }
          }}
        />
        <button type="button" className="focus-ring m-1 grid w-9 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--primary-soft)]" aria-label={`${label}-Auswahl öffnen`} onClick={() => setOpen((current) => !current)}>
          <FontAwesomeIcon icon={faClock} className="h-[18px] w-[18px]" />
        </button>
      </div>

      {pickerPresence.rendered && pickerPosition ? createPortal(
        <div ref={pickerRef} data-state={pickerPresence.state} className="popover fixed z-[70] w-[280px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[0_18px_45px_rgba(15,23,42,.18)]" style={pickerPosition}>
          <div className="mb-4 flex justify-center rounded-xl bg-[var(--primary)] p-3 text-center text-3xl font-extrabold tabular-nums text-[var(--primary-contrast)]"><button type="button" className={`focus-ring rounded-lg px-3 ${pickerStep === "hour" ? "bg-white/20" : ""}`} onClick={() => setPickerStep("hour")}>{hour || "--"}</button><span className="py-0.5">:</span><button type="button" className={`focus-ring rounded-lg px-3 ${pickerStep === "minute" ? "bg-white/20" : ""}`} onClick={() => setPickerStep("minute")} disabled={!hour}>{minute || "00"}</button></div>
          <p className="mb-3 text-center text-xs font-extrabold uppercase tracking-[.12em] text-[var(--muted)]">{pickerStep === "hour" ? "Stunde wählen" : "Minute wählen"}</p>
          <div className="relative mx-auto h-[230px] w-[230px] rounded-full bg-[var(--primary-soft)]" role="listbox" aria-label={`${label}: ${pickerStep === "hour" ? "Stunde" : "Minute"}`}>
            <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--primary)]" />
            {(pickerStep === "hour" ? PICKER_HOURS : MINUTES).map((option, index, choices) => {
              const angle = (index / choices.length) * Math.PI * 2 - Math.PI / 2;
              const radius = 42;
              const selected = option === (pickerStep === "hour" ? hour : minute);
              return <button key={option} type="button" role="option" aria-selected={selected} className={`focus-ring absolute grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-xs font-extrabold tabular-nums ${selected ? "bg-[var(--primary)] text-[var(--primary-contrast)] shadow-md" : "text-[var(--ink-soft)] hover:bg-[var(--surface)]"}`} style={{ left: `${50 + Math.cos(angle) * radius}%`, top: `${50 + Math.sin(angle) * radius}%` }} onMouseDown={(event) => event.preventDefault()} onClick={() => pickerStep === "hour" ? selectHour(option) : selectMinute(option)}>{option}</button>;
            })}
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}

function RouteCombobox({ value, options, onTextChange, onSelect }: {
  value: string;
  options: RouteOptionDto[];
  onTextChange: (value: string) => void;
  onSelect: (option: RouteOptionDto) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuPresence = useAnimatedPresence(open);
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);
  const hasExactSelection = options.some((option) => option.label === value);
  const filteredOptions = searchRouteOptions(options, hasExactSelection ? "" : value);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      if (containerRef.current && !containerRef.current.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  useEffect(() => {
    if (!open) return;
    function updatePosition() {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const viewportPadding = 16;
      const menuGap = 8;
      const availableBelow = window.innerHeight - rect.bottom - viewportPadding;
      const availableAbove = rect.top - viewportPadding;
      const openAbove = availableBelow < 220 && availableAbove > availableBelow;
      const maxHeight = Math.min(420, Math.max(180, openAbove ? availableAbove - menuGap : availableBelow));
      setMenuPosition({
        left: rect.left,
        top: openAbove ? Math.max(viewportPadding, rect.top - maxHeight - menuGap) : rect.bottom + menuGap,
        width: rect.width,
        maxHeight,
      });
    }
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  function select(option: RouteOptionDto) {
    onSelect(option);
    setOpen(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      return;
    }
    if (event.key === "Enter" && open && filteredOptions.length === 1) {
      event.preventDefault();
      select(filteredOptions[0]);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className={`flex rounded-xl border bg-[var(--surface)] transition-[border-color,box-shadow] ${open ? "border-[var(--focus)] shadow-[0_0_0_3px_rgba(37,99,235,.10)]" : "border-[var(--line)]"}`}>
        <span className="grid w-11 shrink-0 place-items-center text-[var(--muted)]" aria-hidden="true">
          <FontAwesomeIcon icon={faMagnifyingGlass} className="h-[18px] w-[18px]" />
        </span>
        <input
          className="min-w-0 flex-1 bg-transparent py-[11px] pr-2 text-[var(--ink)] outline-none"
          id="trip-route"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="route-option-list"
          value={value}
          placeholder="Reiseweg suchen oder auswählen …"
          required
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(event) => { onTextChange(event.target.value); setOpen(true); }}
          onKeyDown={handleKeyDown}
        />
        <button type="button" className="focus-ring m-1 grid w-9 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--primary-soft)]" aria-label="Reisewege öffnen" onClick={() => setOpen((current) => !current)}>
          <FontAwesomeIcon icon={faChevronDown} className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {menuPresence.rendered && menuPosition ? createPortal(
        <div ref={menuRef} data-state={menuPresence.state} id="route-option-list" role="listbox" className="popover fixed z-[60] overflow-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-[0_18px_45px_rgba(15,23,42,.18)]" style={menuPosition}>
          {filteredOptions.length > 0 ? filteredOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.label === value}
              className="focus-ring flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-left transition-colors hover:bg-[var(--primary-soft)] focus:bg-[var(--primary-soft)]"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => select(option)}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-extrabold text-[var(--ink-soft)]">{option.origin}<span className="mx-2 text-[var(--muted)]">→</span>{option.destination}</span>
                <span className="mt-0.5 block text-xs text-[var(--muted)]">{option.durationMinutes > 0 ? `${option.durationMinutes} Min. Fahrtdauer` : "Fahrtdauer noch nicht hinterlegt"}</span>
              </span>
              <span className="ml-4 shrink-0 rounded-lg bg-[var(--primary-soft)] px-2.5 py-1 text-xs font-extrabold text-[var(--primary)]">{option.distanceKm} km</span>
            </button>
          )) : (
            <div className="px-4 py-5 text-center text-sm text-[var(--muted)]">Kein passender Reiseweg gefunden.</div>
          )}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}

export function TripModal({ trip, defaultDate, suggestedOdometerStart, routeOptions, onClose, onSaved }: {
  trip?: TripDto;
  month: string;
  defaultDate: string;
  suggestedOdometerStart: number | null;
  routeOptions: RouteOptionDto[];
  onClose: () => void;
  onSaved: (date: string) => void;
}) {
  const currentLabel = trip?.routeLabel ?? "";
  const [date, setDate] = useState(trip?.date ?? defaultDate);
  const [startTime, setStartTime] = useState(trip?.startTime ?? "");
  const [endTime, setEndTime] = useState(trip?.endTime ?? "");
  const [routeInput, setRouteInput] = useState(currentLabel);
  const [selectedRoute, setSelectedRoute] = useState<RouteOptionDto | null>(null);
  const [routeChanged, setRouteChanged] = useState(false);
  const [odometerStart, setOdometerStart] = useState(String(trip?.odometerStart ?? suggestedOdometerStart ?? ""));
  const odometerTouchedRef = useRef(Boolean(trip));
  const [error, setError] = useState("");
  const [accompanyingStaff, setAccompanyingStaff] = useState(trip?.accompanyingStaff ?? "");
  const [remark, setRemark] = useState(trip?.remark ?? "");
  const [remarkSettings, setRemarkSettings] = useState<RemarkSettingsDto | null>(null);
  const [selectedRemarkId, setSelectedRemarkId] = useState("");
  const remarkTouched = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    async function loadRemarks() {
      try {
        const response = await fetch("/api/settings/remarks", { signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Bemerkungsvorlagen konnten nicht geladen werden.");
        if (controller.signal.aborted) return;
        setRemarkSettings(result);
        if (!trip && !remarkTouched.current) {
          const template = (result as RemarkSettingsDto).templates.find((item) => item.id === result.defaultTemplateId);
          setRemark(template?.text ?? "");
          setSelectedRemarkId(template ? String(template.id) : "");
        }
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Bemerkungsvorlagen konnten nicht geladen werden.");
      }
    }
    void loadRemarks();
    return () => controller.abort();
  }, [trip]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  const distanceKm = selectedRoute?.distanceKm ?? trip?.distanceKm ?? 0;
  const odometerNumber = Number(odometerStart);
  const odometerEnd = Number.isInteger(odometerNumber) && odometerStart !== "" ? odometerNumber + distanceKm : null;

  async function suggestOdometer(nextDate: string, nextStartTime: string) {
    if (odometerTouchedRef.current) return;
    const query = new URLSearchParams({ date: nextDate });
    if (nextStartTime) query.set("startTime", nextStartTime);
    const response = await fetch(`/api/trips/suggested-odometer?${query}`);
    if (!response.ok) return;
    const result = await response.json();
    if (!odometerTouchedRef.current) {
      setOdometerStart(result.odometerStart === null ? "" : String(result.odometerStart));
    }
  }

  function changeRouteText(value: string) {
    setRouteInput(value);
    setSelectedRoute(null);
    setRouteChanged(true);
  }

  function chooseRoute(option: RouteOptionDto) {
    setRouteInput(option.label);
    setSelectedRoute(option);
    setRouteChanged(true);
    if (!trip) setEndTime(calculateEndTime(startTime, option.durationMinutes));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if ((!trip || routeChanged) && !selectedRoute) {
      setError("Bitte wähle einen vorhandenen Reiseweg aus der Liste.");
      return;
    }
    if (!trip && !endTime) {
      setError("Für diesen Reiseweg fehlt eine Fahrtdauer oder die Fahrt würde über Mitternacht hinausgehen.");
      return;
    }
    const payload: Record<string, unknown> = {
      accompanyingStaff,
      remark,
      date,
      startTime,
      endTime,
      odometerStart: Number(odometerStart),
    };
    if (!trip || routeChanged) {
      payload.routePairId = selectedRoute!.routePairId;
      payload.direction = selectedRoute!.direction;
    }
    startTransition(async () => {
      const response = await fetch(trip ? `/api/trips/${trip.id}` : "/api/trips", {
        method: trip ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Die Fahrt konnte nicht gespeichert werden.");
        return;
      }
      onSaved(date);
    });
  }

  function remove() {
    if (!trip) return;
    setError("");
    startTransition(async () => {
      const response = await fetch(`/api/trips/${trip.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Die Fahrt konnte nicht gelöscht werden.");
        return;
      }
      onSaved(trip.date);
    });
  }

  return (
    <Modal title={trip ? "Fahrt bearbeiten" : "Neue Fahrt"} description={trip ? "Passe die Angaben an oder lösche den Eintrag." : "Erfasse deine Dienstfahrt in wenigen Schritten."} size="wide" onClose={onClose}>
      {(requestClose) => (
      <form onSubmit={submit}>
        <div className="space-y-5 px-5 py-5 sm:px-7 sm:py-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="trip-date">Datum</label>
              <input className="field" id="trip-date" type="date" value={date} required onChange={(event) => { setDate(event.target.value); void suggestOdometer(event.target.value, startTime); }} />
            </div>
            <TimeField id="trip-start" label="Beginn" value={startTime} onChange={(nextValue) => { setStartTime(nextValue); if (!trip && selectedRoute) setEndTime(calculateEndTime(nextValue, selectedRoute.durationMinutes)); if (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(nextValue)) void suggestOdometer(date, nextValue); }} />
            {trip ? <TimeField id="trip-end" label="Ende" value={endTime} alignRight onChange={setEndTime} /> : <div><label className="label" htmlFor="trip-end">Ende (automatisch)</label><input className="field bg-[var(--surface-muted)] font-bold text-[var(--primary)]" id="trip-end" readOnly value={endTime || "–"} /></div>}
          </div>

          <div>
            <label className="label" htmlFor="trip-route">Reiseweg</label>
            <RouteCombobox value={routeInput} options={routeOptions} onTextChange={changeRouteText} onSelect={chooseRoute} />
            <p className="mt-2 text-xs text-[var(--muted)]">Nur zuvor angelegte Reisewege können ausgewählt werden.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="trip-odo-start">KM Beginn</label>
              <input className="field bg-[var(--surface)]" id="trip-odo-start" type="number" min="0" step="1" value={odometerStart} required onChange={(event) => { setOdometerStart(event.target.value); odometerTouchedRef.current = true; }} />
            </div>
            <div>
              <label className="label" htmlFor="trip-distance">KM gesamt</label>
              <input className="field" id="trip-distance" readOnly value={distanceKm ? `${distanceKm} km` : "–"} />
            </div>
            <div>
              <label className="label" htmlFor="trip-odo-end">KM Ende</label>
              <input className="field font-bold text-[var(--primary)]" id="trip-odo-end" readOnly value={odometerEnd === null ? "–" : odometerEnd.toLocaleString("de-DE")} />
            </div>
          </div>

          {error ? <p role="alert" className="status-enter rounded-xl border border-[var(--danger-line)] bg-[var(--danger-soft)] px-4 py-3 text-sm font-medium text-[var(--danger)]">{error}</p> : null}
          <div>
            <label className="label" htmlFor="trip-staff">Mitgenommene Bedienstete</label>
            <textarea id="trip-staff" className="field" rows={2} maxLength={2000} value={accompanyingStaff} onChange={(event) => setAccompanyingStaff(event.target.value)} />
          </div>
          <div className="space-y-3">
            <div>
              <label className="label" htmlFor="trip-remark-template">Bemerkungsvorlage</label>
              <select id="trip-remark-template" className="field" value={selectedRemarkId} disabled={!remarkSettings} onChange={(event) => {
                const id = event.target.value;
                setSelectedRemarkId(id);
                remarkTouched.current = true;
                setRemark(remarkSettings?.templates.find((template) => String(template.id) === id)?.text ?? "");
              }}>
                <option value="">{remarkSettings ? "Keine Vorlage / eigener Text" : "Vorlagen werden geladen …"}</option>
                {remarkSettings?.templates.map((template) => <option key={template.id} value={template.id}>{template.text}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="trip-remark">Bemerkung</label>
              <textarea id="trip-remark" className="field" rows={3} maxLength={2000} value={remark} onChange={(event) => { remarkTouched.current = true; setSelectedRemarkId(""); setRemark(event.target.value); }} />
              <p className="mt-2 text-xs text-[var(--muted)]">Vorlagentexte kannst du frei bearbeiten oder ergänzen.</p>
            </div>
          </div>
          {confirmDelete ? (
            <div className="status-enter flex flex-col gap-3 rounded-xl border border-[var(--danger-line)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger-strong)] sm:flex-row sm:items-center sm:justify-between">
              <span>Diese Fahrt wirklich dauerhaft löschen?</span>
              <div className="flex gap-2">
                <button type="button" className="btn-ghost min-h-8 px-3 py-1" onClick={() => setConfirmDelete(false)}>Abbrechen</button>
                <button type="button" className="btn-danger min-h-8 px-3 py-1" onClick={remove} disabled={isPending}>Löschen</button>
              </div>
            </div>
          ) : null}
        </div>

        <footer className="sticky bottom-0 z-10 flex flex-col-reverse gap-3 border-t border-[var(--line)] bg-[var(--surface-muted)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div>{trip && !confirmDelete ? <button type="button" className="btn-danger focus-ring" onClick={() => setConfirmDelete(true)}>Fahrt löschen</button> : null}</div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
            <button type="button" className="btn-secondary focus-ring" onClick={requestClose}>Abbrechen</button>
            <button type="submit" className="btn-primary focus-ring min-w-28" disabled={isPending || !remarkSettings}>{isPending ? "Speichern …" : "Speichern"}</button>
          </div>
        </footer>
      </form>
      )}
    </Modal>
  );
}
