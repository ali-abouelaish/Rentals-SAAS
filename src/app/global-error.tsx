"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary. It replaces the root layout entirely, so it has to
 * render its own <html>/<body> — and it cannot rely on globals.css, the
 * next/font variables or any component that reads them, because none of that
 * is mounted at this point. Everything here is therefore inline and
 * self-contained on purpose. Only active in production builds.
 */
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
  }, [error]);

  const sans =
    "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  const mono = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 24px",
          background: "#fafaf8",
          color: "#111111",
          fontFamily: sans,
          fontSize: 15,
          lineHeight: 1.5,
          WebkitFontSmoothing: "antialiased",
        }}
      >
        <main style={{ maxWidth: 520, width: "100%" }}>
          <div
            style={{
              fontFamily: mono,
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#6b7280",
            }}
          >
            Error 500 · Application error
          </div>

          <h1
            style={{
              margin: "20px 0 16px",
              fontSize: 32,
              fontWeight: 500,
              letterSpacing: "-0.035em",
              lineHeight: 1.1,
            }}
          >
            Harbor Ops failed to start.
          </h1>

          <p style={{ margin: 0, color: "#4a4a4a", lineHeight: 1.55 }}>
            Something went wrong before the page could render. Reloading usually clears
            it. If it doesn&apos;t, quote the reference below to support and we can trace
            the exact failure.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 32 }}>
            <button
              type="button"
              onClick={reset}
              style={{
                padding: "13px 22px",
                fontFamily: "inherit",
                fontSize: 15,
                fontWeight: 500,
                lineHeight: 1,
                color: "#ffffff",
                background: "#111111",
                border: "1px solid transparent",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                padding: "13px 22px",
                fontSize: 15,
                fontWeight: 500,
                lineHeight: 1,
                color: "#111111",
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                textDecoration: "none",
              }}
            >
              Back to home
            </a>
          </div>

          {error.digest ? (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                marginTop: 24,
                padding: "6px 10px",
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                background: "#ffffff",
                fontFamily: mono,
                fontSize: 11,
                color: "#4a4a4a",
                wordBreak: "break-all",
              }}
            >
              <span style={{ color: "#9ca3af", letterSpacing: "0.08em" }}>REFERENCE</span>
              <span>{error.digest}</span>
            </div>
          ) : null}
        </main>
      </body>
    </html>
  );
}
