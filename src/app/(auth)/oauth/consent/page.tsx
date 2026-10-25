import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { switchAccount } from "@/features/auth/actions/auth";
import { DoorShell } from "@/features/auth/ui/door/DoorShell";
import { Plate } from "@/features/auth/ui/door/Plate";
import { ConsentForm } from "./ConsentForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Authorize access",
};

// Human-readable explanations for the OAuth/OIDC scopes a client can request.
// Unknown scopes fall back to the raw scope name so nothing is hidden.
const SCOPE_DESCRIPTIONS: Record<string, string> = {
  openid: "Confirm who you are (OpenID Connect sign-in)",
  email: "See the email address on your account",
  profile: "See your basic profile details",
  offline_access: "Stay signed in without asking you again"
};

function ConsentError({ message }: { message: string }) {
  return (
    <DoorShell knocker>
      <Plate title="This sign-in request can’t continue." sub={message}>
        <div className="alert" role="alert">
          <p>
            Close this tab and start signing in again from the application you came
            from. If it keeps failing, contact the application&apos;s support.
          </p>
        </div>
        <p className="plate__note">
          Came here by accident? <a href="/login">Go to sign in</a>
        </p>
      </Plate>
    </DoorShell>
  );
}

export default async function OAuthConsentPage({
  searchParams
}: {
  searchParams: { authorization_id?: string };
}) {
  const authorizationId = searchParams?.authorization_id ?? "";

  if (!authorizationId) {
    return (
      <ConsentError message="The link that brought you here is missing its authorization id, so there is nothing to approve." />
    );
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    // Middleware normally bounces unauthenticated visitors before this runs;
    // this covers direct hits with a stale session cookie.
    redirect(
      `/login?next=${encodeURIComponent(
        `/oauth/consent?authorization_id=${authorizationId}`
      )}`
    );
  }

  const { data: details, error } =
    await supabase.auth.oauth.getAuthorizationDetails(authorizationId);

  if (error || !details) {
    return (
      <ConsentError message="This sign-in request is invalid or has expired. Authorization requests are single-use and short-lived." />
    );
  }

  // The user already granted this client access — Supabase short-circuits the
  // consent step and hands back the redirect straight away.
  if (details.redirect_url) {
    redirect(details.redirect_url);
  }

  const scopes = (details.scope ?? "")
    .split(" ")
    .map((s) => s.trim())
    .filter(Boolean);

  const clientHost = (() => {
    try {
      return details.client.uri ? new URL(details.client.uri).host : null;
    } catch {
      return null;
    }
  })();

  const switchTo = switchAccount.bind(null, `/oauth/consent?authorization_id=${authorizationId}`);

  return (
    <DoorShell knocker>
      <Plate
        title={`Connect ${details.client.name} to Harbor.`}
        sub={
          <>
            {details.client.name} is asking to sign you in with Harbor. You are signed in as{" "}
            <strong>{details.user.email}</strong>.
          </>
        }
      >
        <ul className="plate__list" aria-label="This application will be able to">
          {(scopes.length > 0 ? scopes : ["openid"]).map((scope) => (
            <li key={scope}>{SCOPE_DESCRIPTIONS[scope] ?? scope}</li>
          ))}
        </ul>
        <p className="plate__note">
          It will never see your Harbor password, and it only gets the permissions listed above.
          {clientHost ? (
            <>
              {" "}
              You’ll return to <strong>{clientHost}</strong> after you decide.
            </>
          ) : null}
        </p>

        <ConsentForm authorizationId={authorizationId} clientName={details.client.name} />

        <form action={switchTo} className="plate__note">
          Not you?{" "}
          <button type="submit" className="plate__link">
            Switch account
          </button>
        </form>
      </Plate>
    </DoorShell>
  );
}
