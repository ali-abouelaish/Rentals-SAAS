"use client";

import "./harbor-landing.css";
import "./harbor-error.css";
import { useEffect } from "react";
import { PublicErrorShell } from "@/components/landing/PublicErrorShell";

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
  }, [error]);

  return (
    <PublicErrorShell>
      <span className="err-glyph" aria-hidden>
        500
      </span>

      <span className="err-status">Error 500 · Something went wrong</span>

      <h1>
        Harbor Ops hit an <em>unexpected</em> error.
      </h1>

      <p className="lede">
        This one is on us — the page failed to load rather than anything you did. Try
        again; if it keeps happening, quote the reference below when you get in touch and
        we can trace the exact failure.
      </p>

      <div className="err-ctas">
        <button type="button" className="btn btn-primary btn-lg" onClick={reset}>
          Try again
        </button>
        <a href="/" className="btn btn-secondary btn-lg">
          Back to home
        </a>
      </div>

      {error.digest ? (
        <div className="err-ref">
          <span className="k">Reference</span>
          <span>{error.digest}</span>
        </div>
      ) : null}
    </PublicErrorShell>
  );
}
