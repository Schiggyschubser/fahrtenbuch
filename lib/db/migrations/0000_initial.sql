PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  uses_default_credentials INTEGER NOT NULL DEFAULT 1,
  two_factor_enabled INTEGER NOT NULL DEFAULT 0 CHECK(two_factor_enabled IN (0, 1)),
  two_factor_secret_envelope TEXT,
  two_factor_enabled_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);

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

CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  reimbursement_rate_cents INTEGER NOT NULL DEFAULT 40 CHECK(reimbursement_rate_cents >= 0),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS route_pairs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  place_a TEXT NOT NULL,
  place_b TEXT NOT NULL,
  pair_key TEXT NOT NULL UNIQUE,
  distance_km INTEGER NOT NULL CHECK(distance_km > 0),
  reimbursed_km INTEGER NOT NULL DEFAULT 0 CHECK(reimbursed_km >= 0),
  duration_minutes INTEGER NOT NULL DEFAULT 0 CHECK(duration_minutes >= 0),
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  route_pair_id INTEGER REFERENCES route_pairs(id),
  direction TEXT CHECK(direction IS NULL OR direction IN ('A_TO_B', 'B_TO_A')),
  origin_snapshot TEXT NOT NULL,
  destination_snapshot TEXT NOT NULL,
  distance_km_snapshot INTEGER NOT NULL CHECK(distance_km_snapshot > 0),
  reimbursed_km_snapshot INTEGER NOT NULL DEFAULT 0 CHECK(reimbursed_km_snapshot >= 0),
  reimbursement_rate_cents_snapshot INTEGER NOT NULL DEFAULT 40 CHECK(reimbursement_rate_cents_snapshot >= 0),
  odometer_start INTEGER NOT NULL CHECK(odometer_start >= 0),
  is_checked INTEGER NOT NULL DEFAULT 0 CHECK(is_checked IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS trips_date_time_idx ON trips(date, start_time);
CREATE INDEX IF NOT EXISTS trips_route_pair_idx ON trips(route_pair_id);
