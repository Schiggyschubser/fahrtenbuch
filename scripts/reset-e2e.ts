import fs from "node:fs";
import path from "node:path";

const databasePath = path.resolve(process.cwd(), "data", "e2e.db");
for (const suffix of ["", "-shm", "-wal"]) {
  const file = `${databasePath}${suffix}`;
  if (fs.existsSync(file)) fs.rmSync(file);
}
