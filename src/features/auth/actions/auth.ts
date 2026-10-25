"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSharedCookieDomain } from "@/lib/supabase/cookie-domain";
import { safeNextPath } from "@/lib/auth/safeNext";
import { sessionIdFromAccessToken, sessionPersistenceCookies } from "@/lib/auth/sessionPersistence";
import { resolveWorkspaceUrl } from "@/lib/auth/workspaceUrl";
import { forgotPasswordSchema, loginSchema } from "../domain/schemas";

const signInInput = loginSchema.extend({ next: z.string().max(2048).nullish() });

export type SignInResult =
  | { ok: true; redirectTo: string }
  | {
      ok: false;
      error: string;
      /** "credentials": the form offers a password reset beside the message. */
      kind?: "credentials";
      fields?: Partial<Record<"email" | "password", string>>;
    };

/** The "Keep me signed in" markers (src/lib/auth/sessionPersistence.ts), on the shared cookie domain. */
function writePersistenceMarkers(keepSignedIn: boolean, sessionId: string | null) {
  const store = cookies();
  const cookieList = sessionPersistenceCookies({
    keepSignedIn,
    sessionId,
    domain: getSharedCookieDomain(),
    secure: process.env.NODE_ENV === "production",
  });
  for (const cookie of cookieList) store.set(cookie.name, cookie.value, cookie.options);
}

function signInError(error: { message?: string; status?: number; code?: string }): SignInResult {
  const message = (error.message ?? "").toLowerCase();
  if (error.code === "invalid_credentials" || message.includes("invalid login credentials")) {
    return { ok: false, kind: "credentials", error: "That email and password don’t match." };
  }
  if (error.code === "email_not_confirmed" || message.includes("email not confirmed")) {
    return { ok: false, error: "Confirm your email address first: the link is in your inbox." };
  }
  if (error.status === 429 || message.includes("rate limit")) {
    return { ok: false, error: "Too many attempts. Wait a few minutes, then try again." };
  }
  return { ok: false, error: error.message || "Sign-in didn’t work. Try again." };
}

/**
 * Sign in with email and password. Returns where to go rather than redirecting, so the door can
 * swing open first; the browser then navigates there itself (often to the agency's own subdomain,
 * where the shared session cookie signs them straight in).
 */
export async function signInWithEmail(input: unknown): Promise<SignInResult> {
  const parsed = signInInput.safeParse(input);
  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fields: { email: fields.email?.[0], password: fields.password?.[0] },
    };
  }
  const { email, password, stay_signed_in } = parsed.data;
  // Optional post-login destination (e.g. a landlord deep link): only a path on this site.
  const next = safeNextPath(parsed.data.next);

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return signInError(error);

  const userId = data.user?.id;
  if (!userId) return { ok: false, error: "Sign-in didn’t work. Try again." };

  const { data: agentProfile } = await supabase
    .from("agent_profiles")
    .select("is_disabled")
    .eq("user_id", userId)
    .maybeSingle();

  if (agentProfile?.is_disabled) {
    await supabase.auth.signOut();
    writePersistenceMarkers(true, null);
    return { ok: false, error: "This account has been disabled. Contact your admin." };
  }

  writePersistenceMarkers(stay_signed_in, sessionIdFromAccessToken(data.session?.access_token));
  return { ok: true, redirectTo: await resolveWorkspaceUrl({ userId, host: headers().get("host"), next }) };
}

export async function signUpWithEmail(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email,
    password
  });
  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  writePersistenceMarkers(true, null);
  redirect("/login");
}

/**
 * "Not you? Switch account": sign out, then show the sign-in form with the same destination. (A
 * plain link to /login wouldn't do: middleware forwards signed-in visitors past it.)
 */
export async function switchAccount(next: string) {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  writePersistenceMarkers(true, null);
  const path = safeNextPath(next);
  redirect(path ? `/login?next=${encodeURIComponent(path)}` : "/login");
}

export type PasswordResetResult =
  | { ok: true }
  | { ok: false; error: string; fields?: Partial<Record<"email", string>> };

export async function requestPasswordResetForSignedOut(input: unknown): Promise<PasswordResetResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted field.", fields: { email: parsed.error.flatten().fieldErrors.email?.[0] } };
  }

  const supabase = createSupabaseServerClient();
  const headersList = headers();
  const origin =
    headersList.get("origin") ??
    headersList.get("x-url") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (error.status === 429 || message.includes("rate limit")) {
      return { ok: false, error: "Too many requests. Wait a few minutes, then try again." };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
