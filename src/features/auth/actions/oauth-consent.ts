"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const decisionSchema = z.object({
  authorizationId: z
    .string()
    .min(1, "This sign-in request is missing its authorization id.")
    .max(255, "Authorization id is not valid."),
  decision: z.enum(["approve", "deny"], {
    errorMap: () => ({ message: "Choose Allow or Don't allow." })
  })
});

export type OAuthConsentState = { error?: string };

/**
 * Approves or denies a pending OAuth 2.1 authorization request ("Log in with
 * Harbor Ops"). Supabase Auth redirects third-party users to /oauth/consent
 * with an authorization_id; this action records the signed-in user's decision
 * and sends them back to the requesting application.
 */
export async function decideOAuthConsent(
  _prevState: OAuthConsentState | undefined,
  formData: FormData
): Promise<OAuthConsentState> {
  const parsed = decisionSchema.safeParse({
    authorizationId: formData.get("authorization_id"),
    decision: formData.get("decision")
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid consent request." };
  }
  const { authorizationId, decision } = parsed.data;

  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(
      `/login?next=${encodeURIComponent(
        `/oauth/consent?authorization_id=${authorizationId}`
      )}`
    );
  }

  const { data, error } =
    decision === "approve"
      ? await supabase.auth.oauth.approveAuthorization(authorizationId, {
          skipBrowserRedirect: true
        })
      : await supabase.auth.oauth.denyAuthorization(authorizationId, {
          skipBrowserRedirect: true
        });

  if (error || !data?.redirect_url) {
    return {
      error:
        error?.message ??
        "Could not complete this request. It may have expired — go back to the application and start signing in again."
    };
  }

  // Sends the user back to the third-party application's redirect URI with
  // either an authorization code (approve) or an access_denied error (deny).
  redirect(data.redirect_url);
}
