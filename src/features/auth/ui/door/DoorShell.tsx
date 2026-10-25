import type { ReactNode } from "react";
import { getDoorContext } from "../../data/door";
import { BackIcon } from "./icons";
import { Knocker } from "./Knocker";

type SwitchLink = { lead: string; label: string; href: string };

/**
 * The front door: Harbor's deep-green Georgian door in its frame, with the hallway behind it. Every
 * sign-in screen hangs its plate (or, for the demo request, its postcard) in the upper half.
 *
 * Server component. The (auth) layout supplies the .harbor-door wrapper and the stylesheet.
 */
export async function DoorShell({
  children,
  switchLink,
  knocker = false,
  card = false,
}: {
  children: ReactNode;
  /** Top-right: "New to Harbor? Request a demo" and the like. Prospect links are hidden on agency hosts. */
  switchLink?: SwitchLink | null;
  /** The brass knocker above a plate (the sign-in screens). */
  knocker?: boolean;
  /** The postcard layout (the demo request). */
  card?: boolean;
}) {
  const { brandName, siteHref } = await getDoorContext();
  const showSwitch = switchLink && !(brandName && switchLink.href.startsWith("/signup"));
  // "/privacy" on the bare domain, "https://harborops.co.uk/privacy" from an agency's subdomain
  const site = (path: string) => (siteHref === "/" ? `/${path}` : `${siteHref}${path}`);

  return (
    <>
      <div className="hall" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/site/door/hallway.webp" alt="" width={1376} height={768} decoding="async" />
      </div>
      <div className="frame frame--l" aria-hidden="true" />
      <div className="frame frame--r" aria-hidden="true" />

      <div className="stage">
        <div className="door" id="door">
          <header className="door__top rise" style={{ "--d": 0 } as React.CSSProperties}>
            <a className="back" href={siteHref}>
              <BackIcon />
              Back to site
            </a>
            {showSwitch ? (
              <p className="switch">
                <span>{switchLink.lead} </span>
                <a href={switchLink.href}>{switchLink.label}</a>
              </p>
            ) : null}
          </header>

          <div className={card ? "door__upper door__upper--card" : "door__upper"}>
            <i className="panel panel--l" aria-hidden="true">
              <i />
            </i>
            <i className="panel panel--r" aria-hidden="true">
              <i />
            </i>
            {knocker ? <Knocker /> : null}
            {children}
          </div>

          <div className="door__lock" aria-hidden="true">
            <div className="letterbox">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/site/door/letterbox-open.webp" alt="" width={1008} height={378} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="letterbox__flap" src="/site/door/flap.webp" alt="" width={1008} height={378} />
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="knob" src="/site/door/knob.webp" alt="" width={396} height={396} />
          </div>
          <div className="door__lower" aria-hidden="true">
            <i className="panel panel--l" aria-hidden="true">
              <i />
            </i>
            <i className="panel panel--r" aria-hidden="true">
              <i />
            </i>
          </div>

          <footer className="door__foot">
            <p>© {new Date().getFullYear()} Harbor · London, UK</p>
            <nav aria-label="Contact and legal">
              <a href="mailto:info@harborops.co.uk">info@harborops.co.uk</a>
              <a href={site("privacy")}>Privacy</a>
              <a href={site("terms")}>Terms</a>
            </nav>
          </footer>
        </div>
      </div>
    </>
  );
}
