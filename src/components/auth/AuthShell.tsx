import Link from "next/link";
import type { ReactNode } from "react";
import "@/app/harbor-auth.css";

type PillTone = "default";

type AuthShellProps = {
  pill: string;
  pillTone?: PillTone;
  heading: ReactNode;
  lede: ReactNode;
  children: ReactNode;
  foot?: ReactNode;
};

export function AuthShell({ pill, heading, lede, children, foot }: AuthShellProps) {
  return (
    <div className="harbor-auth">
      <div className="bg-layer bg-mesh" aria-hidden />
      <div className="bg-layer bg-grain" aria-hidden />
      <div className="bg-layer bg-grid" aria-hidden />

      <div className="shell">
        <div className="form-side">
          <div className="form-nav">
            <Link href="/" className="brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/harbor-logo.png" alt="Harbor Ops" width={28} height={28} />
              <span className="brand-name">
                Harbor <em>Ops</em>
              </span>
            </Link>
            <Link href="/" className="back">← Back to site</Link>
          </div>

          <div className="form-wrap">
            <span className="pill"><span className="dot" />{pill}</span>
            <h1 className="head">{heading}</h1>
            <p className="lede">{lede}</p>
            {children}
            {foot ? <div className="form-foot">{foot}</div> : null}
          </div>

          <div className="legal">
            <div>© {new Date().getFullYear()} HARBOR OPS · LONDON</div>
            <div>
              <a href="#">Terms</a>
              {" · "}
              <a href="#">Privacy</a>
              {" · "}
              <a href="#">Status</a>
            </div>
          </div>
        </div>

        <aside className="aside">
          <div className="aside-top">
            <span>Harbor Ops · secure session</span>
            <span className="live">TLS 1.3 live</span>
          </div>

          <div className="aside-hero">
            <span className="pill"><span className="dot" />Private beta · London</span>
            <h2>
              Room-by-room property management, <em>built for London</em>.
            </h2>
            <p>
              See how operators running 10+ rooms replace the spreadsheet stack with a single workspace
              where leads, tenancies, maintenance and margin all speak the same language — the bedroom.
            </p>
          </div>

          <div className="aside-stats">
            <div className="stat">
              <div className="k">ROOMS LET</div>
              <div className="v">42<span className="sep">/</span>47</div>
              <div className="sub">+3 MoM</div>
            </div>
            <div className="stat">
              <div className="k">OCCUPANCY</div>
              <div className="v">89.4<span className="pct">%</span></div>
              <div className="sub">+4.2% MoM</div>
            </div>
            <div className="stat">
              <div className="k">MARGIN / RM</div>
              <div className="v">£218</div>
              <div className="sub">vs £230 target</div>
            </div>
          </div>

          <div className="aside-quote">
            <div className="mk">&ldquo;</div>
            <div className="q">
              We stopped listing every bedroom as a fake &ldquo;property.&rdquo; Our team finally{" "}
              <em>sees the same numbers</em> at the same time.
            </div>
            <div className="who">
              <div className="av">JO</div>
              <div>
                <div className="nm">James O.</div>
                <div className="rl">HMO operator · SE8, SE16 · 34 rooms</div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
