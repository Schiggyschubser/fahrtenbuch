import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { db, ensureDatabaseReady } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { beginTwoFactorLogin } from "@/lib/repositories/two-factor";
import { loginSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    ensureDatabaseReady();
    const input = loginSchema.parse(await request.json());
    const rows = await db.select().from(users).where(eq(users.username, input.username)).limit(1);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      return NextResponse.json({ error: "Benutzername oder Passwort ist falsch." }, { status: 401 });
    }
    if (user.twoFactorEnabled) {
      return NextResponse.json({
        requiresTwoFactor: true,
        ...await beginTwoFactorLogin(user.id, input.password),
      });
    }
    await createSession(user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
