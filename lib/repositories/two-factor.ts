import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import { ensureDatabaseReady, sqlite } from "../db";
import type { TwoFactorSetupDto, TwoFactorStatusDto } from "../types";
import {
  createBackupCodes,
  createTwoFactorSecret,
  createTwoFactorUri,
  decryptTwoFactorSecret,
  encryptTwoFactorSecret,
  hashBackupCode,
  hashChallengeToken,
  normalizeBackupCode,
  unwrapChallengeSecret,
  verifyTotp,
  wrapChallengeSecret,
} from "../two-factor-crypto";
import { randomBytes } from "node:crypto";

type TwoFactorUserRow = {
  id: number;
  username: string;
  passwordHash: string;
  twoFactorEnabled: number;
  twoFactorSecretEnvelope: string | null;
  twoFactorEnabledAt: string | null;
};

function getTwoFactorUser(userId: number) {
  ensureDatabaseReady();
  return sqlite.prepare(`
    SELECT
      id,
      username,
      password_hash AS passwordHash,
      two_factor_enabled AS twoFactorEnabled,
      two_factor_secret_envelope AS twoFactorSecretEnvelope,
      two_factor_enabled_at AS twoFactorEnabledAt
    FROM users
    WHERE id = ?
  `).get(userId) as TwoFactorUserRow | undefined;
}

async function requirePassword(userId: number, currentPassword: string) {
  const user = getTwoFactorUser(userId);
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new Error("Das aktuelle Passwort ist falsch.");
  }
  return user;
}

function replaceBackupCodes(userId: number, codes: string[]) {
  const now = new Date().toISOString();
  sqlite.prepare("DELETE FROM two_factor_backup_codes WHERE user_id = ?").run(userId);
  const insert = sqlite.prepare(`
    INSERT INTO two_factor_backup_codes (user_id, code_hash, used_at, created_at)
    VALUES (?, ?, NULL, ?)
  `);
  for (const code of codes) insert.run(userId, hashBackupCode(userId, code), now);
}

async function verifySecondFactor(userId: number, secret: string, code: string) {
  if (await verifyTotp(secret, code)) return { backupCodeId: null as number | null };
  const normalized = normalizeBackupCode(code);
  if (normalized.length !== 12) return null;
  const backup = sqlite.prepare(`
    SELECT id
    FROM two_factor_backup_codes
    WHERE user_id = ? AND code_hash = ? AND used_at IS NULL
  `).get(userId, hashBackupCode(userId, normalized)) as { id: number } | undefined;
  return backup ? { backupCodeId: backup.id } : null;
}

function consumeBackupCode(backupCodeId: number | null) {
  if (backupCodeId === null) return;
  const result = sqlite.prepare(`
    UPDATE two_factor_backup_codes
    SET used_at = ?
    WHERE id = ? AND used_at IS NULL
  `).run(new Date().toISOString(), backupCodeId);
  if (result.changes !== 1) throw new Error("Dieser Backup-Code wurde bereits verwendet.");
}

export function getTwoFactorStatus(userId: number): TwoFactorStatusDto {
  const user = getTwoFactorUser(userId);
  if (!user) throw new Error("Benutzer wurde nicht gefunden.");
  const remaining = sqlite.prepare(`
    SELECT COUNT(*) AS count
    FROM two_factor_backup_codes
    WHERE user_id = ? AND used_at IS NULL
  `).get(userId) as { count: number };
  return {
    enabled: Boolean(user.twoFactorEnabled),
    enabledAt: user.twoFactorEnabledAt,
    remainingBackupCodes: remaining.count,
  };
}

export async function createTwoFactorSetup(userId: number, currentPassword: string): Promise<TwoFactorSetupDto> {
  const user = await requirePassword(userId, currentPassword);
  if (user.twoFactorEnabled) throw new Error("Die Zwei-Faktor-Authentifizierung ist bereits aktiv.");
  const secret = createTwoFactorSecret();
  const uri = createTwoFactorUri(user.username, secret);
  const qrCodeDataUrl = await QRCode.toDataURL(uri, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 280,
    color: { dark: "#172033ff", light: "#ffffffff" },
  });
  return { secret, qrCodeDataUrl };
}

export async function enableTwoFactor(userId: number, currentPassword: string, secret: string, code: string) {
  const user = await requirePassword(userId, currentPassword);
  if (user.twoFactorEnabled) throw new Error("Die Zwei-Faktor-Authentifizierung ist bereits aktiv.");
  if (!(await verifyTotp(secret, code))) throw new Error("Der eingegebene Authenticator-Code ist ungültig.");
  const envelope = await encryptTwoFactorSecret(secret, currentPassword);
  const backupCodes = createBackupCodes();
  const now = new Date().toISOString();
  sqlite.transaction(() => {
    sqlite.prepare(`
      UPDATE users
      SET two_factor_enabled = 1,
          two_factor_secret_envelope = ?,
          two_factor_enabled_at = ?,
          updated_at = ?
      WHERE id = ?
    `).run(envelope, now, now, userId);
    replaceBackupCodes(userId, backupCodes);
    sqlite.prepare("DELETE FROM two_factor_login_challenges WHERE user_id = ?").run(userId);
  })();
  return { status: getTwoFactorStatus(userId), backupCodes };
}

export async function disableTwoFactor(userId: number, currentPassword: string, code: string) {
  const user = await requirePassword(userId, currentPassword);
  if (!user.twoFactorEnabled || !user.twoFactorSecretEnvelope) throw new Error("Die Zwei-Faktor-Authentifizierung ist nicht aktiv.");
  const secret = await decryptTwoFactorSecret(user.twoFactorSecretEnvelope, currentPassword);
  const verification = await verifySecondFactor(userId, secret, code);
  if (!verification) throw new Error("Der Sicherheitscode ist ungültig.");
  sqlite.transaction(() => {
    consumeBackupCode(verification.backupCodeId);
    clearTwoFactorData(userId);
  })();
  return getTwoFactorStatus(userId);
}

export async function regenerateBackupCodes(userId: number, currentPassword: string, code: string) {
  const user = await requirePassword(userId, currentPassword);
  if (!user.twoFactorEnabled || !user.twoFactorSecretEnvelope) throw new Error("Die Zwei-Faktor-Authentifizierung ist nicht aktiv.");
  const secret = await decryptTwoFactorSecret(user.twoFactorSecretEnvelope, currentPassword);
  const verification = await verifySecondFactor(userId, secret, code);
  if (!verification) throw new Error("Der Sicherheitscode ist ungültig.");
  const backupCodes = createBackupCodes();
  sqlite.transaction(() => {
    consumeBackupCode(verification.backupCodeId);
    replaceBackupCodes(userId, backupCodes);
  })();
  return { status: getTwoFactorStatus(userId), backupCodes };
}

export async function reencryptTwoFactorSecret(userId: number, currentPassword: string, newPassword: string) {
  const user = getTwoFactorUser(userId);
  if (!user?.twoFactorEnabled) return null;
  if (!user.twoFactorSecretEnvelope) throw new Error("Das 2FA-Geheimnis fehlt.");
  const secret = await decryptTwoFactorSecret(user.twoFactorSecretEnvelope, currentPassword);
  return encryptTwoFactorSecret(secret, newPassword);
}

export async function beginTwoFactorLogin(userId: number, password: string) {
  const user = getTwoFactorUser(userId);
  if (!user?.twoFactorEnabled || !user.twoFactorSecretEnvelope) throw new Error("Die Zwei-Faktor-Authentifizierung ist nicht verfügbar.");
  const secret = await decryptTwoFactorSecret(user.twoFactorSecretEnvelope, password);
  const challengeToken = randomBytes(32).toString("base64url");
  const tokenHash = hashChallengeToken(challengeToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);
  const secretEnvelope = wrapChallengeSecret(secret, challengeToken);
  sqlite.transaction(() => {
    sqlite.prepare("DELETE FROM two_factor_login_challenges WHERE expires_at <= ? OR user_id = ?").run(now.toISOString(), userId);
    sqlite.prepare(`
      INSERT INTO two_factor_login_challenges
        (token_hash, user_id, secret_envelope, expires_at, attempts, created_at)
      VALUES (?, ?, ?, ?, 0, ?)
    `).run(tokenHash, userId, secretEnvelope, expiresAt.toISOString(), now.toISOString());
  })();
  return { challengeToken, expiresAt: expiresAt.toISOString() };
}

export async function completeTwoFactorLogin(challengeToken: string, code: string) {
  ensureDatabaseReady();
  const tokenHash = hashChallengeToken(challengeToken);
  const challenge = sqlite.prepare(`
    SELECT
      c.user_id AS userId,
      c.secret_envelope AS secretEnvelope,
      c.expires_at AS expiresAt,
      c.attempts AS attempts,
      u.two_factor_enabled AS twoFactorEnabled
    FROM two_factor_login_challenges c
    INNER JOIN users u ON u.id = c.user_id
    WHERE c.token_hash = ?
  `).get(tokenHash) as {
    userId: number;
    secretEnvelope: string;
    expiresAt: string;
    attempts: number;
    twoFactorEnabled: number;
  } | undefined;

  if (!challenge || !challenge.twoFactorEnabled || challenge.expiresAt <= new Date().toISOString()) {
    sqlite.prepare("DELETE FROM two_factor_login_challenges WHERE token_hash = ?").run(tokenHash);
    throw new Error("Die 2FA-Anfrage ist abgelaufen. Bitte melde dich erneut an.");
  }

  const secret = unwrapChallengeSecret(challenge.secretEnvelope, challengeToken);
  const verification = await verifySecondFactor(challenge.userId, secret, code);
  if (!verification) {
    const attempts = challenge.attempts + 1;
    if (attempts >= 5) {
      sqlite.prepare("DELETE FROM two_factor_login_challenges WHERE token_hash = ?").run(tokenHash);
      throw new Error("Zu viele Fehlversuche. Bitte melde dich erneut an.");
    }
    sqlite.prepare("UPDATE two_factor_login_challenges SET attempts = ? WHERE token_hash = ?").run(attempts, tokenHash);
    throw new Error("Der Sicherheitscode ist ungültig.");
  }

  sqlite.transaction(() => {
    const deleted = sqlite.prepare("DELETE FROM two_factor_login_challenges WHERE token_hash = ?").run(tokenHash);
    if (deleted.changes !== 1) throw new Error("Die 2FA-Anfrage wurde bereits verwendet.");
    consumeBackupCode(verification.backupCodeId);
  })();
  return { userId: challenge.userId };
}

function clearTwoFactorData(userId: number) {
  const now = new Date().toISOString();
  sqlite.prepare(`
    UPDATE users
    SET two_factor_enabled = 0,
        two_factor_secret_envelope = NULL,
        two_factor_enabled_at = NULL,
        updated_at = ?
    WHERE id = ?
  `).run(now, userId);
  sqlite.prepare("DELETE FROM two_factor_backup_codes WHERE user_id = ?").run(userId);
  sqlite.prepare("DELETE FROM two_factor_login_challenges WHERE user_id = ?").run(userId);
}

export function disableTwoFactorLocally(userId: number) {
  ensureDatabaseReady();
  sqlite.transaction(() => {
    clearTwoFactorData(userId);
    sqlite.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  })();
}
