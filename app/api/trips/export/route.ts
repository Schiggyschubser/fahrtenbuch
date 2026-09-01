import { errorResponse, unauthorizedResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getTripDateRange, getTripsForDateRange } from "@/lib/repositories/trips";
import { serializeTripCsv } from "@/lib/trip-csv";
import { tripExportRangeSchema } from "@/lib/validation";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorizedResponse();
    const searchParams = new URL(request.url).searchParams;
    const exportAll = searchParams.get("all") === "1";
    const availableRange = exportAll ? getTripDateRange() : null;
    if (exportAll && (!availableRange?.firstDate || !availableRange.lastDate)) {
      throw new Error("Es sind noch keine Fahrten für den Export vorhanden.");
    }
    const range = tripExportRangeSchema.parse(exportAll
      ? { from: availableRange!.firstDate, to: availableRange!.lastDate }
      : { from: searchParams.get("from"), to: searchParams.get("to") });
    const trips = await getTripsForDateRange(range.from, range.to);
    if (trips.length === 0) {
      throw new Error("Im gewählten Zeitraum sind keine Fahrten vorhanden.");
    }
    const csv = serializeTripCsv(trips.map((trip) => ({
      date: trip.date,
      startTime: trip.startTime,
      endTime: trip.endTime,
      routeLabel: trip.routeLabel,
      odometerStart: trip.odometerStart,
      odometerEnd: trip.odometerEnd,
    })));
    const filename = exportAll ? "fahrtenbuch-gesamt.csv" : `fahrtenbuch-${range.from}-bis-${range.to}.csv`;
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error, "Die Fahrten konnten nicht exportiert werden.");
  }
}
