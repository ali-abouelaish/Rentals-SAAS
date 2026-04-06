"use client";

import Link from "next/link";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const callbackError = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(callbackError);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);

    const supabase = createSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`;

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });

    setPending(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setOk(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-app px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-surface-card p-8 shadow-lg"
      >
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">Forgot password</h1>
          <p className="text-sm text-foreground-secondary">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>

        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium text-foreground">
            Email
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={pending || ok}
          />
        </div>

        {error && <p className="text-sm text-error">{error}</p>}
        {ok && (
          <p className="text-sm text-success">
            If this email exists, a reset link has been sent.
          </p>
        )}

        <Button type="submit" className="w-full" disabled={pending || ok}>
          {pending ? "Sending..." : "Send reset link"}
        </Button>

        <p className="text-xs text-foreground-muted text-center">
          Remembered it?{" "}
          <Link href="/login" className="text-brand hover:underline">
            Back to login
          </Link>
        </p>
      </form>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-surface-app"><p className="text-foreground-muted">Loading...</p></div>}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
