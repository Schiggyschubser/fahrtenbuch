import path from "node:path";
import Database from "better-sqlite3";

if (!process.argv.includes("DISABLE-2FA")) {
  console.error("Abbruch: Bestätigung fehlt. Verwende: npm run auth:disable-2fa -- --confirm DISABLE-2FA");
  process.exit(1);
}

const configuredPath = process.env.DATABASE_PATH ?? "./data/fahrtenbuch.db";
const databasePath = path.isAbsolute(configuredPath) ? configuredPath : path.resolve(process.cwd(), configuredPath);
const sqlite = new Database(databasePath, { fileMustExist: true });
sqlite.pragma("foreign_keys = ON");

try {
  const user = sqlite.prepare("SELECT id, username FROM users ORDER BY id LIMIT 1").get();
  if (!user) {
    console.error("Abbruch: Es wurde kein Benutzer gefunden.");
    process.exitCode = 1;
  } else {
    sqlite.transaction(() => {
      sqlite.prepare(`
        UPDATE users
        SET two_factor_enabled = 0,
            two_factor_secret_envelope = NULL,
            two_factor_enabled_at = NULL,
            updated_at = ?
        WHERE id = ?
      `).run(new Date().toISOString(), user.id);
      sqlite.prepare("DELETE FROM two_factor_backup_codes WHERE user_id = ?").run(user.id);
      sqlite.prepare("DELETE FROM two_factor_login_challenges WHERE user_id = ?").run(user.id);
      sqlite.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id);
    })();
    console.log(`2FA wurde für „${user.username}“ deaktiviert. Alle Sitzungen wurden widerrufen.`);
  }
} finally {
  sqlite.close();
}
