"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, LayoutDashboard, LifeBuoy, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";

/**
 * Dashboard error boundary. Catches anything thrown by a page under (app)
 * that has no closer boundary of its own (admin/ and room-enhancer/ keep
 * theirs). It renders inside AppShell, so the sidebar and header survive and
 * the user can navigate away instead of hitting a dead end.
 *
 * A crash in AppShell itself bubbles past this to the root error boundary.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  /**
   * A stale RSC payload after a deploy surfaces as a chunk load failure, and
   * `reset()` cannot fix it — only a full reload pulls the new build. Worth
   * distinguishing because the fix the user needs is different.
   */
  const isStaleBuild =
    error.name === "ChunkLoadError" ||
    /loading chunk|failed to fetch dynamically imported module/i.test(error.message ?? "");

  return (
    <div className="flex min-h-[60vh] items-center justify-center py-10">
      <Card className="w-full max-w-lg">
        <CardContent className="px-6 py-10 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-error-bg">
            <AlertTriangle className="h-7 w-7 text-error-fg" />
          </div>

          <h1 className="text-lg font-semibold text-foreground">
            {isStaleBuild ? "This page is out of date" : "Something went wrong"}
          </h1>

          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-foreground-secondary">
            {isStaleBuild
              ? "Harbor Ops was updated while this tab was open, so the page is running against an older version. Reload to pick up the latest one — your data is unaffected."
              : "We couldn't load this page. Nothing you entered has been lost, and no changes were saved. Try again, or head back to the dashboard."}
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {isStaleBuild ? (
              <Button variant="secondary" onClick={() => window.location.reload()}>
                <RotateCw className="h-4 w-4" />
                Reload page
              </Button>
            ) : (
              <Tooltip content="Re-runs just this page. Use it when the failure looks like a one-off — a dropped connection or a slow query.">
                <Button variant="secondary" onClick={reset}>
                  <RotateCw className="h-4 w-4" />
                  Try again
                </Button>
              </Tooltip>
            )}

            <Button variant="outline" onClick={() => router.push("/dashboard")}>
              <LayoutDashboard className="h-4 w-4" />
              Go to dashboard
            </Button>

            <Tooltip content="Opens the support assistant. Include the reference below so we can pull the exact server log for this failure.">
              <Button variant="ghost" onClick={() => router.push("/support")}>
                <LifeBuoy className="h-4 w-4" />
                Get help
              </Button>
            </Tooltip>
          </div>

          {error.digest ? (
            <Tooltip content="The server-side id for this exact failure. Quote it to support — it's the fastest way for us to find the log.">
              <p className="mt-6 inline-flex items-center gap-2 rounded-md border border-border bg-surface-inset px-2.5 py-1.5 font-mono text-xs text-foreground-muted">
                <span className="uppercase tracking-wider">Reference</span>
                <span className="break-all text-foreground-secondary">{error.digest}</span>
              </p>
            </Tooltip>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
