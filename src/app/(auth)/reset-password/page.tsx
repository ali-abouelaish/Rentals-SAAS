"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

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

    setSuccess("Password updated successfully. Redirecting to login...");
    setTimeout(() => {
      router.replace("/login");
    }, 1200);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-app px-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-surface-card p-8 shadow-lg"
      >
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">Reset password</h1>
          <p className="text-sm text-foreground-secondary">
            Enter your new password to finish account recovery.
          </p>
        </div>

        {!ready && (
          <p className="text-sm text-warning">
            Open this page from your reset email link. If the link expired, request a new one.
          </p>
        )}

        <Input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={isPending || !ready}
        />
        <Input
          type="password"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          disabled={isPending || !ready}
        />

        {error && <p className="text-sm text-error">{error}</p>}
        {success && <p className="text-sm text-success">{success}</p>}

        <Button type="submit" className="w-full" disabled={isPending || !ready}>
          {isPending ? "Updating..." : "Update password"}
        </Button>

        <p className="text-xs text-foreground-muted text-center">
          Didn&apos;t get an email?{" "}
          <Link href="/forgot-password" className="text-brand hover:underline">
            Request another link
          </Link>
        </p>
      </form>
    </div>
  );
}

