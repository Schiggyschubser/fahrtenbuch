import Database from "better-sqlite3";
import bcrypt from "bcryptjs";

const databasePath = process.env.DATABASE_PATH ?? "/app/data/fahrtenbuch.db";
const sqlite = new Database(databasePath);

try {
  sqlite.pragma("foreign_keys = ON");
  const user = sqlite.prepare("SELECT id FROM users ORDER BY id LIMIT 1").get();
  if (!user) {
    console.error("Kein Benutzer in der Datenbank gefunden.");
    process.exitCode = 1;
  } else {
    const now = new Date().toISOString();
    sqlite.transaction(() => {
      sqlite.prepare(`
        UPDATE users
        SET username = ?, password_hash = ?, uses_default_credentials = 1,
            two_factor_enabled = 0, two_factor_secret_envelope = NULL,
            two_factor_enabled_at = NULL, updated_at = ?
        WHERE id = ?
      `).run("admin", bcrypt.hashSync("admin", 12), now, user.id);
      sqlite.prepare("DELETE FROM sessions").run();
      sqlite.prepare("DELETE FROM two_factor_login_challenges").run();
      sqlite.prepare("DELETE FROM two_factor_backup_codes WHERE user_id = ?").run(user.id);
    })();
    console.log("Login wurde auf admin / admin zurückgesetzt. Passwort nach dem Login sofort ändern.");
  }
} finally {
  sqlite.close();
}
