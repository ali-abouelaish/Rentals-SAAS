import { randomBytes } from "crypto";

export function generateShareToken(): string {
  return randomBytes(18).toString("base64url");
}
