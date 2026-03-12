"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestPasswordResetForSignedOut } from "@/features/auth/actions/auth";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Sending..." : "Send reset link"}
    </Button>
  );
}

const initialState: { ok?: boolean; error?: string; message?: string } = {};

export default function ForgotPasswordPage() {
  const [state, action] = useFormState(requestPasswordResetForSignedOut, initialState);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-app px-6">
      <form
        action={action}
        className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-surface-card p-8 shadow-lg"
      >
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">Forgot password</h1>
          <p className="text-sm text-foreground-secondary">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>

        <Input name="email" type="email" placeholder="Email" required />

        {state?.error && (
          <p className="text-sm text-error">{state.error}</p>
        )}
        {state?.ok && (
          <p className="text-sm text-success">{state.message}</p>
        )}

        <SubmitButton />

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

