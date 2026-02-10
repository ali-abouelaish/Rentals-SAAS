import { signInWithEmail } from "@/features/auth/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-app px-6">
      <form
        action={async (formData) => {
          "use server";
          await signInWithEmail(formData);
        }}
        className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-surface-card p-8 shadow-lg"
      >
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">Login</h1>
          <p className="text-sm text-foreground-secondary">Access your agency workspace</p>
        </div>
        <Input name="email" type="email" placeholder="Email" required />
        <Input name="password" type="password" placeholder="Password" required />
        <Button type="submit" className="w-full">
          Sign In
        </Button>
      </form>
    </div>
  );
}
