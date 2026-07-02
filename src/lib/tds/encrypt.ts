// AES-256-GCM encryption for the TDS api_key.
// Mirrors src/lib/mydeposits/encrypt.ts but uses its own key (TDS_TOKEN_SECRET)
// so the two integrations' secrets are independent.

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const secret = process.env.TDS_TOKEN_SECRET;
  if (!secret) throw new Error("TDS_TOKEN_SECRET env var is not set.");
  const key = Buffer.from(secret, "hex");
  if (key.length !== 32) {
    throw new Error("TDS_TOKEN_SECRET must be a 32-byte hex string (64 hex chars).");
  }
  return key;
}

export function encryptTdsSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${encrypted.toString("hex")}:${tag.toString("hex")}`;
}

export function decryptTdsSecret(stored: string): string {
  const key = getKey();
  const parts = stored.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted token format.");
  const [ivHex, encryptedHex, tagHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final("utf8");
}
