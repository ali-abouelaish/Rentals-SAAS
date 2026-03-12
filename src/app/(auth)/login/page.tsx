import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { signInWithEmail } from "@/features/auth/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Signing in..." : "Sign In"}
    </Button>
  );
}

const initialState: { error?: string } = {};

export default function LoginPage() {
  const [state, formAction] = useFormState(signInWithEmail, initialState);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-app px-6">
      <form
        action={formAction}
        className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-surface-card p-8 shadow-lg"
      >
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">Login</h1>
          <p className="text-sm text-foreground-secondary">Access your agency workspace</p>
        </div>
        <Input name="email" type="email" placeholder="Email" required />
        <Input name="password" type="password" placeholder="Password" required />
        {state?.error && (
          <p className="text-sm text-error">
            {state.error}
          </p>
        )}
        <div className="text-right">
          <Link href="/forgot-password" className="text-xs text-brand hover:underline">
            Forgot password?
          </Link>
        </div>
        <SubmitButton />
      </form>
    </div>
  );
}
