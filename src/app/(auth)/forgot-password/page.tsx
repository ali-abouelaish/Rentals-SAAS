"use client";

import Link from "next/link";
import { Suspense, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { requestPasswordResetForSignedOut } from "@/features/auth/actions/auth";

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const callbackError = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(callbackError);
  const inFlight = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    setPending(true);

    const formData = new FormData();
    formData.set("email", email.trim());
    const result = await requestPasswordResetForSignedOut({}, formData);

    inFlight.current = false;
    setPending(false);

    if (result?.error) {
      const msg = result.error.toLowerCase().includes("rate limit")
        ? "Too many requests — please wait a few minutes before trying again."
        : result.error;
      setError(msg);
      return;
    }

    setOk(true);
  };

  if (ok) {
    return (
      <AuthShell
        pill="Check your inbox"
        heading={<>Let&apos;s get you back <em>on site</em>.</>}
        lede="If an account exists for this email, we've sent a reset link — valid for 10 minutes."
        foot={<>Remembered it? <Link href="/login">Back to sign in</Link></>}
      >
        <div className="success-state">
          <div className="mark">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2>Reset link <em>sent</em>.</h2>
          <p>
            Click the secure link in the email to set a new password. Didn&apos;t get it? Check your
            spam folder, or request another link below.
          </p>
          <div className="email">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            {email}
          </div>
          <div style={{ maxWidth: 280, margin: "0 auto" }}>
            <button type="button" className="btn btn-secondary" onClick={() => { setOk(false); }}>
              Send to a different email
            </button>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      pill="Password reset"
      heading={<>Let&apos;s get you back <em>on site</em>.</>}
      lede="Enter the email tied to your workspace. We'll send a secure reset link — valid for 10 minutes."
      foot={<>Remembered it? <Link href="/login">Back to sign in</Link></>}
    >
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label className="lab" htmlFor="fp-email">Work email</label>
          <input
            id="fp-email"
            className="input"
            name="email"
            type="email"
            placeholder="operator@company.co.uk"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending}
          />
        </div>

        {error ? <div className="alert err">{error}</div> : null}

        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Sending…" : "Send reset link →"}
        </button>
      </form>
    </AuthShell>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh" }} />}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
