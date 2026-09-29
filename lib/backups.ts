import { decodeTripColumns } from "./trip-columns";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { databasePath, ensureDatabaseReady, sqlite } from "./db";
import type { BackupDto, BackupKind } from "./types";

const AUTOMATIC_INTERVAL_MS = 24 * 60 * 60 * 1000;
const BACKUP_FILE_PATTERN = /^fahrtenbuch-[a-z-]+-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.sqlite$/;

let backupQueue: Promise<unknown> = Promise.resolve();

function inBackupQueue<T>(job: () => Promise<T>): Promise<T> {
  const result = backupQueue.then(job, job);
  backupQueue = result.then(() => undefined, () => undefined);
  return result;
}

export function getBackupDirectory() {
  const configuredPath = process.env.BACKUP_DIR ?? "./data/backups";
  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(/* turbopackIgnore: true */ process.cwd(), configuredPath);
}

function timestampForFilename(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function kindFromFilename(filename: string): BackupKind {
  if (filename.startsWith("fahrtenbuch-automatic-")) return "automatic";
  if (filename.startsWith("fahrtenbuch-manual-")) return "manual";
  if (filename.startsWith("fahrtenbuch-pre-restore-")) return "pre-restore";
  return "safety";
}

function backupFilename(kind: BackupKind) {
  return `fahrtenbuch-${kind}-${timestampForFilename()}.sqlite`;
}

async function createBackupInternal(kind: BackupKind): Promise<BackupDto> {
  ensureDatabaseReady();
  const backupDirectory = getBackupDirectory();
  await fs.promises.mkdir(backupDirectory, { recursive: true });
  const id = backupFilename(kind);
  const destination = path.join(backupDirectory, id);
  await sqlite.backup(destination);
  const stats = await fs.promises.stat(destination);
  return { id, kind, createdAt: stats.mtime.toISOString(), sizeBytes: stats.size };
}

export function createBackup(kind: "manual" | "automatic" | "safety" = "manual") {
  return inBackupQueue(() => createBackupInternal(kind));
}

export async function listBackups(): Promise<BackupDto[]> {
  ensureDatabaseReady();
  const backupDirectory = getBackupDirectory();
  await fs.promises.mkdir(backupDirectory, { recursive: true });
  const entries = await fs.promises.readdir(backupDirectory, { withFileTypes: true });
  const backups = await Promise.all(entries
    .filter((entry) => entry.isFile() && BACKUP_FILE_PATTERN.test(entry.name))
    .map(async (entry) => {
      const stats = await fs.promises.stat(path.join(backupDirectory, entry.name));
      return {
        id: entry.name,
        kind: kindFromFilename(entry.name),
        createdAt: stats.mtime.toISOString(),
        sizeBytes: stats.size,
      } satisfies BackupDto;
    }));
  return backups.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function maybeCreateAutomaticBackup() {
  return inBackupQueue(async () => {
    const backups = await listBackups();
    const latestAutomatic = backups.find((backup) => backup.kind === "automatic");
    if (latestAutomatic && Date.now() - new Date(latestAutomatic.createdAt).getTime() < AUTOMATIC_INTERVAL_MS) {
      return null;
    }
    return createBackupInternal("automatic");
  });
}

function resolveBackupPath(id: string) {
  if (path.basename(id) !== id || !BACKUP_FILE_PATTERN.test(id)) throw new Error("Ungültige Sicherungsdatei.");
  const resolved = path.join(getBackupDirectory(), id);
  if (!fs.existsSync(resolved)) throw new Error("Die Sicherungsdatei wurde nicht gefunden.");
  return resolved;
}

function validateBackup(backupPath: string) {
  const source = new Database(backupPath, { readonly: true, fileMustExist: true });
  try {
    const integrity = source.pragma("integrity_check", { simple: true });
    if (integrity !== "ok") throw new Error("Die Sicherungsdatei ist beschädigt.");
    const tables = source.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('route_pairs', 'trips')").all() as Array<{ name: string }>;
    if (tables.length !== 2) throw new Error("Die Sicherungsdatei ist nicht mit dieser Fahrtenbuch-Version kompatibel.");
    source.prepare("SELECT id, place_a, place_b, pair_key, distance_km, archived_at, created_at, updated_at FROM route_pairs LIMIT 1").get();
    source.prepare("SELECT id, date, start_time, end_time, route_pair_id, direction, origin_snapshot, destination_snapshot, distance_km_snapshot, odometer_start, created_at, updated_at FROM trips LIMIT 1").get();
  } finally {
    source.close();
  }
}

export function restoreBackup(id: string) {
  return inBackupQueue(async () => {
    ensureDatabaseReady();
    const sourcePath = resolveBackupPath(id);
    if (path.resolve(sourcePath) === path.resolve(databasePath)) throw new Error("Die aktive Datenbank kann nicht als Sicherungsdatei verwendet werden.");
    validateBackup(sourcePath);
    const safetyBackup = await createBackupInternal("pre-restore");

    const backupColumns = new Database(sourcePath, { readonly: true, fileMustExist: true });
    const routeColumnNames = new Set((backupColumns.pragma("table_info(route_pairs)") as Array<{ name: string }>).map((column) => column.name));
    const tripColumnNames = new Set((backupColumns.pragma("table_info(trips)") as Array<{ name: string }>).map((column) => column.name));
    const hasDuration = routeColumnNames.has("duration_minutes");
    const hasRouteReimbursement = routeColumnNames.has("reimbursed_km");
    const hasChecked = tripColumnNames.has("is_checked");
    const hasTripReimbursement = tripColumnNames.has("reimbursed_km_snapshot");
    const hasTripReimbursementRate = tripColumnNames.has("reimbursement_rate_cents_snapshot");
    const backupTables = new Set((backupColumns.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>).map((table) => table.name));
    const hasAppSettings = backupTables.has("app_settings")
      && (backupColumns.pragma("table_info(app_settings)") as Array<{ name: string }>).some((column) => column.name === "reimbursement_rate_cents");
    const hasDefaultRemark = backupTables.has("app_settings")
      && (backupColumns.pragma("table_info(app_settings)") as Array<{ name: string }>).some((column) => column.name === "default_remark_template_id");
    const hasTripColumns = backupTables.has("app_settings")
      && (backupColumns.pragma("table_info(app_settings)") as Array<{ name: string }>).some((column) => column.name === "trip_columns");
    const restoredColumns = hasTripColumns
      ? (backupColumns.prepare("SELECT trip_columns AS value FROM app_settings WHERE id = 1").get() as { value: string | null } | undefined)?.value
      : null;
    const hasPrintColumns = backupTables.has("app_settings")
      && (backupColumns.pragma("table_info(app_settings)") as Array<{ name: string }>).some((column) => column.name === "print_columns");
    const restoredPrintColumns = hasPrintColumns
      ? (backupColumns.prepare("SELECT print_columns AS value FROM app_settings WHERE id = 1").get() as { value: string | null } | undefined)?.value
      : null;
    const hasRemarkTemplates = backupTables.has("remark_templates");
    const hasLicensePlate = backupTables.has("app_settings")
      && (backupColumns.pragma("table_info(app_settings)") as Array<{ name: string }>).some((column) => column.name === "license_plate");
    const restoredLicensePlate = hasLicensePlate
      ? (backupColumns.prepare("SELECT license_plate AS value FROM app_settings WHERE id = 1").get() as { value: string } | undefined)?.value ?? ""
      : "";
    const textColumns = ["origin_full_name_snapshot", "destination_full_name_snapshot", "accompanying_staff", "remark"];
    backupColumns.close();
    sqlite.prepare("ATTACH DATABASE ? AS restore_db").run(sourcePath);
    try {
      const restore = sqlite.transaction(() => {
        sqlite.exec(`
          DELETE FROM trips;
          DELETE FROM route_pairs;
          DELETE FROM remark_templates;
          UPDATE app_settings SET default_remark_template_id = NULL WHERE id = 1;

          INSERT INTO route_pairs (id, place_a, place_b, place_a_full_name, place_b_full_name, pair_key, distance_km, reimbursed_km, duration_minutes, archived_at, created_at, updated_at)
          SELECT id, place_a, place_b, ${routeColumnNames.has("place_a_full_name") ? "place_a_full_name" : "''"}, ${routeColumnNames.has("place_b_full_name") ? "place_b_full_name" : "''"}, pair_key, distance_km, ${hasRouteReimbursement ? "reimbursed_km" : "distance_km"}, ${hasDuration ? "duration_minutes" : "0"}, archived_at, created_at, updated_at
          FROM restore_db.route_pairs;

          INSERT INTO trips (id, date, start_time, end_time, route_pair_id, direction, origin_snapshot, destination_snapshot, distance_km_snapshot, reimbursed_km_snapshot, reimbursement_rate_cents_snapshot, odometer_start, is_checked, created_at, updated_at, ${textColumns.join(", ")})
          SELECT id, date, start_time, end_time, route_pair_id, direction, origin_snapshot, destination_snapshot, distance_km_snapshot, ${hasTripReimbursement ? "reimbursed_km_snapshot" : "distance_km_snapshot"}, ${hasTripReimbursementRate ? "reimbursement_rate_cents_snapshot" : "40"}, odometer_start, ${hasChecked ? "is_checked" : "CASE WHEN substr(date, 6, 2) NOT IN ('06', '07') THEN 1 ELSE 0 END"}, created_at, updated_at, ${textColumns.map((name) => tripColumnNames.has(name) ? name : "''").join(", ")}
          FROM restore_db.trips;
        `);
        if (hasRemarkTemplates) {
          sqlite.exec("INSERT INTO remark_templates (id, text) SELECT id, text FROM restore_db.remark_templates");
        }
        if (hasDefaultRemark && hasRemarkTemplates) {
          sqlite.exec(`UPDATE app_settings SET default_remark_template_id = (
            SELECT default_remark_template_id FROM restore_db.app_settings WHERE id = 1
          ) WHERE id = 1`);
          sqlite.exec("UPDATE app_settings SET default_remark_template_id = NULL WHERE default_remark_template_id NOT IN (SELECT id FROM remark_templates)");
        }
        if (hasAppSettings) {
          sqlite.exec(`
            UPDATE app_settings
            SET reimbursement_rate_cents = (
              SELECT reimbursement_rate_cents FROM restore_db.app_settings WHERE id = 1
            ),
            updated_at = datetime('now')
            WHERE id = 1 AND EXISTS (SELECT 1 FROM restore_db.app_settings WHERE id = 1);
          `);
        }
        sqlite.prepare("UPDATE app_settings SET trip_columns = ?, updated_at = ? WHERE id = 1")
          .run(JSON.stringify(decodeTripColumns(restoredColumns)), new Date().toISOString());
        sqlite.prepare("UPDATE app_settings SET print_columns = ? WHERE id = 1")
          .run(JSON.stringify(decodeTripColumns(restoredPrintColumns)));
        sqlite.prepare("UPDATE app_settings SET license_plate = ? WHERE id = 1").run(restoredLicensePlate);
        const foreignKeyErrors = sqlite.pragma("foreign_key_check") as unknown[];
        if (foreignKeyErrors.length > 0) throw new Error("Die wiederhergestellten Daten enthalten ungültige Verknüpfungen.");
      });
      restore();
    } finally {
      sqlite.exec("DETACH DATABASE restore_db");
    }

    const counts = sqlite.prepare(`
      SELECT
        (SELECT COUNT(*) FROM route_pairs) AS routes,
        (SELECT COUNT(*) FROM trips) AS trips
    `).get() as { routes: number; trips: number };
    return { ...counts, safetyBackup };
  });
}
