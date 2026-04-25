import { createHash, randomBytes } from "crypto";

const KEY_PREFIX = "hopk_";

export function generateApiKey(): { plaintext: string; hash: string; prefix: string } {
  const raw = randomBytes(32).toString("base64url");
  const plaintext = `${KEY_PREFIX}${raw}`;
  return {
    plaintext,
    hash: hashApiKey(plaintext),
    prefix: plaintext.slice(0, 12),
  };
}

export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext.trim()).digest("hex");
}

export function extractBearer(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : headerValue.trim();
}
