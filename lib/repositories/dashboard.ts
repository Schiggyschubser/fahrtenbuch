import { and, desc, gte, lt } from "drizzle-orm";
import { currentDate } from "../dates";
import { db, ensureDatabaseReady, sqlite } from "../db";
import { trips } from "../db/schema";
import type { DashboardDataDto, DashboardSummaryDto } from "../types";
import { tripToDto } from "./trips";

type DateRange = { start: string; endExclusive: string } | null;

const WEEKDAYS = [
  { key: "1", label: "Mo" },
  { key: "2", label: "Di" },
  { key: "3", label: "Mi" },
  { key: "4", label: "Do" },
  { key: "5", label: "Fr" },
  { key: "6", label: "Sa" },
  { key: "0", label: "So" },
];

function addDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return value.toISOString().slice(0, 10);
}

function sameDayPreviousYear(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const maxDay = new Date(Date.UTC(year - 1, month, 0)).getUTCDate();
  return `${year - 1}-${String(month).padStart(2, "0")}-${String(Math.min(day, maxDay)).padStart(2, "0")}`;
}

function dateFilter(range: DateRange) {
  return range ? { sql: " WHERE date >= ? AND date < ?", params: [range.start, range.endExclusive] } : { sql: "", params: [] };
}

function summaryFor(range: DateRange): DashboardSummaryDto {
  const filter = dateFilter(range);
  const row = sqlite.prepare(`
    SELECT
      COUNT(*) AS tripCount,
      COALESCE(SUM(distance_km_snapshot), 0) AS totalKm,
      COUNT(DISTINCT date) AS activeDays,
      COALESCE(SUM(
        (CAST(substr(end_time, 1, 2) AS INTEGER) * 60 + CAST(substr(end_time, 4, 2) AS INTEGER)) -
        (CAST(substr(start_time, 1, 2) AS INTEGER) * 60 + CAST(substr(start_time, 4, 2) AS INTEGER))
      ), 0) AS totalMinutes
    FROM trips${filter.sql}
  `).get(...filter.params) as { tripCount: number; totalKm: number; activeDays: number; totalMinutes: number };
  return {
    ...row,
    averageKm: row.tripCount > 0 ? Math.round((row.totalKm / row.tripCount) * 10) / 10 : 0,
  };
}

function percentageDelta(current: number, previous: number) {
  return previous === 0 ? null : Math.round(((current - previous) / previous) * 1000) / 10;
}

function formatShortDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" }).format(new Date(Date.UTC(year, month - 1, day)));
}

function trendForYear(year: number, range: DateRange) {
  const filter = dateFilter(range);
  const rows = sqlite.prepare(`
    SELECT substr(date, 1, 7) AS key, COUNT(*) AS tripCount, SUM(distance_km_snapshot) AS totalKm
    FROM trips${filter.sql}
    GROUP BY substr(date, 1, 7)
  `).all(...filter.params) as Array<{ key: string; tripCount: number; totalKm: number }>;
  const values = new Map(rows.map((row) => [row.key, row]));
  return Array.from({ length: 12 }, (_, index) => {
    const key = `${year}-${String(index + 1).padStart(2, "0")}`;
    const value = values.get(key);
    return {
      key,
      label: new Intl.DateTimeFormat("de-DE", { month: "short" }).format(new Date(Date.UTC(year, index, 1))).replace(".", ""),
      totalKm: value?.totalKm ?? 0,
      tripCount: value?.tripCount ?? 0,
    };
  });
}

function trendForAllYears(availableYears: number[]) {
  const rows = sqlite.prepare(`
    SELECT substr(date, 1, 4) AS key, COUNT(*) AS tripCount, SUM(distance_km_snapshot) AS totalKm
    FROM trips
    GROUP BY substr(date, 1, 4)
    ORDER BY key
  `).all() as Array<{ key: string; tripCount: number; totalKm: number }>;
  const values = new Map(rows.map((row) => [row.key, row]));
  return availableYears.toSorted((a, b) => a - b).map((year) => ({
    key: String(year),
    label: String(year),
    totalKm: values.get(String(year))?.totalKm ?? 0,
    tripCount: values.get(String(year))?.tripCount ?? 0,
  }));
}

async function recentTripsFor(range: DateRange) {
  const rows = range
    ? await db.select().from(trips).where(and(gte(trips.date, range.start), lt(trips.date, range.endExclusive))).orderBy(desc(trips.date), desc(trips.startTime), desc(trips.id)).limit(5)
    : await db.select().from(trips).orderBy(desc(trips.date), desc(trips.startTime), desc(trips.id)).limit(5);
  return rows.map(tripToDto);
}

export async function getDashboardData(requestedPeriod?: string): Promise<DashboardDataDto> {
  ensureDatabaseReady();
  const availableYears = (sqlite.prepare(`
    SELECT DISTINCT CAST(substr(date, 1, 4) AS INTEGER) AS year
    FROM trips
    ORDER BY year DESC
  `).all() as Array<{ year: number }>).map((row) => row.year);
  const today = currentDate();
  const currentYear = Number(today.slice(0, 4));
  const fallbackYear = availableYears.includes(currentYear) ? currentYear : (availableYears[0] ?? currentYear);
  const selectedPeriod = requestedPeriod === "all"
    ? "all"
    : availableYears.includes(Number(requestedPeriod)) ? String(Number(requestedPeriod)) : String(fallbackYear);
  const selectedYear = selectedPeriod === "all" ? null : Number(selectedPeriod);
  const range: DateRange = selectedYear === null ? null : { start: `${selectedYear}-01-01`, endExclusive: `${selectedYear + 1}-01-01` };
  const filter = dateFilter(range);
  const summary = summaryFor(range);

  const weekdayRows = sqlite.prepare(`
    SELECT strftime('%w', date) AS key, COUNT(*) AS tripCount, SUM(distance_km_snapshot) AS totalKm
    FROM trips${filter.sql}
    GROUP BY strftime('%w', date)
  `).all(...filter.params) as Array<{ key: string; tripCount: number; totalKm: number }>;
  const weekdayValues = new Map(weekdayRows.map((row) => [row.key, row]));

  const topRoutes = sqlite.prepare(`
    SELECT
      CASE WHEN destination_snapshot = '' THEN origin_snapshot ELSE origin_snapshot || ' → ' || destination_snapshot END AS routeLabel,
      COUNT(*) AS tripCount,
      SUM(distance_km_snapshot) AS totalKm
    FROM trips${filter.sql}
    GROUP BY routeLabel
    ORDER BY totalKm DESC, tripCount DESC, routeLabel ASC
    LIMIT 5
  `).all(...filter.params) as DashboardDataDto["topRoutes"];

  const dataRangeRow = sqlite.prepare(`
    SELECT MIN(date) AS firstDate, MAX(date) AS lastDate
    FROM trips${filter.sql}
  `).get(...filter.params) as { firstDate: string | null; lastDate: string | null };
  const dataRange = dataRangeRow.firstDate && dataRangeRow.lastDate
    ? { firstDate: dataRangeRow.firstDate, lastDate: dataRangeRow.lastDate }
    : null;

  let comparison: DashboardDataDto["comparison"] = null;
  if (selectedYear !== null) {
    const isCurrentYear = selectedYear === currentYear;
    const currentComparisonRange = isCurrentYear
      ? { start: `${selectedYear}-01-01`, endExclusive: addDays(today, 1) }
      : range!;
    const previousEndDate = isCurrentYear ? sameDayPreviousYear(today) : `${selectedYear - 1}-12-31`;
    const previousRange = { start: `${selectedYear - 1}-01-01`, endExclusive: addDays(previousEndDate, 1) };
    const currentSummary = summaryFor(currentComparisonRange);
    const previousSummary = summaryFor(previousRange);
    comparison = {
      currentLabel: isCurrentYear ? `${selectedYear} bis ${formatShortDate(today)}` : String(selectedYear),
      previousLabel: isCurrentYear ? `${selectedYear - 1} bis ${formatShortDate(previousEndDate)}` : String(selectedYear - 1),
      current: { totalKm: currentSummary.totalKm, tripCount: currentSummary.tripCount },
      previous: { totalKm: previousSummary.totalKm, tripCount: previousSummary.tripCount },
      kmDeltaPercent: percentageDelta(currentSummary.totalKm, previousSummary.totalKm),
      tripDeltaPercent: percentageDelta(currentSummary.tripCount, previousSummary.tripCount),
    };
  }

  return {
    selectedPeriod,
    availableYears,
    summary,
    trend: selectedYear === null ? trendForAllYears(availableYears) : trendForYear(selectedYear, range),
    comparison,
    weekdays: WEEKDAYS.map((weekday) => ({
      ...weekday,
      totalKm: weekdayValues.get(weekday.key)?.totalKm ?? 0,
      tripCount: weekdayValues.get(weekday.key)?.tripCount ?? 0,
    })),
    topRoutes,
    recentTrips: await recentTripsFor(range),
    dataRange,
  };
}
