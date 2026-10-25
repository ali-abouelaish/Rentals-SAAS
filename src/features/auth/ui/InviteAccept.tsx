"use client";

import { useState } from "react";
import { ArrowIcon } from "./door/icons";
import { useHydrated } from "./door/useHydrated";

/**
 * Accepting an invite: one press to verify the emailed token (/api/invite/complete), which then
 * sends the person on to choose a password. `initialError` is what /auth/callback hands back when
 * an invite link couldn't be used.
 */
export function InviteAccept({
  tokenHash,
  type,
  initialError,
}: {
  tokenHash: string | null;
  type: string;
  initialError: string | null;
}) {
  const hydrated = useHydrated();
  const [loading, setLoading] = useState(false);

  async function handleContinue() {
    if (!tokenHash) {
      window.location.href = "/auth/error?reason=missing_token";
      return;
    }
    setLoading(true);
    const res = await fetch("/api/invite/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token_hash: tokenHash, type }),
    });
    const data = (await res.json().catch(() => ({}))) as { redirectTo?: string };
    if (!res.ok) {
      window.location.href = data.redirectTo || "/auth/error?reason=invalid_or_expired";
      return;
    }
    window.location.href = data.redirectTo || "/invite/set-password";
  }

  return (
    <>
      {initialError ? (
        <div className="alert" role="alert">
          <p>
            That invite link didn’t work ({initialError}). Ask whoever invited you to send a new one.
          </p>
        </div>
      ) : null}
      <div className="plate__actions">
        <button className="submit" type="button" onClick={handleContinue} disabled={!hydrated || loading} aria-busy={loading}>
          <span className="spin" aria-hidden="true" />
          <span className="submit__label">{loading ? "Checking your invite…" : "Accept the invitation"}</span>
          <ArrowIcon />
        </button>
      </div>
      <p className="plate__note">
        Already set a password? <a href="/login">Sign in</a>
      </p>
    </>
  );
}
