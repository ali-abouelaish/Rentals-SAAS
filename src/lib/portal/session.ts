import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { SESSION_TTL_MS, signPortalToken, verifyPortalToken } from "./token";

/**
 * Renter portal session cookie.
 *
 * Deliberately host-only (no `domain` attribute — do NOT use
 * getSharedCookieDomain here): staff Supabase cookies span every tenant
 * subdomain so one login works everywhere, but a renter session must stay
 * pinned to the single agency subdomain it was created on. Scoped to
 * path=/portal so it never rides along on staff routes.
 */

const COOKIE_NAME = "ho_renter_session";

export type PortalSession = {
  pmTenantId: string;
  tenantId: string;
};

export function createPortalSessionCookie(
  res: NextResponse,
  session: PortalSession
): void {
  const token = signPortalToken(
    { typ: "session", pmTenantId: session.pmTenantId, tenantId: session.tenantId },
    SESSION_TTL_MS
  );
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/portal",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export function clearPortalSessionCookie(res: NextResponse): void {
  res.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/portal",
    maxAge: 0,
  });
}

/** Read + verify the session cookie in a server component / server context. */
export function getPortalSession(): PortalSession | null {
  const value = cookies().get(COOKIE_NAME)?.value;
  if (!value) return null;
  const claims = verifyPortalToken(value, "session");
  if (!claims) return null;
  return { pmTenantId: claims.pmTenantId, tenantId: claims.tenantId };
}

/** Read + verify the session cookie from a raw Request (route handlers). */
export function getPortalSessionFromRequest(req: Request): PortalSession | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  const match = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  const value = decodeURIComponent(match.slice(COOKIE_NAME.length + 1));
  const claims = verifyPortalToken(value, "session");
  if (!claims) return null;
  return { pmTenantId: claims.pmTenantId, tenantId: claims.tenantId };
}
