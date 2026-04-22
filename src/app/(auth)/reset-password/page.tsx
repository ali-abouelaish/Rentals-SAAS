"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell, EyeIcon } from "@/components/auth/AuthShell";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function scorePassword(v: string): { score: 0 | 1 | 2 | 3 | 4; hint: string; cls: "" | "err" | "warn" | "ok" } {
  let score = 0;
  if (v.length >= 8) score++;
  if (v.length >= 12) score++;
  if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
  if (/\d/.test(v) && /[^A-Za-z0-9]/.test(v)) score++;
  const msg = [
    "12+ characters · mix letters, numbers & symbols",
    "Too short — keep going",
    "Getting warmer",
    "Strong",
    "Excellent — locked in",
  ];
  const cls = ["", "err", "warn", "warn", "ok"] as const;
  return { score: score as 0 | 1 | 2 | 3 | 4, hint: msg[score], cls: cls[score] };
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setReady(Boolean(data.session));
    };
    check();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  const strength = scorePassword(password);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsPending(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setIsPending(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <AuthShell
        pill="Password updated"
        heading={<>Password <em>updated</em>.</>}
        lede="Your password has been reset."
      >
        <div className="success-state">
          <div className="mark">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2>Password <em>updated</em>.</h2>
          <p>
            You&apos;ll stay signed out on every other device — sign in below with your new credentials.
          </p>
          <div style={{ maxWidth: 280, margin: "0 auto" }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => router.replace("/login")}
            >
              Sign in →
            </button>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      pill="Set new password"
      heading={<>Choose a new <em>password</em>.</>}
      lede="Finish recovery by setting a fresh password. You'll be signed out of every other device."
      foot={<>Didn&apos;t get an email? <Link href="/forgot-password">Request another link</Link></>}
    >
      <form onSubmit={onSubmit}>
        {!ready && (
          <div className="alert warn">
            Open this page from your reset email link. If the link expired, request a new one.
          </div>
        )}

        <div className="field">
          <label className="lab" htmlFor="rs-pw">New password</label>
          <div className="input-wrap">
            <input
              id="rs-pw"
              className="input"
              type={showPw ? "text" : "password"}
              placeholder="12+ characters"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isPending || !ready}
            />
            <button
              type="button"
              className="eye"
              aria-label={showPw ? "Hide password" : "Show password"}
              onClick={() => setShowPw((v) => !v)}
              style={showPw ? { color: "var(--ink-900)" } : undefined}
            >
              <EyeIcon />
            </button>
          </div>
          <div className={`strength s${strength.score}`}>
            <span /><span /><span /><span />
          </div>
          <div className={`hint ${strength.cls}`}>{strength.hint}</div>
        </div>

        <div className="field">
          <label className="lab" htmlFor="rs-pw-confirm">Confirm new password</label>
          <input
            id="rs-pw-confirm"
            className="input"
            type="password"
            placeholder="Repeat password"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isPending || !ready}
          />
        </div>

        {error ? <div className="alert err">{error}</div> : null}

        <button type="submit" className="btn btn-primary" disabled={isPending || !ready}>
          {isPending ? "Updating…" : "Set new password →"}
        </button>
      </form>
    </AuthShell>
  );
}
