import type { Metadata } from "next";
import Image from "next/image";
import { PrintToolbar } from "@/components/PrintToolbar";
import { requirePageUser } from "@/lib/auth";
import { currentMonth } from "@/lib/dates";
import { formatEuro } from "@/lib/money";
import { getTripsForMonth } from "@/lib/repositories/trips";
import { monthSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type PrintPageProps = { searchParams: Promise<{ month?: string }> };

function validMonth(value?: string) {
  const result = monthSchema.safeParse(value);
  return result.success ? result.data : currentMonth();
}

function monthTitle(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(new Date(year, monthNumber - 1, 1));
}

function formatDate(date: string) {
  const [year, month, day] = date.split("-");
  return `${day}.${month}.${year}`;
}

export async function generateMetadata({ searchParams }: PrintPageProps): Promise<Metadata> {
  const month = validMonth((await searchParams).month);
  return { title: `Fahrtenbuch ${monthTitle(month)}` };
}

export default async function PrintPage({ searchParams }: PrintPageProps) {
  await requirePageUser();
  const month = validMonth((await searchParams).month);
  const data = await getTripsForMonth(month);
  const createdAt = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());

  return (
    <main className="print-shell">
      <PrintToolbar />
      <article className="print-sheet section-enter text-[#172033]">
        <header className="mb-6 flex flex-col gap-4 border-b-2 border-[#2563eb] pb-5 sm:mb-7 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2.5">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-white p-1 ring-1 ring-[#dbe3ee]">
                <Image src="/brand/logo.png" alt="" width={36} height={36} className="h-full w-full object-contain" loading="eager" />
              </span>
              <span className="text-sm font-extrabold uppercase tracking-[.12em] text-[#2563eb]">Fahrtenbuch</span>
            </div>
            <h1 className="text-[22px] font-extrabold capitalize tracking-[-.035em] sm:text-[26px]">Dienstfahrten · {monthTitle(month)}</h1>
            <p className="mt-1 text-[11px] text-[#64748b]">Monatliche Übersicht aller erfassten Dienstfahrten</p>
          </div>
          <div className="pt-1 text-left text-[10px] leading-5 text-[#64748b] sm:text-right">
            <p className="font-bold uppercase tracking-[.08em] text-[#475569]">Erstellt am</p>
            <p>{createdAt} Uhr</p>
          </div>
        </header>

        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-6">
          <div className="rounded-lg bg-[#eff6ff] px-4 py-3"><p className="text-[9px] font-extrabold uppercase tracking-[.08em] text-[#64748b]">Monat</p><p className="mt-1 text-sm font-extrabold capitalize">{monthTitle(month)}</p></div>
          <div className="rounded-lg bg-[#eff6ff] px-4 py-3"><p className="text-[9px] font-extrabold uppercase tracking-[.08em] text-[#64748b]">Anzahl Fahrten</p><p className="mt-1 text-sm font-extrabold">{data.trips.length}</p></div>
          <div className="rounded-lg bg-[#eff6ff] px-4 py-3"><p className="text-[9px] font-extrabold uppercase tracking-[.08em] text-[#475569]">Kilometer gesamt</p><p className="mt-1 text-sm font-extrabold text-[#2563eb]">{data.totalKm.toLocaleString("de-DE")} km</p></div>
          <div className="rounded-lg bg-[#f8fafc] px-4 py-3"><p className="text-[9px] font-extrabold uppercase tracking-[.08em] text-[#475569]">KM abrechenbar</p><p className="mt-1 text-sm font-extrabold">{data.totalReimbursedKm.toLocaleString("de-DE")} km</p></div>
          <div className="rounded-lg bg-[#fff7ed] px-4 py-3"><p className="text-[9px] font-extrabold uppercase tracking-[.08em] text-[#475569]">KM nicht abrechenbar</p><p className="mt-1 text-sm font-extrabold text-[#a16207]">{data.totalUnreimbursedKm.toLocaleString("de-DE")} km</p></div>
          <div className="rounded-lg bg-[#f0fdf4] px-4 py-3"><p className="text-[9px] font-extrabold uppercase tracking-[.08em] text-[#475569]">Mögl. Erstattung</p><p className="mt-1 text-sm font-extrabold text-[#15803d]">{formatEuro(data.totalPotentialReimbursementCents)}</p></div>
        </section>

        <div className="overflow-x-auto print:overflow-visible">
        <table className="print-table min-w-[680px] w-full border-collapse text-left text-[9px] print:min-w-0">
          <thead>
            <tr className="border-y border-[#cfd9d2] bg-[#f1f4f2] text-[8px] font-extrabold uppercase tracking-[.055em] text-[#475569]">
              <th className="px-2 py-2.5">Datum</th>
              <th className="px-2 py-2.5">Beginn</th>
              <th className="px-2 py-2.5">Ende</th>
              <th className="px-2 py-2.5">Reiseweg</th>
              <th className="px-2 py-2.5 text-right">KM Beginn</th>
              <th className="px-2 py-2.5 text-right">KM Ende</th>
              <th className="px-2 py-2.5 text-right">KM gesamt</th>
              <th className="px-2 py-2.5 text-right">KM abrechenbar</th>
              <th className="px-2 py-2.5 text-right">KM nicht abrechenbar</th>
              <th className="px-2 py-2.5 text-right">Mögl. Erstattung</th>
            </tr>
          </thead>
          <tbody>
            {data.trips.length > 0 ? data.trips.map((trip) => (
              <tr key={trip.id} className="border-b border-[#e1e7e3]">
                <td className="whitespace-nowrap px-2 py-2.5 font-bold">{formatDate(trip.date)}</td>
                <td className="whitespace-nowrap px-2 py-2.5 tabular-nums">{trip.startTime}</td>
                <td className="whitespace-nowrap px-2 py-2.5 tabular-nums">{trip.endTime}</td>
                <td className="px-2 py-2.5 font-semibold">{trip.routeLabel}</td>
                <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums">{trip.odometerStart.toLocaleString("de-DE")}</td>
                <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums">{trip.odometerEnd.toLocaleString("de-DE")}</td>
                <td className="whitespace-nowrap px-2 py-2.5 text-right font-extrabold tabular-nums">{trip.distanceKm} km</td>
                <td className="whitespace-nowrap px-2 py-2.5 text-right font-bold tabular-nums">{trip.reimbursedKm} km</td>
                <td className="whitespace-nowrap px-2 py-2.5 text-right font-extrabold tabular-nums text-[#a16207]">{trip.unreimbursedKm} km</td>
                <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums">
                  <span className="block font-extrabold text-[#15803d]">{formatEuro(trip.potentialReimbursementCents)}</span>
                  <span className="block text-[7px] text-[#64748b]">{formatEuro(trip.reimbursementRateCents)}/km</span>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={10} className="border-b border-[#e1e7e3] px-4 py-12 text-center text-[#64748b]">Für diesen Monat wurden keine Fahrten erfasst.</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#2563eb] bg-[#eff6ff]">
              <td colSpan={6} className="px-2 py-3 text-right text-[8px] font-extrabold uppercase tracking-[.08em] text-[#475569]">Gesamt im Monat</td>
              <td className="whitespace-nowrap px-2 py-3 text-right text-[10px] font-extrabold text-[#2563eb]">{data.totalKm.toLocaleString("de-DE")} km</td>
              <td className="whitespace-nowrap px-2 py-3 text-right text-[10px] font-extrabold">{data.totalReimbursedKm.toLocaleString("de-DE")} km</td>
              <td className="whitespace-nowrap px-2 py-3 text-right text-[10px] font-extrabold text-[#a16207]">{data.totalUnreimbursedKm.toLocaleString("de-DE")} km</td>
              <td className="whitespace-nowrap px-2 py-3 text-right text-[10px] font-extrabold text-[#15803d]">{formatEuro(data.totalPotentialReimbursementCents)}</td>
            </tr>
          </tfoot>
        </table>
        </div>

        <footer className="mt-8 flex flex-col gap-1 border-t border-[#dbe3ee] pt-4 text-[9px] text-[#64748b] sm:flex-row sm:items-end sm:justify-between">
          <p>Fahrtenbuch · Dienstfahrten · {monthTitle(month)}</p>
          <p>{data.trips.length} {data.trips.length === 1 ? "Fahrt" : "Fahrten"}</p>
        </footer>
      </article>
    </main>
  );
}
