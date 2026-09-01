import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { errorResponse, unauthorizedResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { restoreBackup } from "@/lib/backups";
import { db, ensureDatabaseReady } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { restoreBackupSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const currentUser = await requireApiUser();
    if (!currentUser) return unauthorizedResponse();
    const input = restoreBackupSchema.parse(await request.json());
    ensureDatabaseReady();
    const rows = await db.select().from(users).where(eq(users.id, currentUser.id)).limit(1);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(input.currentPassword, user.passwordHash))) {
      return NextResponse.json({ error: "Das aktuelle Passwort ist falsch." }, { status: 400 });
    }
    const result = await restoreBackup(input.backupId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error, "Die Sicherung konnte nicht wiederhergestellt werden.");
  }
}
