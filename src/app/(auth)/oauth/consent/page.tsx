import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthShell } from "@/components/auth/AuthShell";
import { ConsentForm } from "./ConsentForm";

export const dynamic = "force-dynamic";

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
    <AuthShell
      pill="Authorize access"
      heading={
        <>
          This sign-in request <em>can&apos;t continue</em>.
        </>
      }
      lede={message}
      foot={
        <>
          Came here by accident? <Link href="/login">Go to sign in</Link>
        </>
      }
    >
      <div className="alert warn">
        Close this tab and start signing in again from the application you came
        from. If it keeps failing, contact the application&apos;s support.
      </div>
    </AuthShell>
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

  return (
    <AuthShell
      pill="Authorize access"
      heading={
        <>
          Connect <em>{details.client.name}</em> to your Harbor Ops account.
        </>
      }
      lede={
        <>
          {details.client.name} is asking to sign you in with Harbor Ops. You
          are signed in as <strong>{details.user.email}</strong> — not you?{" "}
          <Link href={`/login?next=${encodeURIComponent(`/oauth/consent?authorization_id=${authorizationId}`)}`}>
            Switch account
          </Link>
          .
        </>
      }
      foot={
        clientHost ? (
          <>
            You will be returned to <strong>{clientHost}</strong> after you
            decide.
          </>
        ) : undefined
      }
    >
      <div className="field">
        <span className="lab">This application will be able to</span>
        <ul
          style={{
            margin: "6px 0 0",
            paddingLeft: 18,
            display: "grid",
            gap: 6
          }}
        >
          {(scopes.length > 0 ? scopes : ["openid"]).map((scope) => (
            <li key={scope}>{SCOPE_DESCRIPTIONS[scope] ?? scope}</li>
          ))}
        </ul>
        <p className="hint">
          It will never see your Harbor Ops password, and it only gets the
          permissions listed above.
        </p>
      </div>

      <ConsentForm
        authorizationId={authorizationId}
        clientName={details.client.name}
      />
    </AuthShell>
  );
}
