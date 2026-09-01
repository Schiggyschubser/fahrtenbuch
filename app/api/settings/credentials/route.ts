import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { errorResponse, unauthorizedResponse } from "@/lib/api";
import { createSession, requireApiUser, revokeAllSessions } from "@/lib/auth";
import { db, ensureDatabaseReady } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { isDefaultCredentialInput } from "@/lib/default-credentials";
import { reencryptTwoFactorSecret } from "@/lib/repositories/two-factor";
import { credentialsSchema } from "@/lib/validation";

export async function PUT(request: Request) {
  try {
    const currentUser = await requireApiUser();
    if (!currentUser) return unauthorizedResponse();
    ensureDatabaseReady();
    const input = credentialsSchema.parse(await request.json());
    const rows = await db.select().from(users).where(eq(users.id, currentUser.id)).limit(1);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(input.currentPassword, user.passwordHash))) {
      return NextResponse.json({ error: "Das aktuelle Passwort ist falsch." }, { status: 400 });
    }
    const now = new Date().toISOString();
    const twoFactorSecretEnvelope = await reencryptTwoFactorSecret(user.id, input.currentPassword, input.newPassword);
    await db.update(users).set({
      username: input.username,
      passwordHash: await bcrypt.hash(input.newPassword, 12),
      usesDefaultCredentials: isDefaultCredentialInput(input.username, input.newPassword),
      twoFactorSecretEnvelope,
      updatedAt: now,
    }).where(eq(users.id, user.id));
    await revokeAllSessions(user.id);
    await createSession(user.id);
    return NextResponse.json({ ok: true, username: input.username });
  } catch (error) {
    return errorResponse(error);
  }
}
