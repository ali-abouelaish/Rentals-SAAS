"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  decideOAuthConsent,
  type OAuthConsentState
} from "@/features/auth/actions/oauth-consent";

function DecisionButtons({ clientName }: { clientName: string }) {
  const { pending } = useFormStatus();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <button
        type="submit"
        name="decision"
        value="approve"
        className="btn btn-primary"
        disabled={pending}
      >
        {pending ? "Working…" : `Allow ${clientName} access`}
      </button>
      <button
        type="submit"
        name="decision"
        value="deny"
        className="btn btn-secondary"
        disabled={pending}
      >
        Don&apos;t allow
      </button>
    </div>
  );
}

const initialState: OAuthConsentState = {};

export function ConsentForm({
  authorizationId,
  clientName
}: {
  authorizationId: string;
  clientName: string;
}) {
  const [state, formAction] = useFormState(decideOAuthConsent, initialState);

  return (
    <form action={formAction}>
      <input type="hidden" name="authorization_id" value={authorizationId} />
      {state?.error ? <div className="alert err">{state.error}</div> : null}
      <DecisionButtons clientName={clientName} />
      <p className="hint" style={{ marginTop: 10 }}>
        Only allow applications you recognise. Choosing &ldquo;Don&apos;t
        allow&rdquo; sends you back without sharing anything.
      </p>
    </form>
  );
}
