import { LinkIcon } from "lucide-react";

interface LinkInactiveProps {
  reason: "revoked" | "expired";
}

export function LinkInactive({ reason }: LinkInactiveProps) {
  const headline = reason === "revoked" ? "This link has been revoked" : "This link has expired";
  const body =
    reason === "revoked"
      ? "The person who shared this page has disabled access. Please reach out to them for a new link."
      : "This share link is past its expiry date. Please ask the sender for a fresh link.";

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-page px-4">
      <div className="max-w-md text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 mb-4">
          <LinkIcon className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">{headline}</h1>
        <p className="mt-2 text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}
