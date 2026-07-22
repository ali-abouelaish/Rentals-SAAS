import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// AES-256-GCM encryption for per-agency email provider credentials at rest.
// Mirrors src/lib/gmail/encrypt.ts (and tds/dps) — one key per integration.
// Stored format: {ivHex}:{ciphertextHex}:{tagHex}.

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const secret = process.env.EMAIL_PROVIDER_TOKEN_SECRET;
  if (!secret) throw new Error("EMAIL_PROVIDER_TOKEN_SECRET env var is not set.");
  const key = Buffer.from(secret, "hex");
  if (key.length !== 32) {
    throw new Error("EMAIL_PROVIDER_TOKEN_SECRET must be a 32-byte hex string (64 hex chars).");
  }
  return key;
}

export function encryptProviderCredentials(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${encrypted.toString("hex")}:${tag.toString("hex")}`;
}

export function decryptProviderCredentials(stored: string): string {
  const key = getKey();
  const parts = stored.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted credentials format.");
  const [ivHex, encryptedHex, tagHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final("utf8");
}
