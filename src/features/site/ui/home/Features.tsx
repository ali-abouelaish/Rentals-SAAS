import { Pill, cssVars } from "../icons";

function Tick() {
  return (
    <svg viewBox="0 0 20 20">
      <path d="M6 10.4l2.6 2.6L14 7.6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const RULES = ["Rent reminders", "Arrears", "Tenancy expiry", "Right-to-rent expiry", "Certificate renewals", "Stalled works orders"];
const TRAIL = ["Application", "Viewing", "Offer"];

/**
 * The day-to-day, on rules you set: an Apple-style bento, seven tiles. Every line comes from the
 * Harbor company profile; each little picture plays once as its tile arrives. `--i` staggers
 * the tiles in reading order.
 */
export function Features() {
  return (
    <section className="bento-sec" id="features" aria-labelledby="feat-title">
      <div className="wrap">
        <div className="bento__head">
          <p className="label">Features</p>
          <h2 className="bento__title" id="feat-title" data-fill>
            <span className="t1">The day-to-day,</span> <span className="t2">on rules you set.</span>
          </h2>
          <Pill href="/signup" className="bento__cta">
            See it in a demo
          </Pill>
        </div>
        <ul className="bento" id="featGrid">
          <li className="bx bx--chase" style={cssVars({ "--i": 1 })}>
            <h3 className="bx__t">
              <span className="t1">Automated chasing.</span> <span className="t2">Every message can be previewed before it goes out.</span>
            </h3>
            <ul className="rules">
              {RULES.map((rule, r) => (
                <li key={rule} style={cssVars({ "--r": r })}>
                  {rule}
                  <i aria-hidden="true" />
                </li>
              ))}
            </ul>
          </li>
          <li className="bx bx--portal" style={cssVars({ "--i": 0 })}>
            <h3 className="bx__t">
              <span className="t1">Your branded tenant portal.</span>{" "}
              <span className="t2">Tenants see their rent, deposit and repairs, right from their phone.</span>
            </h3>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/site/ai/card-portal.webp?v=20261007b"
              width={1122}
              height={1402}
              alt="A tenant in her room, checking the portal on her phone"
              loading="lazy"
              decoding="async"
            />
          </li>
          <li className="bx bx--apply" style={cssVars({ "--i": 6 })}>
            <h3 className="bx__t">
              <span className="t1">Applications, viewings and offers.</span> <span className="t2">All online, through your branded site.</span>
            </h3>
            <ol className="trail" aria-hidden="true">
              {TRAIL.map((stop, s) => (
                <li key={stop} style={cssVars({ "--s": s })}>
                  <i>
                    <Tick />
                  </i>
                  {stop}
                </li>
              ))}
            </ol>
          </li>
          <li className="bx bx--sign" style={cssVars({ "--i": 2 })}>
            <h3 className="bx__t">
              <span className="t1">E-signed works orders.</span> <span className="t2">Contractors sign off the job, scope and cost before they start.</span>
            </h3>
            <div className="sign" aria-hidden="true">
              <svg className="sign__ink" viewBox="0 0 200 54">
                <path
                  pathLength={1}
                  d="M12 40C17 31 21 12 29 9c6-2 5 12-2 24-4 7-9 11-7 6 3-7 15-12 21-11 5 1 0 9 5 9 5 0 7-8 12-8 4 0 2 8 7 8 5 0 8-11 14-12 4 0 4 7 1 11-2 3 2 3 6-1 4-5 8-7 12-6 4 1 2 7 7 7 7 0 12-8 19-10M22 49c36-6 82-8 124-6 16 1 30-1 42-5"
                />
              </svg>
              <p className="sign__foot">
                <span className="sign__line" />
                <span className="sign__ok">
                  <Tick />
                  <span className="sign__word">Signed</span>
                </span>
              </p>
            </div>
          </li>
          <li className="bx bx--mail" style={cssVars({ "--i": 3 })}>
            <h3 className="bx__t">
              <span className="t1">Email from your own address.</span> <span className="t2">Microsoft 365, Gmail or SMTP, with automatic fallback.</span>
            </h3>
            <p className="at" aria-hidden="true">
              @
            </p>
          </li>
          <li className="bx bx--forms" style={cssVars({ "--i": 4 })}>
            <h3 className="bx__t">
              <span className="t1">Custom forms.</span> <span className="t2">Capture exactly the information your agency needs.</span>
            </h3>
            <div className="fields" aria-hidden="true">
              <i style={cssVars({ "--w": "44%", "--f": 0 })} />
              <i style={cssVars({ "--w": "62%", "--f": 1 })} />
              <i className="is-focus" style={cssVars({ "--w": "30%", "--f": 2 })} />
            </div>
          </li>
          <li className="bx bx--agents" style={cssVars({ "--i": 5 })}>
            <h3 className="bx__t">
              <span className="t1">Listings for outside agents.</span> <span className="t2">A link to your available properties, without system access.</span>
            </h3>
            <div className="share" aria-hidden="true">
              <span className="share__url">
                <svg viewBox="0 0 20 20">
                  <path
                    d="M8.5 11.5l3-3M7.2 13.8l-1 1a2.6 2.6 0 0 1-3.7-3.7l2.6-2.6a2.6 2.6 0 0 1 3.7 0M12.8 6.2l1-1a2.6 2.6 0 0 1 3.7 3.7l-2.6 2.6a2.6 2.6 0 0 1-3.7 0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
                <b />
              </span>
              <span className="share__lock">
                <svg viewBox="0 0 20 20">
                  <rect x="4.5" y="9" width="11" height="8" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
                  <path d="M7 9V6.8a3 3 0 0 1 6 0V9" fill="none" stroke="currentColor" strokeWidth="1.7" />
                </svg>
              </span>
            </div>
          </li>
        </ul>
      </div>
    </section>
  );
}

const STANDARD = ["Leads, rooms, rent and compliance", "The 24/7 help desk", "Data export from day one"];
// The paid integrations (PAID_FEATURES in src/lib/entitlements/features.ts)
const ENTERPRISE = ["Everything in Standard", "E-signing for tenancy agreements", "mydeposits, TDS and DPS integrations"];

/** Two plans, one price per workspace. Enterprise is quoted, not priced. */
export function Pricing() {
  return (
    <section className="pricing" id="pricing" aria-labelledby="price-title">
      <div className="wrap pricing__inner">
        <div className="pricing__head">
          <p className="label pricing__label">Pricing</p>
          <h2 className="pricing__title" id="price-title" data-fill>
            <span className="t1">Two plans.</span> <span className="t2">One price per workspace.</span>
          </h2>
        </div>
        <ul className="plans">
          <li className="plan">
            <h3 className="plan__name">Standard</h3>
            <p className="plan__price">
              <span className="plan__num">£100</span>
              <span className="plan__per">
                a month
                <br />
                per workspace
              </span>
            </p>
            <p className="plan__desc">Onboarding includes a 1:1 migration session and 90 days of import support.</p>
            <ul className="plan__list">
              {STANDARD.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <Pill href="/signup">Request a demo</Pill>
          </li>
          <li className="plan plan--deep">
            <h3 className="plan__name">Enterprise</h3>
            <p className="plan__price">
              <span className="plan__num plan__num--quote">Request a quote</span>
            </p>
            <p className="plan__desc">Ask us what Enterprise includes for your portfolio.</p>
            <ul className="plan__list">
              {ENTERPRISE.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <Pill href="/signup?plan=enterprise" tone="light">
              Request a quote
            </Pill>
          </li>
        </ul>
      </div>
    </section>
  );
}
