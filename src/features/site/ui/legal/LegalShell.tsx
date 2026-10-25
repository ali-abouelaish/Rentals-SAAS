import type { ReactNode } from "react";
import { SiteFrame } from "../SiteFrame";

type Doc = "privacy" | "terms";

const DOCS: Array<{ id: Doc; href: string; label: string }> = [
  { id: "terms", href: "/terms", label: "Terms" },
  { id: "privacy", href: "/privacy", label: "Privacy policy" },
];

/**
 * A legal page in the new design: a Deep Harbour band for the title (with the document's own
 * effective date and facts), a contents box, then the policy text on cream. The text itself is the
 * page's own JSX, passed in untouched.
 */
export function LegalShell({
  current,
  eyebrow,
  title,
  lede,
  meta,
  sections,
  children,
}: {
  current: Doc;
  eyebrow: ReactNode;
  title: ReactNode;
  lede: ReactNode;
  /** The document's facts: effective date, controller, governing law… */
  meta: ReactNode;
  sections: ReadonlyArray<{ id: string; title: string }>;
  children: ReactNode;
}) {
  return (
    <SiteFrame variant="legal">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="legal__band">
        <div className="legal__top">
          <a className="legal__logo" href="/" aria-label="Harbor home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/site/brand/harbor-logo-sage.svg" alt="Harbor" width={113} height={28} />
          </a>
          <a className="back" href="/">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M15 8H2M7 3 2 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
            Back to site
          </a>
        </div>
        <div className="legal__wrap legal__head">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          {lede}
          <nav className="legal__docs" aria-label="Legal documents">
            {DOCS.map((doc) => (
              <a key={doc.id} href={doc.href} aria-current={doc.id === current ? "page" : undefined}>
                {doc.label}
              </a>
            ))}
          </nav>
          {meta}
        </div>
      </header>

      <main className="legal__wrap legal__body" id="main" tabIndex={-1}>
        <nav className="toc" aria-label="On this page">
          <p>On this page</p>
          <ol>
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.title}</a>
              </li>
            ))}
          </ol>
        </nav>
        {children}
      </main>

      <footer className="legal__foot">
        <div className="legal__wrap">
          <nav aria-label="Legal">
            <a href="/privacy" aria-current={current === "privacy" ? "page" : undefined}>
              Privacy
            </a>
            <a href="/terms" aria-current={current === "terms" ? "page" : undefined}>
              Terms
            </a>
            {/* The cookie section of the privacy policy: there is no separate cookie policy */}
            <a href="/privacy#s9">Cookies</a>
          </nav>
          <p>© {new Date().getFullYear()} Harbor Ops Ltd · Company No. 17215410 · London, UK</p>
        </div>
      </footer>
    </SiteFrame>
  );
}
