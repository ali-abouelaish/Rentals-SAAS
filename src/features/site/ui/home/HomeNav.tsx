import { Pill } from "../icons";

export type AccountLink = { href: string; label: string };

const SECTIONS = [
  { href: "#product", label: "Product" },
  { href: "#story", label: "Our story" },
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
];

/**
 * The fixed nav (it flips colours over the dark sections, hides on the way down) and the full-screen
 * menu it opens on phones. `account` is "Sign in", or "Open workspace" for someone already signed in.
 * Behaviour lives in motion/homeMotion.ts.
 */
export function HomeNav({ account }: { account: AccountLink }) {
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>

      <header className="nav" id="nav">
        <a className="nav__logo" href="#top" aria-label="Harbor, home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="on-light" src="/site/brand/harbor-logo-teal.svg" alt="Harbor" width={113} height={28} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="on-dark" src="/site/brand/harbor-logo-sage.svg" alt="" width={113} height={28} aria-hidden="true" />
        </a>
        <ul className="nav__links">
          {SECTIONS.map((s) => (
            <li key={s.href}>
              <a href={s.href}>{s.label}</a>
            </li>
          ))}
        </ul>
        <div className="nav__right">
          <a className="nav__signin" href={account.href}>
            {account.label}
          </a>
          <Pill href="/signup">Request a demo</Pill>
          <button className="nav__burger" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="menu">
            <span />
            <span />
          </button>
        </div>
      </header>

      <nav className="menu" id="menu" aria-label="Menu">
        <ul>
          {SECTIONS.map((s) => (
            <li key={s.href}>
              <a href={s.href}>{s.label}</a>
            </li>
          ))}
        </ul>
        <div className="menu__foot">
          <a className="menu__signin" href={account.href}>
            {account.label}
          </a>
          <Pill href="/signup">Request a demo</Pill>
        </div>
      </nav>
    </>
  );
}
