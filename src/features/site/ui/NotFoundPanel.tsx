import type { ReactNode } from "react";
import { SiteFrame } from "./SiteFrame";

/**
 * The website's "page not found" card (the designer's 404.html): the Harbor logo, a line or two,
 * and a way back. Also used for the root error page and an unknown workspace address.
 * The page imports not-found.css.
 */
export function NotFoundPanel({ title, message, children }: { title: string; message: string; children: ReactNode }) {
  return (
    <SiteFrame variant="404">
      <main>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/site/brand/harbor-logo-teal.svg" alt="Harbor" width={260} height={64} />
        <h1>{title}</h1>
        <p>{message}</p>
        <div className="actions">{children}</div>
      </main>
    </SiteFrame>
  );
}
