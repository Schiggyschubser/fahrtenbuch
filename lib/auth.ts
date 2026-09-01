import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db, ensureDatabaseReady } from "./db";
import { sessions, users } from "./db/schema";
import { hasDefaultCredentials } from "./default-credentials";
import type { UserDto } from "./types";
import { maybeCreateAutomaticBackup } from "./backups";

export const SESSION_COOKIE = "fahrtenbuch_session";
const SESSION_DAYS = 30;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: number) {
  ensureDatabaseReady();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({
    id: randomUUID(),
    tokenHash: hashToken(token),
    userId,
    expiresAt: expiresAt.toISOString(),
    createdAt: new Date().toISOString(),
  });
  const cookieStore = await cookies();
  const forwardedProto = (await headers()).get("x-forwarded-proto")?.split(",")[0]?.trim();
  const secureOverride = process.env.SESSION_COOKIE_SECURE?.trim().toLowerCase();
  const secureCookie = secureOverride === "true"
    ? true
    : secureOverride === "false"
      ? false
      : forwardedProto === "https";

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookie,
    expires: expiresAt,
    path: "/",
  });
}

export async function getCurrentUser(): Promise<UserDto | null> {
  ensureDatabaseReady();
  await maybeCreateAutomaticBackup();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      passwordHash: users.passwordHash,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date().toISOString())))
    .limit(1);
  const user = rows[0];
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    usesDefaultCredentials: await hasDefaultCredentials(user.username, user.passwordHash),
  };
}

export async function areDefaultCredentialsActive() {
  ensureDatabaseReady();
  const rows = await db
    .select({ username: users.username, passwordHash: users.passwordHash })
    .from(users)
    .limit(1);
  const user = rows[0];
  return user ? hasDefaultCredentials(user.username, user.passwordHash) : false;
}

export async function requirePageUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireApiUser() {
  return getCurrentUser();
}

export async function destroyCurrentSession() {
  ensureDatabaseReady();
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  cookieStore.delete(SESSION_COOKIE);
}

export async function revokeAllSessions(userId: number) {
  ensureDatabaseReady();
  await db.delete(sessions).where(eq(sessions.userId, userId));
}
