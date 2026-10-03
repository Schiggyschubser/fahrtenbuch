import bcrypt from "bcryptjs";
import { ZodError, z } from "zod";
import { ensureDatabaseReady, sqlite } from "./db";
import { maybeCreateAutomaticBackup } from "./backups";
import { allowMobileLogin, createMobileSession, mobileUser } from "./mobile-auth";
import { MobileApiError, mobileTripRevisionSchema, mobileTripUpdateSchema, submitMobileTrip } from "./mobile-trips";
import { beginTwoFactorLogin, completeTwoFactorLogin } from "./repositories/two-factor";
import { getActiveRoutePairs, toRouteOptions } from "./repositories/routes";
import { deleteTrip, getTrip, getSuggestedOdometer, getTripsForMonth, tripToDto, updateTrip } from "./repositories/trips";
import { getRemarkSettings } from "./repositories/remarks";
import { getReimbursementSettings, getVehicleSettings } from "./repositories/settings";
import { dateSchema, loginSchema, monthSchema, twoFactorChallengeSchema } from "./validation";

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

async function readJson(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new MobileApiError(415, "JSON_REQUIRED", "Content-Type application/json erforderlich.");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new MobileApiError(400, "INVALID_JSON", "JSON-Daten fehlen.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 16_384) {
      await reader.cancel();
      throw new MobileApiError(413, "BODY_TOO_LARGE", "Die Anfrage darf höchstens 16 KiB groß sein.");
    }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown; }
  catch { throw new MobileApiError(400, "INVALID_JSON", "Ungültige JSON-Daten."); }
}

export async function handleMobileApi(request: Request, path: string[]) {
  try {
    const endpoint = `${request.method} ${path.join("/")}`;
    if (endpoint === "POST auth/login") {
      const input = loginSchema.parse(await readJson(request));
      if (!allowMobileLogin(input.username)) return json({ code: "RATE_LIMITED", error: "Bitte in einer Minute erneut anmelden." }, 429, { "Retry-After": "60" });
      ensureDatabaseReady();
      const user = sqlite.prepare("SELECT id, password_hash, two_factor_enabled FROM users WHERE username = ?").get(input.username) as
        { id: number; password_hash: string; two_factor_enabled: number } | undefined;
      if (!user || !(await bcrypt.compare(input.password, user.password_hash))) throw new MobileApiError(401, "INVALID_CREDENTIALS", "Benutzername oder Passwort ist falsch.");
      if (user.two_factor_enabled) return json({ requiresTwoFactor: true, ...await beginTwoFactorLogin(user.id, input.password) });
      return json(createMobileSession(user.id));
    }
    if (endpoint === "POST auth/two-factor") {
      const input = twoFactorChallengeSchema.parse(await readJson(request));
      let userId: number;
      try { ({ userId } = await completeTwoFactorLogin(input.challengeToken, input.code)); }
      catch { throw new MobileApiError(401, "INVALID_TWO_FACTOR", "Sicherheitscode oder Anmeldeanfrage ungültig. Gegebenenfalls erneut anmelden."); }
      return json(createMobileSession(userId));
    }

    const user = mobileUser(request);
    if (!user) return json({ code: "UNAUTHORIZED", error: "Gültiges Bearer-Token erforderlich." }, 401, { "WWW-Authenticate": "Bearer" });
    const params = new URL(request.url).searchParams;
    if (path.length === 2 && path[0] === "trips" && /^\d+$/.test(path[1])) {
      const id = z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER).parse(path[1]);
      if (!["GET", "PUT", "PATCH", "DELETE"].includes(request.method)) return json({ code: "METHOD_NOT_ALLOWED", error: "Methode nicht unterstützt." }, 405);
      if (request.method === "GET") {
        const trip = await getTrip(id);
        if (!trip) throw new MobileApiError(404, "TRIP_NOT_FOUND", "Die Fahrt existiert nicht mehr.");
        return json({ trip: tripToDto(trip) });
      }
      const raw = await readJson(request);
      const input = request.method === "DELETE" ? mobileTripRevisionSchema.parse(raw) : mobileTripUpdateSchema.parse(raw);
      const existing = await getTrip(id);
      if (!existing) {
        if (request.method === "DELETE") return json({ deleted: true, id });
        throw new MobileApiError(404, "TRIP_NOT_FOUND", "Die Fahrt existiert nicht mehr.");
      }
      if (existing.updatedAt !== input.expectedUpdatedAt) throw new MobileApiError(409, "TRIP_CHANGED", "Die Fahrt wurde zwischenzeitlich geändert. Bitte aktualisieren und erneut prüfen.");
      await maybeCreateAutomaticBackup();
      if (request.method === "DELETE") {
        if (!await deleteTrip(id, input.expectedUpdatedAt)) throw new MobileApiError(409, "TRIP_CHANGED", "Die Fahrt wurde zwischenzeitlich geändert. Bitte aktualisieren.");
        return json({ deleted: true, id });
      }
      const { expectedUpdatedAt, ...changes } = mobileTripUpdateSchema.parse(raw);
      if (changes.routePairId && !sqlite.prepare("SELECT id FROM route_pairs WHERE id=? AND archived_at IS NULL").get(changes.routePairId)) {
        throw new MobileApiError(409, "ROUTE_UNAVAILABLE", "Der gewählte Reiseweg ist nicht mehr verfügbar. Bitte Reisewege aktualisieren.");
      }
      const updated = await updateTrip(id, changes, expectedUpdatedAt);
      if (!updated) throw new MobileApiError(409, "TRIP_CHANGED", "Die Fahrt wurde zwischenzeitlich geändert. Bitte aktualisieren.");
      return json({ trip: updated });
    }
    switch (endpoint) {
      case "POST auth/logout":
        sqlite.prepare("DELETE FROM sessions WHERE token_hash = ?").run(user.tokenHash);
        return json({ ok: true });
      case "GET me":
        return json({ user: { id: user.id, username: user.username }, apiVersion: 1 });
      case "GET bootstrap": {
        const routes = await getActiveRoutePairs();
        return json({ apiVersion: 1, routes, routeOptions: toRouteOptions(routes, params.get("q") ?? ""), vehicle: await getVehicleSettings(),
          reimbursement: await getReimbursementSettings(), remarks: getRemarkSettings(), capabilities: { tripManagement: true, routeSearch: true } });
      }
      case "GET routes": {
        const routes = await getActiveRoutePairs();
        return json({ routes, routeOptions: toRouteOptions(routes, params.get("q") ?? "") });
      }
      case "GET trips":
        return json(await getTripsForMonth(monthSchema.parse(params.get("month"))));
      case "GET trips/suggested-odometer": {
        const date = dateSchema.parse(params.get("date"));
        const startTime = params.has("startTime") ? z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).parse(params.get("startTime")) : undefined;
        return json({ suggestedOdometerStart: await getSuggestedOdometer(date, startTime) });
      }
      case "POST trips": {
        const input = await readJson(request);
        await maybeCreateAutomaticBackup();
        const result = submitMobileTrip(user.id, input);
        return json(result, result.duplicate ? 200 : 201);
      }
      default: return json({ code: "NOT_FOUND", error: "API-Endpunkt nicht gefunden." }, 404);
    }
  } catch (error) {
    if (error instanceof ZodError) return json({ code: "VALIDATION_ERROR", error: error.issues[0]?.message, issues: error.issues.map(({ path, message }) => ({ path, message })) }, 400);
    if (error instanceof MobileApiError) return json({ code: error.code, error: error.message }, error.status);
    // Do not log request bodies, tokens, passwords, or database values.
    console.error("Mobile API: internal request failure");
    return json({ code: "INTERNAL_ERROR", error: "Interner Serverfehler. Bitte später erneut versuchen." }, 500);
  }
}
