import { TripPlaceNote } from "./TripPlaceNote";
import { TRIP_COLUMNS, TRIP_SCREEN_COLUMN_WIDTHS, TRIP_PRINT_COLUMN_WIDTHS, TRIP_TEXT_COLUMN_IDS, tripColumnTotal, tripColumnValue, type TripColumnId } from "@/lib/trip-columns";
import type { MonthDataDto, TripDto } from "@/lib/types";
import type { ReactNode } from "react";

export function TripValue({ trip, column }: { trip: TripDto; column: TripColumnId }) {
  return <>{tripColumnValue(trip, column)}{column === "routeLabel" ? <TripPlaceNote originFullName={trip.originFullName} destinationFullName={trip.destinationFullName} /> : null}</>;
}
export function TripFields({ trip, visibleColumns }: { trip: TripDto; visibleColumns: TripColumnId[] }) {
  return <span className="grid min-w-0 grid-cols-2 gap-3 text-sm">{TRIP_COLUMNS.filter((column) => visibleColumns.includes(column.id)).map((column) => <span key={column.id} className={`min-w-0 ${["routeLabel", "accompanyingStaff", "remark"].includes(column.id) ? "col-span-2" : ""}`}>
    <span className="block text-[10px] font-bold uppercase text-[var(--muted)]">{column.label}</span>
    <span className="mt-1 block whitespace-pre-wrap font-semibold [overflow-wrap:anywhere]"><TripValue trip={trip} column={column.id} /></span>
  </span>)}</span>;
}
export function TripSummary({ data, visibleColumns }: { data: MonthDataDto; visibleColumns: TripColumnId[] }) {
  const columns = TRIP_COLUMNS.filter((column) => visibleColumns.includes(column.id) && tripColumnTotal(data, column.id) !== null);
  return columns.length ? <div className="mt-4 rounded-xl bg-[var(--primary-soft)] p-4" aria-label="Gesamt im Monat"><p className="mb-2 text-xs font-extrabold">Gesamt im Monat</p><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{columns.map((column) => <div key={column.id}><p className="text-[10px] font-bold text-[var(--muted)]">{column.label}</p><p className="font-extrabold">{tripColumnTotal(data, column.id)}</p></div>)}</div></div> : null;
}
export function TripTable({ data, visibleColumns, onEdit, action, print = false, showTotals = true }: {
  data: MonthDataDto; visibleColumns: TripColumnId[]; onEdit?: (trip: TripDto) => void;
  action?: (trip: TripDto) => ReactNode; print?: boolean; showTotals?: boolean;
}) {
  const columns = TRIP_COLUMNS.filter((column) => visibleColumns.includes(column.id));
  const firstTotal = columns.findIndex((column) => tripColumnTotal(data, column.id) !== null);
  const widths = print ? TRIP_PRINT_COLUMN_WIDTHS : TRIP_SCREEN_COLUMN_WIDTHS;
  const flexibleColumns = columns.filter((column) => TRIP_TEXT_COLUMN_IDS.includes(column.id));
  const minimumWidth = columns.reduce((sum, column) => sum + widths[column.id], 0) + (action ? 44 : 0);
  const flexibleWeight = flexibleColumns.reduce((sum, column) => sum + widths[column.id], 0);
  const fixedWidth = minimumWidth - flexibleWeight;
  return <table style={{ minWidth: print ? undefined : minimumWidth, width: flexibleColumns.length ? "100%" : minimumWidth }} className={`trip-table table-fixed border-collapse text-left ${print ? "print-table text-[9px]" : "trip-screen-table text-sm"}`}>
    <colgroup>{columns.map((column) => <col key={column.id} style={{ width: TRIP_TEXT_COLUMN_IDS.includes(column.id) ? `calc((100% - ${fixedWidth}px) * ${widths[column.id] / flexibleWeight})` : widths[column.id] }} />)}{action ? <col style={{ width: 44 }} /> : null}</colgroup>
    <thead><tr className={`border-b border-[var(--line)] bg-[var(--surface-muted)] ${print ? "text-[11px]" : "text-sm"} font-extrabold text-[var(--muted)]`}>{columns.map((column) => <th key={column.id} scope="col" aria-label={column.label} data-column={column.id}><span className="trip-column-info">{column.headerInfo}</span><span className="trip-column-title">{column.headerTitle}</span></th>)}{action ? <th scope="col"><span className="sr-only">Übernommen</span></th> : null}</tr></thead>
    <tbody>{data.trips.length ? data.trips.map((trip, index) => <tr key={`${trip.id}-${index}`} data-testid={print ? undefined : "desktop-trip"} className={`border-b border-[var(--divider)] ${onEdit ? "cursor-pointer hover:bg-[var(--surface-muted)]" : ""} ${!print && trip.isChecked ? "bg-[var(--success-soft)]" : ""}`} onClick={onEdit ? () => onEdit(trip) : undefined}>
      {columns.map((column) => <td key={column.id} data-column={column.id}><TripValue trip={trip} column={column.id} />{print && column.id === columns[0].id && (trip as TripDto & { printContinuation?: boolean }).printContinuation ? <span className="block text-[7px] font-normal text-[var(--muted)]">Fortsetzung</span> : null}{onEdit && column.id === columns[0].id ? <button type="button" className="sr-only focus:not-sr-only focus-ring block text-[10px] text-[var(--primary)]" aria-label={`Fahrt ${trip.sequenceNumber} bearbeiten`} onClick={(event) => { event.stopPropagation(); onEdit(trip); }}>Bearbeiten</button> : null}</td>)}
      {action ? <td onClick={(event) => event.stopPropagation()}>{action(trip)}</td> : null}
    </tr>) : <tr><td colSpan={columns.length + (action ? 1 : 0)} className="!py-12 text-center">Noch keine Fahrten in diesem Monat</td></tr>}</tbody>
    {showTotals ? <tfoot><tr className="border-t-2 border-[var(--primary)] bg-[var(--primary-soft)] font-extrabold" aria-label="Gesamt im Monat">
      {firstTotal !== 0 ? <td colSpan={firstTotal < 0 ? columns.length : firstTotal}>Gesamt im Monat</td> : null}
      {firstTotal >= 0 ? columns.slice(firstTotal).map((column) => <td key={column.id}>{tripColumnTotal(data, column.id)}</td>) : null}
      {action ? <td /> : null}
    </tr></tfoot> : null}
  </table>;
}
