import { Pill, cssVars } from "../icons";
import type { AccountLink } from "./HomeNav";

/** The lit windows of the evening street: position and size as fractions of the picture, and when each one comes on. */
const LIGHTS: Array<[x: number, y: number, w: number, h: number, delay: string]> = [
  [0.12001, 0.21916, 0.09825, 0.16265, "2.70s"],
  [0.24629, 0.21916, 0.09858, 0.16265, "3.86s"],
  [0.37554, 0.21916, 0.09858, 0.16265, "1.11s"],
  [0.5305, 0.21916, 0.09858, 0.16265, "3.50s"],
  [0.65776, 0.21916, 0.09825, 0.16265, "2.06s"],
  [0.78437, 0.21916, 0.09825, 0.16265, "3.14s"],
  [0.11935, 0.38624, 0.09957, 0.23833, "2.52s"],
  [0.24629, 0.38624, 0.0999, 0.23833, "3.74s"],
  [0.37488, 0.38624, 0.0999, 0.22211, "0.71s"],
  [0.52984, 0.38624, 0.0999, 0.22211, "3.38s"],
  [0.65711, 0.38624, 0.0999, 0.23833, "1.78s"],
  [0.78338, 0.38624, 0.0999, 0.23833, "3.02s"],
  [0.11771, 0.6226, 0.0999, 0.20197, "2.87s"],
  [0.24629, 0.6226, 0.0999, 0.20197, "0.25s"],
  [0.65776, 0.6226, 0.0999, 0.20197, "3.62s"],
  [0.78338, 0.6226, 0.0999, 0.20197, "1.47s"],
  [0.36004, 0.59607, 0.13122, 0.13808, "2.30s"],
  [0.51434, 0.59607, 0.13122, 0.13808, "3.26s"],
];

/**
 * The closing call to action on Harbor Street in the evening (its rooms light up one by one), and
 * the footer, which slides up over it.
 */
export function Closing({ account }: { account: AccountLink }) {
  const year = new Date().getFullYear();
  return (
    <div className="curtain">
      <section className="outro" id="demo" aria-labelledby="outro-title">
        <div className="outro__stage" id="outroStage">
          <div className="outro__copy">
            <h2 className="outro__title" id="outro-title" data-fill>
              <span className="t1">Bring your portfolio.</span> <span className="t2">Leave your spreadsheets.</span>
            </h2>
            <Pill href="/signup">Request a demo</Pill>
          </div>
          <div className="outro__street" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="outro__house"
              src="/site/outro/evening-house-2200.webp"
              srcSet="/site/outro/evening-house-1400.webp 1400w, /site/outro/evening-house-2200.webp 2200w"
              sizes="(max-aspect-ratio: 9/10) 168vw, 66vw"
              alt=""
              width={2200}
              height={1476}
              loading="lazy"
              decoding="async"
            />
            <div className="outro__lights">
              {LIGHTS.map(([x, y, w, h, d], i) => (
                <i key={i} style={cssVars({ "--x": x, "--y": y, "--w": w, "--h": h, "--d": d })} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="footer dark" id="signin">
        <div className="wrap">
          <div className="grid footer__top">
            <div>
              <div className="footer__cta">
                <p className="footer__lead">Talk to us about your portfolio.</p>
                <Pill href="/signup" tone="light">
                  Request a demo
                </Pill>
                <p className="footer__note">A person reads every request and replies within 48 hours.</p>
              </div>
              <dl className="contact">
                <div>
                  <dt>Head office</dt>
                  <dd>London, UK</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>
                    <a href="mailto:info@harborops.co.uk">info@harborops.co.uk</a>
                  </dd>
                </div>
              </dl>
            </div>
            <div className="footer__links">
              <ul>
                <li>
                  <a href="#product">Product</a>
                </li>
                <li>
                  <a href="#features">Features</a>
                </li>
                <li>
                  <a href="#pricing">Pricing</a>
                </li>
                <li>
                  <a href="#story">Our story</a>
                </li>
              </ul>
              <ul>
                <li>
                  <a href={account.href}>{account.label}</a>
                </li>
                <li>
                  <a href="/signup">Request a demo</a>
                </li>
              </ul>
            </div>
          </div>
          <div className="footer__mark">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/site/brand/harbor-wordmark-sage.svg" alt="Harbor" loading="lazy" />
          </div>
          <div className="footer__legal">
            <a href="/privacy">Privacy policy</a>
            <a href="/terms">Terms</a>
            {/* The cookie section of the privacy policy: there is no separate cookie policy */}
            <a href="/privacy#s9">Cookies</a>
            <span>© {year} Harbor · London, UK</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
