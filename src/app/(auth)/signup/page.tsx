import { signUpWithEmail } from "@/features/auth/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <form
        action={signUpWithEmail}
        className="w-full max-w-md space-y-4 rounded-2xl border border-muted bg-card p-8 shadow-soft"
      >
        <div>
          <h1 className="text-heading text-2xl font-semibold text-navy">Sign up</h1>
          <p className="text-sm text-gray-500">Create your tenant workspace</p>
        </div>
        <Input name="email" type="email" placeholder="Email" required />
        <Input name="password" type="password" placeholder="Password" required />
        <Button type="submit" className="w-full">
          Create account
        </Button>
      </form>
    </div>
  );
}
