"use client";

import "@/features/site/styles/not-found.css";
import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Arrow } from "@/features/site/ui/icons";
import { NotFoundPanel } from "@/features/site/ui/NotFoundPanel";

/**
 * Root error boundary. Catches anything thrown below the root layout that
 * no closer boundary handled — including a crash inside the (app) group's
 * own layout (AppShell), which `(app)/error.tsx` cannot catch.
 *
 * If the root layout itself throws, `global-error.tsx` takes over instead.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <NotFoundPanel
      title="Something went wrong."
      message="This one is on us: the page failed to load, not anything you did. Try again; if it keeps happening, quote the reference below when you get in touch."
    >
      <button type="button" className="go" onClick={reset}>
        Try again
        <Arrow />
      </button>
      <a className="go go--quiet" href="/">
        Back to Harbor
      </a>
      {error.digest ? (
        <p className="ref">
          Reference <code>{error.digest}</code>
        </p>
      ) : null}
    </NotFoundPanel>
  );
}
