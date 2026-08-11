import Link from "next/link";
import { FileQuestion, LayoutDashboard, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BackButton } from "@/components/shared/BackButton";

export const metadata = {
  title: "Not found",
  robots: { index: false, follow: false },
};

/**
 * Dashboard 404. Rendered when a page under (app) calls `notFound()` — a
 * record that was deleted, or one that belongs to another tenant and is
 * therefore invisible under RLS.
 *
 * Note: a genuinely unmatched URL (e.g. /propertiez) never resolves to this
 * group, so Next falls through to the root not-found instead. That is a
 * routing constraint, not an oversight.
 */
export default function AppNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center py-10">
      <Card className="w-full max-w-lg">
        <CardContent className="px-6 py-10 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-surface-inset">
            <FileQuestion className="h-7 w-7 text-foreground-muted" />
          </div>

          <h1 className="text-lg font-semibold text-foreground">We couldn&apos;t find that</h1>

          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-foreground-secondary">
            This record doesn&apos;t exist, or it isn&apos;t part of your workspace. It may
            have been deleted since the link was created, or the address may have a typo.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <BackButton fallbackHref="/dashboard" />

            <Button asChild variant="secondary" size="sm">
              <Link href="/dashboard">
                <LayoutDashboard className="h-4 w-4" />
                Go to dashboard
              </Link>
            </Button>

            <Button asChild variant="ghost" size="sm">
              <Link href="/support">
                <LifeBuoy className="h-4 w-4" />
                Get help
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
