import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const PASSWORD_KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, PASSWORD_KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, key] = storedHash.split(":");
  if (!salt || !key) return false;

  try {
    const derivedKey = scryptSync(password, salt, PASSWORD_KEY_LENGTH);
    const storedKey = Buffer.from(key, "hex");
    return storedKey.length === derivedKey.length && timingSafeEqual(storedKey, derivedKey);
  } catch {
    return false;
  }
}

export function createAuthToken(studentId: number): string {
  const payload = `${studentId}.${Date.now()}`;
  const signature = createHmac("sha256", process.env.SESSION_SECRET || "dev-secret-key-change-in-production")
    .update(payload)
    .digest("hex");
  return `${payload}.${signature}`;
}

export function readAuthToken(token: string | undefined): number | undefined {
  if (!token) return undefined;
  const parts = token.split(".");
  if (parts.length !== 3) return undefined;
  const [idPart, timestamp, signature] = parts;
  const payload = `${idPart}.${timestamp}`;
  const expected = createHmac("sha256", process.env.SESSION_SECRET || "dev-secret-key-change-in-production")
    .update(payload)
    .digest("hex");

  try {
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return undefined;
    const id = Number(idPart);
    const issuedAt = Number(timestamp);
    if (!Number.isInteger(id) || !Number.isFinite(issuedAt)) return undefined;
    // Keep the browser login valid for 30 days, including after a server restart.
    if (Date.now() - issuedAt > 30 * 24 * 60 * 60 * 1000) return undefined;
    return id;
  } catch {
    return undefined;
  }
}