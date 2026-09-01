import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const testDirectory = path.join(os.tmpdir(), "fahrtenbuch-tests");
fs.mkdirSync(testDirectory, { recursive: true });
const databasePath = path.join(testDirectory, "test.db");
for (const suffix of ["", "-shm", "-wal"]) {
  const file = `${databasePath}${suffix}`;
  if (fs.existsSync(file)) fs.rmSync(file);
}
process.env.DATABASE_PATH = databasePath;
process.env.BACKUP_DIR = path.join(testDirectory, "backups");
