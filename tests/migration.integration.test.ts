import { expect, it } from "vitest";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import Database from "better-sqlite3";

it("upgrades a populated 1.0.10 database without changing existing data and can run again", () => {
  const database = new Database(process.env.DATABASE_PATH!);
  try {
    database.exec(fs.readFileSync("lib/db/migrations/0000_initial.sql", "utf8"));
    database.exec(`
      INSERT INTO app_settings VALUES (1, 55, '2026-09-01');
      INSERT INTO route_pairs (id, place_a, place_b, pair_key, distance_km, reimbursed_km, duration_minutes, created_at, updated_at)
        VALUES (1, 'Büro', 'Kunde', 'büro|kunde', 18, 14, 30, '2026-09-01', '2026-09-01');
      INSERT INTO trips (date, start_time, end_time, route_pair_id, direction, origin_snapshot, destination_snapshot,
        distance_km_snapshot, reimbursed_km_snapshot, reimbursement_rate_cents_snapshot, odometer_start, is_checked, created_at, updated_at)
        VALUES ('2026-09-01', '08:15', '08:45', 1, 'A_TO_B', 'Büro', 'Kunde', 18, 14, 55, 1000, 1, '2026-09-01', '2026-09-01');
    `);
    const tables = ["trips", "route_pairs", "app_settings"];
    const before = tables.map((table) => database.prepare(`SELECT * FROM ${table}`).get() as Record<string, unknown>);
    for (let run = 0; run < 2; run++) {
      execFileSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/migrate.ts"], { env: process.env });
      tables.forEach((table, index) => {
        expect(database.prepare(`SELECT ${Object.keys(before[index]).join(", ")} FROM ${table}`).get()).toEqual(before[index]);
        expect(database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()).toEqual({ count: 1 });
      });
      expect(database.prepare("SELECT accompanying_staff, remark FROM trips").get()).toEqual({ accompanying_staff: "", remark: "" });
      expect(database.prepare("SELECT COUNT(*) AS count FROM remark_templates").get()).toEqual({ count: 0 });
      expect(database.prepare("SELECT COUNT(*) AS count FROM mobile_trip_submissions").get()).toEqual({ count: 0 });
      expect(database.pragma("integrity_check", { simple: true })).toBe("ok");
      expect(database.pragma("foreign_key_check")).toEqual([]);
    }
  } finally {
    database.close();
  }
});
