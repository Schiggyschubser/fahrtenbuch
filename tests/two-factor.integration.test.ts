import bcrypt from "bcryptjs";
import { generate } from "otplib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureDatabaseReady, sqlite } from "@/lib/db";
import {
  beginTwoFactorLogin,
  completeTwoFactorLogin,
  createTwoFactorSetup,
  disableTwoFactor,
  enableTwoFactor,
  getTwoFactorStatus,
} from "@/lib/repositories/two-factor";

describe("2FA-Repository", () => {
  const username = "zwei-faktor-test";
  const password = "sehr-sicheres-passwort";
  let userId = 0;

  beforeAll(async () => {
    ensureDatabaseReady();
    const now = new Date().toISOString();
    const result = sqlite.prepare(`
      INSERT INTO users (username, password_hash, uses_default_credentials, created_at, updated_at)
      VALUES (?, ?, 0, ?, ?)
    `).run(username, await bcrypt.hash(password, 4), now, now);
    userId = Number(result.lastInsertRowid);
  });

  afterAll(() => {
    if (!userId) return;
    sqlite.prepare("DELETE FROM two_factor_login_challenges WHERE user_id = ?").run(userId);
    sqlite.prepare("DELETE FROM two_factor_backup_codes WHERE user_id = ?").run(userId);
    sqlite.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
    sqlite.prepare("DELETE FROM users WHERE id = ?").run(userId);
  });

  it("richtet 2FA ein und schließt Login-Challenges nur einmal ab", async () => {
    const setup = await createTwoFactorSetup(userId, password);
    expect(setup.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);

    const activationToken = await generate({ secret: setup.secret });
    const enabled = await enableTwoFactor(userId, password, setup.secret, activationToken);
    expect(enabled.status).toEqual(expect.objectContaining({ enabled: true, remainingBackupCodes: 10 }));
    expect(enabled.backupCodes).toHaveLength(10);

    const challenge = await beginTwoFactorLogin(userId, password);
    const loginToken = await generate({ secret: setup.secret });
    await expect(completeTwoFactorLogin(challenge.challengeToken, loginToken)).resolves.toEqual({ userId });
    await expect(completeTwoFactorLogin(challenge.challengeToken, loginToken)).rejects.toThrow();

    const backupChallenge = await beginTwoFactorLogin(userId, password);
    await expect(completeTwoFactorLogin(backupChallenge.challengeToken, enabled.backupCodes[0])).resolves.toEqual({ userId });
    expect(getTwoFactorStatus(userId).remainingBackupCodes).toBe(9);

    const disableToken = await generate({ secret: setup.secret });
    await expect(disableTwoFactor(userId, password, disableToken)).resolves.toEqual(expect.objectContaining({
      enabled: false,
      remainingBackupCodes: 0,
    }));
  });
});
