import { NextResponse } from "next/server";
import { errorResponse, unauthorizedResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { importTripsFromCsv } from "@/lib/repositories/trips";
import { MAX_TRIP_CSV_BYTES, parseTripCsv } from "@/lib/trip-csv";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorizedResponse();
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("Bitte wähle eine CSV-Datei aus.");
    if (!file.name.toLocaleLowerCase("de-DE").endsWith(".csv")) {
      throw new Error("Es können ausschließlich CSV-Dateien importiert werden.");
    }
    if (file.size === 0) throw new Error("Die CSV-Datei ist leer.");
    if (file.size > MAX_TRIP_CSV_BYTES) {
      throw new Error("Die CSV-Datei darf höchstens 5 MB groß sein.");
    }
    const rows = parseTripCsv(await file.text());
    const result = await importTripsFromCsv(rows);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Die Fahrten konnten nicht importiert werden.");
  }
}
