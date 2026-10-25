"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  decideOAuthConsent,
  type OAuthConsentState
} from "@/features/auth/actions/oauth-consent";
import { ArrowIcon } from "@/features/auth/ui/door/icons";

function DecisionButtons({ clientName }: { clientName: string }) {
  const { pending } = useFormStatus();
  return (
    <div className="plate__actions">
      <button
        type="submit"
        name="decision"
        value="approve"
        className="submit"
        disabled={pending}
        aria-busy={pending}
      >
        <span className="spin" aria-hidden="true" />
        <span className="submit__label">{pending ? "Working…" : `Allow ${clientName} access`}</span>
        <ArrowIcon />
      </button>
      <button
        type="submit"
        name="decision"
        value="deny"
        className="submit submit--quiet"
        disabled={pending}
      >
        <span className="submit__label">Don&apos;t allow</span>
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
      {state?.error ? (
        <div className="alert" role="alert">
          <p>{state.error}</p>
        </div>
      ) : null}
      <DecisionButtons clientName={clientName} />
      <p className="plate__note">
        Only allow applications you recognise. Choosing &ldquo;Don&apos;t
        allow&rdquo; sends you back without sharing anything.
      </p>
    </form>
  );
}
