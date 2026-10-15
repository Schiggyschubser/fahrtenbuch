import { sqlite } from "./db";
import { updateTripSchema } from "./validation";

type ChronologyInput = {
  date: string;
  startTime: string;
  endTime: string;
  odometerStart: number;
  distanceKm: number;
};
type Conflict = { id: number; date: string; startTime: string; endTime: string; odometerStart: number; odometerEnd: number };

export class TripChronologyError extends Error {
  readonly code = "TRIP_CHRONOLOGY_CONFLICT";
}

function describe(trip: Conflict) {
  return `Fahrt vom ${trip.date.split("-").reverse().join(".")} (${trip.startTime}–${trip.endTime} Uhr)`;
}

// Call inside the same synchronous write transaction as the insert/update.
// Check all earlier/later records so an inconsistent historical neighbor cannot
// hide a conflict with another trip. Gaps are allowed, decreasing mileage is not.
export function assertTripChronology(input: ChronologyInput, excludedId = -1) {
  updateTripSchema.parse(input);
  if (!Number.isSafeInteger(input.distanceKm) || input.distanceKm <= 0) throw new Error("Die Entfernung muss eine positive ganze Zahl sein.");
  const columns = `id, date, start_time AS startTime, end_time AS endTime,
    odometer_start AS odometerStart, odometer_start + distance_km_snapshot AS odometerEnd`;
  const overlap = sqlite.prepare(`SELECT ${columns} FROM trips
    WHERE id != ? AND date = ? AND start_time < ? AND end_time > ?
    ORDER BY start_time, id LIMIT 1`).get(excludedId, input.date, input.endTime, input.startTime) as Conflict | undefined;
  if (overlap) throw new TripChronologyError(`Die Fahrt überschneidet sich zeitlich mit der ${describe(overlap)}. Bitte Datum und Uhrzeiten prüfen.`);

  const previous = sqlite.prepare(`SELECT ${columns} FROM trips
    WHERE id != ? AND (date < ? OR (date = ? AND start_time < ?))
      AND odometer_start + distance_km_snapshot > ?
    ORDER BY date DESC, start_time DESC, id DESC LIMIT 1`)
    .get(excludedId, input.date, input.date, input.startTime, input.odometerStart) as Conflict | undefined;
  if (previous) throw new TripChronologyError(`KM Beginn darf nicht unter ${previous.odometerEnd} km liegen (Endstand der früheren ${describe(previous)}). Bitte Datum, Uhrzeit und Kilometerstand prüfen.`);

  const odometerEnd = input.odometerStart + input.distanceKm;
  const next = sqlite.prepare(`SELECT ${columns} FROM trips
    WHERE id != ? AND (date > ? OR (date = ? AND start_time >= ?))
      AND odometer_start < ?
    ORDER BY date, start_time, id LIMIT 1`)
    .get(excludedId, input.date, input.date, input.startTime, odometerEnd) as Conflict | undefined;
  if (next) throw new TripChronologyError(`KM Ende (${odometerEnd} km) darf nicht über ${next.odometerStart} km liegen (Anfangsstand der späteren ${describe(next)}). Bitte Datum, Uhrzeit, Reiseweg und Kilometerstand prüfen.`);
}
