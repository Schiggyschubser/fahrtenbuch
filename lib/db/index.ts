import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import bcrypt from "bcryptjs";
import * as schema from "./schema";

type DatabaseState = {
  databasePath: string;
  sqlite: Database.Database;
  db: ReturnType<typeof drizzle<typeof schema>>;
  initialized: boolean;
};

const globalDatabase = globalThis as typeof globalThis & { __fahrtenbuchDb?: DatabaseState };

function createState(): DatabaseState {
  const configuredPath = process.env.DATABASE_PATH ?? "./data/fahrtenbuch.db";
  const databasePath = path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(/* turbopackIgnore: true */ process.cwd(), configuredPath);
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const sqlite = new Database(databasePath);
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("journal_mode = WAL");
  return { databasePath, sqlite, db: drizzle(sqlite, { schema }), initialized: false };
}

const state = globalDatabase.__fahrtenbuchDb ?? createState();
if (process.env.NODE_ENV !== "production") globalDatabase.__fahrtenbuchDb = state;

export const db = state.db;
export const sqlite = state.sqlite;
export const databasePath = state.databasePath;

function allowUnlinkedHistoricalTrips() {
  const columns = state.sqlite.pragma("table_info(trips)") as Array<{ name: string; notnull: number }>;
  const routePairColumn = columns.find((column) => column.name === "route_pair_id");
  const directionColumn = columns.find((column) => column.name === "direction");
  if (!routePairColumn || !directionColumn || (routePairColumn.notnull === 0 && directionColumn.notnull === 0)) return;

  state.sqlite.pragma("foreign_keys = OFF");
  try {
    state.sqlite.transaction(() => {
      state.sqlite.exec(`
        DROP TABLE IF EXISTS trips_nullable_migration;
        CREATE TABLE trips_nullable_migration (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          start_time TEXT NOT NULL,
          end_time TEXT NOT NULL,
          route_pair_id INTEGER REFERENCES route_pairs(id),
          direction TEXT CHECK(direction IS NULL OR direction IN ('A_TO_B', 'B_TO_A')),
          origin_snapshot TEXT NOT NULL,
          destination_snapshot TEXT NOT NULL,
          distance_km_snapshot INTEGER NOT NULL CHECK(distance_km_snapshot > 0),
          odometer_start INTEGER NOT NULL CHECK(odometer_start >= 0),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        INSERT INTO trips_nullable_migration (
          id, date, start_time, end_time, route_pair_id, direction,
          origin_snapshot, destination_snapshot, distance_km_snapshot,
          odometer_start, created_at, updated_at
        )
        SELECT
          id, date, start_time, end_time, route_pair_id, direction,
          origin_snapshot, destination_snapshot, distance_km_snapshot,
          odometer_start, created_at, updated_at
        FROM trips;
        DROP TABLE trips;
        ALTER TABLE trips_nullable_migration RENAME TO trips;
        CREATE INDEX trips_date_time_idx ON trips(date, start_time);
        CREATE INDEX trips_route_pair_idx ON trips(route_pair_id);
      `);
    })();
  } finally {
    state.sqlite.pragma("foreign_keys = ON");
  }

  const foreignKeyErrors = state.sqlite.pragma("foreign_key_check") as unknown[];
  if (foreignKeyErrors.length > 0) throw new Error("Die Datenbankmigration enthält ungültige Reiseweg-Verknüpfungen.");
}

function addRouteDurationColumn() {
  const columns = state.sqlite.pragma("table_info(route_pairs)") as Array<{ name: string }>;
  if (columns.some((column) => column.name === "duration_minutes")) return;
  state.sqlite.exec("ALTER TABLE route_pairs ADD COLUMN duration_minutes INTEGER NOT NULL DEFAULT 0 CHECK(duration_minutes >= 0)");
}

function addTripCheckedColumn() {
  const columns = state.sqlite.pragma("table_info(trips)") as Array<{ name: string }>;
  if (columns.some((column) => column.name === "is_checked")) return;
  state.sqlite.exec("ALTER TABLE trips ADD COLUMN is_checked INTEGER NOT NULL DEFAULT 0 CHECK(is_checked IN (0, 1))");
  state.sqlite.prepare("UPDATE trips SET is_checked = 1 WHERE substr(date, 6, 2) NOT IN ('06', '07')").run();
}

function addReimbursementColumns() {
  const routeColumns = state.sqlite.pragma("table_info(route_pairs)") as Array<{ name: string }>;
  if (!routeColumns.some((column) => column.name === "reimbursed_km")) {
    state.sqlite.transaction(() => {
      state.sqlite.exec("ALTER TABLE route_pairs ADD COLUMN reimbursed_km INTEGER NOT NULL DEFAULT 0 CHECK(reimbursed_km >= 0)");
      state.sqlite.exec("UPDATE route_pairs SET reimbursed_km = distance_km");
    })();
  }

  const tripColumns = state.sqlite.pragma("table_info(trips)") as Array<{ name: string }>;
  if (!tripColumns.some((column) => column.name === "reimbursed_km_snapshot")) {
    state.sqlite.transaction(() => {
      state.sqlite.exec("ALTER TABLE trips ADD COLUMN reimbursed_km_snapshot INTEGER NOT NULL DEFAULT 0 CHECK(reimbursed_km_snapshot >= 0)");
      state.sqlite.exec("UPDATE trips SET reimbursed_km_snapshot = distance_km_snapshot");
    })();
  }

  const updatedTripColumns = state.sqlite.pragma("table_info(trips)") as Array<{ name: string }>;
  if (!updatedTripColumns.some((column) => column.name === "reimbursement_rate_cents_snapshot")) {
    state.sqlite.exec("ALTER TABLE trips ADD COLUMN reimbursement_rate_cents_snapshot INTEGER NOT NULL DEFAULT 40 CHECK(reimbursement_rate_cents_snapshot >= 0)");
  }
}

function ensureAppSettings() {
  state.sqlite.prepare(`
    INSERT INTO app_settings (id, reimbursement_rate_cents, updated_at)
    VALUES (1, 40, ?)
    ON CONFLICT(id) DO NOTHING
  `).run(new Date().toISOString());
}

function ensureTwoFactorSchema() {
  const userColumns = state.sqlite.pragma("table_info(users)") as Array<{ name: string }>;
  if (!userColumns.some((column) => column.name === "two_factor_enabled")) {
    state.sqlite.exec("ALTER TABLE users ADD COLUMN two_factor_enabled INTEGER NOT NULL DEFAULT 0 CHECK(two_factor_enabled IN (0, 1))");
  }
  if (!userColumns.some((column) => column.name === "two_factor_secret_envelope")) {
    state.sqlite.exec("ALTER TABLE users ADD COLUMN two_factor_secret_envelope TEXT");
  }
  if (!userColumns.some((column) => column.name === "two_factor_enabled_at")) {
    state.sqlite.exec("ALTER TABLE users ADD COLUMN two_factor_enabled_at TEXT");
  }
  state.sqlite.exec(`
    CREATE TABLE IF NOT EXISTS two_factor_backup_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code_hash TEXT NOT NULL UNIQUE,
      used_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS two_factor_backup_codes_user_idx ON two_factor_backup_codes(user_id);

    CREATE TABLE IF NOT EXISTS two_factor_login_challenges (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      secret_envelope TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts >= 0),
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS two_factor_login_challenges_user_idx ON two_factor_login_challenges(user_id);
    CREATE INDEX IF NOT EXISTS two_factor_login_challenges_expires_idx ON two_factor_login_challenges(expires_at);
  `);
}

export function ensureDatabaseReady() {
  if (state.initialized) return;
  const migrationPath = path.join(process.cwd(), "lib", "db", "migrations", "0000_initial.sql");
  state.sqlite.exec(fs.readFileSync(migrationPath, "utf8"));
  addRouteDurationColumn();
  allowUnlinkedHistoricalTrips();
  addTripCheckedColumn();
  addReimbursementColumns();
  ensureAppSettings();
  ensureTwoFactorSchema();

  const existingUser = state.sqlite.prepare("SELECT id FROM users LIMIT 1").get();
  if (!existingUser) {
    const now = new Date().toISOString();
    state.sqlite.prepare(`
      INSERT INTO users (username, password_hash, uses_default_credentials, created_at, updated_at)
      VALUES (?, ?, 1, ?, ?)
    `).run("admin", bcrypt.hashSync("admin", 12), now, now);
  }
  state.initialized = true;
}
