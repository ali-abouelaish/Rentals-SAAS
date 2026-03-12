import Link from "next/link";

const REASON_MESSAGES: Record<string, string> = {
  missing_token:
    "This link is missing verification details. Please use the exact link from your invitation email.",
  invalid_or_expired:
    "This invite link is invalid or has expired. Ask an admin to resend your invitation.",
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const params = await searchParams;
  const reason = params.reason ?? null;
  const message =
    (reason && REASON_MESSAGES[reason]) ||
    "Something went wrong. Please try again or contact support.";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-app px-6">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-surface-card p-8 shadow-lg">
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          Invitation problem
        </h1>
        <p className="text-sm text-foreground-secondary">{message}</p>
        <Link
          href="/login"
          className="inline-block w-full rounded-lg bg-brand px-4 py-2 text-center text-sm font-medium text-white hover:opacity-90"
        >
          Back to login
        </Link>
      </div>
    </div>
  );
}
