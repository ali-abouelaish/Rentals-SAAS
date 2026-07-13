"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import { signInWithEmail } from "@/features/auth/actions/auth";
import { AuthShell, CheckIcon, EyeIcon } from "@/components/auth/AuthShell";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? "Signing in…" : "Sign in to workspace →"}
    </button>
  );
}

const initialState: { error?: string } = {};

function LoginForm() {
  const [state, formAction] = useFormState(signInWithEmail, initialState);
  const [showPw, setShowPw] = useState(false);
  const searchParams = useSearchParams();
  const disabledNotice = searchParams?.get("disabled") === "1";
  // Deep-link destination preserved through the auth bounce (e.g. a landlord
  // link). Only forward a same-site absolute path.
  const nextRaw = searchParams?.get("next") ?? "";
  const nextPath = /^\/[^/\\]/.test(nextRaw) ? nextRaw : "";

  return (
    <AuthShell
      pill="Sign in"
      heading={<>Welcome back to your <em>operations</em>.</>}
      lede="Sign in to your Harbor Ops workspace. Rooms, tenancies and margin — right where you left them."
      foot={
        <>
          Prefer to request a demo? <Link href="/signup">Get access</Link>
        </>
      }
    >
      <form action={formAction}>
        {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
        <div className="field">
          <label className="lab" htmlFor="login-email">Work email</label>
          <input
            id="login-email"
            className="input"
            name="email"
            type="email"
            placeholder="operator@company.co.uk"
            required
            autoComplete="email"
          />
        </div>
        <div className="field">
          <label className="lab" htmlFor="login-password">
            Password
            <Link href="/forgot-password">Forgot?</Link>
          </label>
          <div className="input-wrap">
            <input
              id="login-password"
              className="input"
              name="password"
              type={showPw ? "text" : "password"}
              placeholder="••••••••••••"
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              className="eye"
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? "Hide password" : "Show password"}
              style={showPw ? { color: "var(--ink-900)" } : undefined}
            >
              <EyeIcon />
            </button>
          </div>
        </div>

        <label className="check">
          <input type="checkbox" name="stay_signed_in" defaultChecked />
          <span className="box"><CheckIcon /></span>
          <span>Keep me signed in on this device</span>
        </label>

        {state?.error ? <div className="alert err">{state.error}</div> : null}
        {!state?.error && disabledNotice ? (
          <div className="alert err">Your account has been disabled. Contact your admin.</div>
        ) : null}

        <SubmitButton />
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
