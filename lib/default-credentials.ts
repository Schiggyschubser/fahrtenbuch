import bcrypt from "bcryptjs";

const DEFAULT_USERNAME = "admin";
const DEFAULT_PASSWORD = "admin";
const passwordHashCache = new Map<string, boolean>();

export function isDefaultCredentialInput(username: string, password: string) {
  return username === DEFAULT_USERNAME && password === DEFAULT_PASSWORD;
}

export async function hasDefaultCredentials(username: string, passwordHash: string) {
  if (username !== DEFAULT_USERNAME) return false;
  const cachedResult = passwordHashCache.get(passwordHash);
  if (cachedResult !== undefined) return cachedResult;
  const result = await bcrypt.compare(DEFAULT_PASSWORD, passwordHash);
  passwordHashCache.set(passwordHash, result);
  return result;
}
