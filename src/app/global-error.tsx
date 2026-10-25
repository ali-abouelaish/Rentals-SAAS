"use client";

import { useEffect, type CSSProperties } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Last-resort boundary. It replaces the root layout entirely, so it has to
 * render its own <html>/<body> — and it cannot rely on globals.css, the
 * next/font variables or any component that reads them, because none of that
 * is mounted at this point. Everything here is therefore inline and
 * self-contained on purpose: it is the website's error card (error.tsx,
 * styled by not-found.css) redrawn in inline styles, in the system font where
 * Urbanist isn't available. Only active in production builds.
 */

const CREAM = "#FDF9F2";
const DEEP = "#19363A";
const SAND = "#D4BE97";
const MUTED = "#59645F";

/** not-found.css's `.go` pill button. */
const pill: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 12,
  height: 50,
  padding: "0 24px 0 28px",
  border: 0,
  borderRadius: 999,
  fontFamily: "inherit",
  fontSize: 16,
  fontWeight: 600,
  lineHeight: 1,
  textDecoration: "none",
  cursor: "pointer",
};

export default function GlobalError({
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
    <html lang="en">
      <body style={{ margin: 0, background: CREAM }}>
        {/* With no layout there's no metadata either, so no viewport tag: phones would draw the
            page 980px wide. React lifts these two into <head>. */}
        <title>Something went wrong</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <main
          style={{
            boxSizing: "border-box",
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: "32px 16px",
            color: DEEP,
            fontFamily:
              "Urbanist, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
            textAlign: "center",
            WebkitFontSmoothing: "antialiased",
          }}
        >
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/site/brand/harbor-logo-teal.svg"
              alt="Harbor"
              width={260}
              height={64}
              style={{ display: "block", margin: "0 auto", width: "min(260px, 60vw)", height: "auto" }}
            />
            <h1
              style={{
                margin: "40px 0 10px",
                fontSize: "clamp(28px, 4vw, 40px)",
                fontWeight: 600,
                lineHeight: 1.15,
                letterSpacing: "-0.03em",
              }}
            >
              Something went wrong.
            </h1>
            <p
              style={{
                maxWidth: "32em",
                margin: "0 auto 32px",
                fontSize: 17,
                fontWeight: 500,
                lineHeight: 1.5,
                color: MUTED,
              }}
            >
              This one is on us: the page failed to load, not anything you did. Try again; if it keeps
              happening, quote the reference below when you get in touch.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12 }}>
              <button type="button" onClick={reset} style={{ ...pill, background: DEEP, color: CREAM }}>
                Try again
                <svg viewBox="0 0 16 16" width={15} height={15} aria-hidden="true" style={{ color: SAND }}>
                  <path d="M1 8h13M9 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </button>
              <a
                href="/"
                style={{
                  ...pill,
                  background: "transparent",
                  color: DEEP,
                  boxShadow: "inset 0 0 0 1px rgba(25, 54, 58, 0.3)",
                }}
              >
                Back to Harbor
              </a>
              {error.digest ? (
                <p
                  style={{
                    flexBasis: "100%",
                    margin: "28px auto 0",
                    fontSize: 13,
                    fontWeight: 500,
                    lineHeight: 1.5,
                    color: MUTED,
                  }}
                >
                  Reference{" "}
                  <code style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", color: DEEP }}>
                    {error.digest}
                  </code>
                </p>
              ) : null}
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
