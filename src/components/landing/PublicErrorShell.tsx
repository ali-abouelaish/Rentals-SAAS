import type { ReactNode } from "react";

/**
 * Chrome for the public error surfaces (404 / 500).
 *
 * Deliberately a stripped-down version of the landing nav: the section
 * anchors are dropped because they point at sections that don't exist on
 * an error page, leaving only routes that are guaranteed to resolve.
 *
 * No "use client" directive — it holds no state, so it renders on the
 * server for `not-found.tsx` and compiles into the client bundle when
 * imported by the `error.tsx` boundaries.
 */
export function PublicErrorShell({ children }: { children: ReactNode }) {
  return (
    <div className="harbor-landing">
      <div className="bg-layer bg-mesh" aria-hidden />
      <div className="bg-layer bg-grain" aria-hidden />
      <div className="bg-layer bg-grid" aria-hidden />

      <div className="page">
        <nav className="nav">
          <div className="wrap nav-inner">
            <a href="/" className="brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/harbor-logo.png" alt="Harbor Ops" width={28} height={28} />
              <span className="brand-name">
                Harbor <em>Ops</em>
              </span>
            </a>
            <div className="nav-cta">
              <a href="/login" className="btn btn-ghost btn-sm">
                Sign in
              </a>
              <a href="/" className="btn btn-primary btn-sm">
                Back to home
              </a>
            </div>
          </div>
        </nav>

        <main className="err">
          <div className="wrap err-inner">{children}</div>
        </main>
      </div>
    </div>
  );
}
