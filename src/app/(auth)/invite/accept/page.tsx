"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AcceptInvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    const fromUrl = searchParams.get("error");
    if (fromUrl) setError(decodeURIComponent(fromUrl));
  }, [searchParams]);

  useEffect(() => {
    let mounted = true;
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setReady(Boolean(data.session));
      setLoadingSession(false);
    };
    checkSession();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!ready) {
      setError("Invite session not found. Please open your latest invite link.");
      return;
    }
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

    setSuccess("Account activated. Redirecting to your dashboard...");
    setTimeout(() => {
      router.replace("/dashboard");
    }, 1000);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-app px-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-surface-card p-8 shadow-lg"
      >
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">Accept Invitation</h1>
          <p className="text-sm text-foreground-secondary">
            Set your password to activate your account.
          </p>
        </div>

        {loadingSession && (
          <p className="text-sm text-foreground-muted">Validating invitation...</p>
        )}

        {!loadingSession && !ready && (
          <div className="space-y-2">
            <p className="text-sm text-warning">
              This invite link is invalid or expired. Ask an admin to resend your invitation.
            </p>
            <p className="text-xs text-foreground-muted">
              Already activated?{" "}
              <Link href="/login" className="text-brand hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        )}

        <Input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={!ready || isPending}
        />
        <Input
          type="password"
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          disabled={!ready || isPending}
        />

        {error && <p className="text-sm text-error">{error}</p>}
        {success && <p className="text-sm text-success">{success}</p>}

        <Button type="submit" className="w-full" disabled={!ready || isPending}>
          {isPending ? "Activating..." : "Activate account"}
        </Button>
      </form>
    </div>
  );
}

