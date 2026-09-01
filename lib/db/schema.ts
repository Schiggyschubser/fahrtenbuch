import { integer, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull(),
  passwordHash: text("password_hash").notNull(),
  usesDefaultCredentials: integer("uses_default_credentials", { mode: "boolean" }).notNull().default(true),
  twoFactorEnabled: integer("two_factor_enabled", { mode: "boolean" }).notNull().default(false),
  twoFactorSecretEnvelope: text("two_factor_secret_envelope"),
  twoFactorEnabledAt: text("two_factor_enabled_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("users_username_unique").on(table.username)]);

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
  index("sessions_expires_at_idx").on(table.expiresAt),
]);

export const twoFactorBackupCodes = sqliteTable("two_factor_backup_codes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  codeHash: text("code_hash").notNull(),
  usedAt: text("used_at"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("two_factor_backup_codes_hash_unique").on(table.codeHash),
  index("two_factor_backup_codes_user_idx").on(table.userId),
]);

export const twoFactorLoginChallenges = sqliteTable("two_factor_login_challenges", {
  tokenHash: text("token_hash").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  secretEnvelope: text("secret_envelope").notNull(),
  expiresAt: text("expires_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("two_factor_login_challenges_user_idx").on(table.userId),
  index("two_factor_login_challenges_expires_idx").on(table.expiresAt),
]);

export const appSettings = sqliteTable("app_settings", {
  id: integer("id").primaryKey(),
  reimbursementRateCents: integer("reimbursement_rate_cents").notNull().default(40),
  updatedAt: text("updated_at").notNull(),
});

export const routePairs = sqliteTable("route_pairs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  placeA: text("place_a").notNull(),
  placeB: text("place_b").notNull(),
  pairKey: text("pair_key").notNull(),
  distanceKm: integer("distance_km").notNull(),
  reimbursedKm: integer("reimbursed_km").notNull().default(0),
  durationMinutes: integer("duration_minutes").notNull().default(0),
  archivedAt: text("archived_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("route_pairs_pair_key_unique").on(table.pairKey)]);

export const trips = sqliteTable("trips", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  routePairId: integer("route_pair_id").references(() => routePairs.id),
  direction: text("direction", { enum: ["A_TO_B", "B_TO_A"] }),
  originSnapshot: text("origin_snapshot").notNull(),
  destinationSnapshot: text("destination_snapshot").notNull(),
  distanceKmSnapshot: integer("distance_km_snapshot").notNull(),
  reimbursedKmSnapshot: integer("reimbursed_km_snapshot").notNull().default(0),
  reimbursementRateCentsSnapshot: integer("reimbursement_rate_cents_snapshot").notNull().default(40),
  odometerStart: integer("odometer_start").notNull(),
  isChecked: integer("is_checked", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("trips_date_time_idx").on(table.date, table.startTime),
  index("trips_route_pair_idx").on(table.routePairId),
]);

export type Direction = "A_TO_B" | "B_TO_A";
