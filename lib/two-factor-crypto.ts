import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scrypt as scryptCallback,
} from "node:crypto";
import { promisify } from "node:util";
import { generateSecret, generateURI, verify } from "otplib";

const scrypt = promisify(scryptCallback);
const ENVELOPE_AAD = Buffer.from("fahrtenbuch:two-factor:v1", "utf8");
const BACKUP_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

type PasswordEnvelope = {
  v: 1;
  salt: string;
  iv: string;
  tag: string;
  data: string;
};

type ChallengeEnvelope = {
  v: "challenge-1";
  iv: string;
  tag: string;
  data: string;
};

async function passwordKey(password: string, salt: Buffer) {
  return await scrypt(password, salt, 32) as Buffer;
}

function encryptWithKey(plaintext: string, key: Buffer, version: ChallengeEnvelope["v"]): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(ENVELOPE_AAD);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return JSON.stringify({
    v: version,
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    data: encrypted.toString("base64url"),
  } satisfies ChallengeEnvelope);
}

function decryptWithKey(envelopeValue: string, key: Buffer, expectedVersion: ChallengeEnvelope["v"]): string {
  try {
    const envelope = JSON.parse(envelopeValue) as ChallengeEnvelope;
    if (envelope.v !== expectedVersion) throw new Error("unsupported envelope");
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64url"));
    decipher.setAAD(ENVELOPE_AAD);
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(envelope.data, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Das 2FA-Geheimnis konnte nicht entschlüsselt werden.");
  }
}

export async function encryptTwoFactorSecret(secret: string, password: string) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await passwordKey(password, salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(ENVELOPE_AAD);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return JSON.stringify({
    v: 1,
    salt: salt.toString("base64url"),
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    data: encrypted.toString("base64url"),
  } satisfies PasswordEnvelope);
}

export async function decryptTwoFactorSecret(envelopeValue: string, password: string) {
  try {
    const envelope = JSON.parse(envelopeValue) as PasswordEnvelope;
    if (envelope.v !== 1) throw new Error("unsupported envelope");
    const key = await passwordKey(password, Buffer.from(envelope.salt, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64url"));
    decipher.setAAD(ENVELOPE_AAD);
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(envelope.data, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Das aktuelle Passwort ist falsch oder das 2FA-Geheimnis ist beschädigt.");
  }
}

export function wrapChallengeSecret(secret: string, challengeToken: string) {
  const key = createHash("sha256").update(`challenge:${challengeToken}`).digest();
  return encryptWithKey(secret, key, "challenge-1");
}

export function unwrapChallengeSecret(envelope: string, challengeToken: string) {
  const key = createHash("sha256").update(`challenge:${challengeToken}`).digest();
  return decryptWithKey(envelope, key, "challenge-1");
}

export function createTwoFactorSecret() {
  return generateSecret();
}

export function createTwoFactorUri(username: string, secret: string) {
  return generateURI({ issuer: "Fahrtenbuch", label: username, secret });
}

export async function verifyTotp(secret: string, token: string) {
  if (!/^\d{6}$/.test(token.trim())) return false;
  return (await verify({ secret, token: token.trim(), epochTolerance: 30 })).valid;
}

export function normalizeBackupCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hashBackupCode(userId: number, value: string) {
  return createHash("sha256").update(`${userId}:${normalizeBackupCode(value)}`).digest("hex");
}

export function createBackupCodes(count = 10) {
  return Array.from({ length: count }, () => {
    let raw = "";
    while (raw.length < 12) {
      const bytes = randomBytes(12);
      for (const byte of bytes) {
        raw += BACKUP_ALPHABET[byte % BACKUP_ALPHABET.length];
        if (raw.length === 12) break;
      }
    }
    return raw.match(/.{1,4}/g)!.join("-");
  });
}

export function hashChallengeToken(token: string) {
  return createHash("sha256").update(`lookup:${token}`).digest("hex");
}
