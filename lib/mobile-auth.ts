import { createHash, randomBytes, randomUUID } from "node:crypto";
import { ensureDatabaseReady, sqlite } from "./db";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export function createMobileSession(userId: number) {
  ensureDatabaseReady();
  const accessToken = `fbm_${randomBytes(32).toString("base64url")}`;
  const expiresIn = 30 * 24 * 60 * 60;
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  sqlite.prepare("INSERT INTO sessions (id, token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(randomUUID(), hash(accessToken), userId, expiresAt, new Date().toISOString());
  return { accessToken, tokenType: "Bearer" as const, expiresIn, expiresAt };
}

export function mobileUser(request: Request) {
  const match = /^Bearer (fbm_[A-Za-z0-9_-]{43})$/i.exec(request.headers.get("authorization") ?? "");
  if (!match) return null;
  ensureDatabaseReady();
  const tokenHash = hash(match[1]);
  const user = sqlite.prepare(`SELECT u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?`).get(tokenHash, new Date().toISOString()) as
    { id: number; username: string } | undefined;
  return user ? { ...user, tokenHash } : null;
}

// Bounded per-process limits; do not trust a caller-supplied forwarding IP.
const attempts = new Map<string, { count: number; until: number }>();
export function allowMobileLogin(username: string) {
  const now = Date.now();
  for (const [key, entry] of attempts) if (entry.until <= now) attempts.delete(key);
  const keys = ["global", hash(username.toLocaleLowerCase("en-US"))];
  const limits = [30, 5];
  for (let i = 0; i < keys.length; i++) {
    if ((attempts.get(keys[i])?.count ?? 0) >= limits[i]) return false;
  }
  for (const key of keys) {
    const entry = attempts.get(key) ?? { count: 0, until: now + 60_000 };
    entry.count++;
    attempts.set(key, entry);
  }
  return true;
}
