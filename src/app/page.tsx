import "./harbor-landing.css";
import { WorkspaceToggle } from "@/components/landing/WorkspaceToggle";
import { AccessRequestForm } from "@/components/landing/AccessRequestForm";

export const metadata = {
  title: "Harbor Ops — Room-by-room property management for London operators",
  description:
    "Harbor Ops replaces the spreadsheets, generic CRMs, SpareRoom tabs and accounting exports that small-to-mid London operators stitch together. Track occupancy, margin and maintenance at the bedroom level.",
  openGraph: {
    title: "Harbor Ops — Room-by-room property management for London operators",
    description:
      "The operating system for room-by-room property management in London. Built by operators, for operators.",
  },
};

export default function LandingPage() {
  return (
    <div className="harbor-landing">
      <div className="bg-layer bg-mesh" aria-hidden />
      <div className="bg-layer bg-grain" aria-hidden />
      <div className="bg-layer bg-grid" aria-hidden />

      <div className="page">
        {/* ============ NAV ============ */}
        <nav className="nav">
          <div className="wrap nav-inner">
            <a href="#" className="brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/harbor-logo.png" alt="Harbor Ops" width={28} height={28} />
              <span className="brand-name">
                Harbor <em>Ops</em>
              </span>
            </a>
            <div className="nav-links">
              <a href="#problem">Why Harbor</a>
              <a href="#modules">Modules</a>
              <a href="#acquisitions">Acquisitions</a>
              <a href="#profitability">Profitability</a>
              <a href="#surfaces">Surfaces</a>
              <a href="#pricing">Demo</a>
            </div>
            <div className="nav-cta">
              <a href="/auth/login" className="btn btn-ghost btn-sm">
                Sign in
              </a>
              <a href="#pricing" className="btn btn-primary btn-sm">
                Request demo
              </a>
            </div>
          </div>
        </nav>

        {/* ============ HERO ============ */}
        <header className="hero">
          <div className="wrap hero-inner">
            <span className="pill">
              <span className="dot" />
              Built for London HMO operators
            </span>
            <h1>
              The operating system for <em>room-by-room</em> property management.
            </h1>
            <p className="lede">
              Harbor Ops replaces the spreadsheets, generic CRMs, SpareRoom tabs and accounting exports
              that small-to-mid London operators stitch together. Track occupancy, margin and maintenance
              at the bedroom level — the unit London actually rents.
            </p>

            <div className="hero-ctas">
              <a href="#pricing" className="btn btn-primary btn-lg">
                Request demo
              </a>
              <a href="#modules" className="btn btn-secondary btn-lg">
                See the modules →
              </a>
            </div>

            <div className="hero-meta">
              <div className="cell">
                <div className="k">Portfolio size</div>
                <div className="v">
                  10–200 units <em>with rooms</em>
                </div>
              </div>
              <div className="cell">
                <div className="k">Built for</div>
                <div className="v">Letting agencies · HMO operators · R2R</div>
              </div>
              <div className="cell">
                <div className="k">Live data</div>
                <div className="v">SpareRoom feed · margin per room</div>
              </div>
              <div className="cell">
                <div className="k">Surfaces</div>
                <div className="v">
                  Operator back office <em>+</em> tenant self-serve
                </div>
              </div>
            </div>

            {/* dashboard mockup */}
            <div className="dash">
              <div className="dash-top">
                <div className="dots">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="url">app.harborops.co/portfolio/hmo-zone2</div>
              </div>
              <div className="dash-body">
                <aside className="dash-side">
                  <div className="ws">
                    <div className="badge-ws">HO</div>
                    <div>
                      <div className="ws-name">Harbor Ops</div>
                      <div className="ws-sub">management · 47 rooms</div>
                    </div>
                  </div>
                  <div className="label">Operate</div>
                  <div className="item active">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7" />
                      <rect x="14" y="3" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" />
                    </svg>
                    Portfolio <span className="count">12</span>
                  </div>
                  <div className="item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 21V8l9-5 9 5v13" />
                      <path d="M9 21V12h6v9" />
                    </svg>
                    Properties <span className="count">12</span>
                  </div>
                  <div className="item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="8" width="18" height="12" rx="2" />
                      <path d="M7 8V5h10v3" />
                    </svg>
                    Rooms <span className="count">47</span>
                  </div>
                  <div className="item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="9" cy="7" r="4" />
                      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                    </svg>
                    Tenants <span className="count">42</span>
                  </div>
                  <div className="item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="5" width="20" height="14" rx="2" />
                      <line x1="2" y1="10" x2="22" y2="10" />
                    </svg>
                    Bookings <span className="count">8</span>
                  </div>
                  <div className="label">Grow</div>
                  <div className="item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                      <polyline points="17 6 23 6 23 12" />
                    </svg>
                    Acquisitions <span className="count">3</span>
                  </div>
                  <div className="item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="20" x2="18" y2="10" />
                      <line x1="12" y1="20" x2="12" y2="4" />
                      <line x1="6" y1="20" x2="6" y2="14" />
                    </svg>
                    Profitability
                  </div>
                </aside>

                <div className="dash-main">
                  <div className="dash-h">
                    <div>
                      <div className="crumb">PORTFOLIO · APRIL 2026</div>
                      <h3>Rooms overview</h3>
                    </div>
                    <div className="right">
                      <span className="badge badge-success badge-dot">Live</span>
                      <button className="btn btn-secondary btn-sm" type="button">Export</button>
                    </div>
                  </div>

                  <div className="metrics">
                    <div className="mcard">
                      <div className="lab">Rooms let</div>
                      <div className="val">
                        42<span style={{ color: "var(--ink-400)", fontSize: 16 }}> / 47</span>
                      </div>
                      <div className="tr tr-up">↑ +3 MoM</div>
                    </div>
                    <div className="mcard">
                      <div className="lab">Occupancy</div>
                      <div className="val">89.4%</div>
                      <div className="tr tr-up">↑ +4.2%</div>
                    </div>
                    <div className="mcard">
                      <div className="lab">Monthly rent roll</div>
                      <div className="val">£41,820</div>
                      <div className="tr tr-up">↑ +£1,640</div>
                    </div>
                    <div className="mcard">
                      <div className="lab">Margin / room</div>
                      <div className="val">£218</div>
                      <div className="tr tr-dn">↓ £12 vs target</div>
                    </div>
                  </div>

                  <div className="rooms">
                    <div className="r-head">
                      <div>UNIT</div>
                      <div>ADDRESS · ROOM</div>
                      <div>RENT</div>
                      <div className="hide-mobile">MARGIN</div>
                      <div className="hide-mobile">RENEWAL</div>
                      <div>STATUS</div>
                    </div>
                    <div className="r-row">
                      <div className="code">W2-04 · R2</div>
                      <div>
                        <div className="addr">Sussex Gardens</div>
                        <div className="sub">W2 · double en-suite</div>
                      </div>
                      <div className="num">£1,180</div>
                      <div className="num hide-mobile">+£284</div>
                      <div className="num hide-mobile">14 Jun</div>
                      <div>
                        <span className="badge badge-success badge-dot">Let</span>
                      </div>
                    </div>
                    <div className="r-row">
                      <div className="code">SW12-03 · R3</div>
                      <div>
                        <div className="addr">Balham High Rd</div>
                        <div className="sub">SW12 · single</div>
                      </div>
                      <div className="num">£820</div>
                      <div className="num hide-mobile">+£142</div>
                      <div className="num hide-mobile">02 Aug</div>
                      <div>
                        <span className="badge badge-success badge-dot">Let</span>
                      </div>
                    </div>
                    <div className="r-row">
                      <div className="code">SE16-01 · R1</div>
                      <div>
                        <div className="addr">Rotherhithe St</div>
                        <div className="sub">SE16 · double</div>
                      </div>
                      <div className="num">£1,050</div>
                      <div className="num hide-mobile">—</div>
                      <div className="num hide-mobile">—</div>
                      <div>
                        <span className="badge badge-danger badge-dot">Vacant · 11d</span>
                      </div>
                    </div>
                    <div className="r-row">
                      <div className="code">E2-02 · R4</div>
                      <div>
                        <div className="addr">Hackney Rd</div>
                        <div className="sub">E2 · double</div>
                      </div>
                      <div className="num">£960</div>
                      <div className="num hide-mobile">+£198</div>
                      <div className="num hide-mobile">29 Apr</div>
                      <div>
                        <span className="badge badge-warning badge-dot">Renewal due</span>
                      </div>
                    </div>
                  </div>

                  <div className="mchart">
                    <div>
                      <div className="t">Margin per room · last 6 months</div>
                      <div className="s">AVG £218  ·  TARGET £230  ·  P25 £164 · P75 £284</div>
                      <div className="bars">
                        <span style={{ height: "52%" }} />
                        <span style={{ height: "60%" }} />
                        <span style={{ height: "64%" }} />
                        <span style={{ height: "72%" }} />
                        <span style={{ height: "80%" }} />
                        <span style={{ height: "74%" }} />
                      </div>
                    </div>
                    <div className="brk">
                      <div className="row"><span className="k">Rent</span><span className="v">£41,820</span></div>
                      <div className="row"><span className="k">Bills</span><span className="v">−£6,240</span></div>
                      <div className="row"><span className="k">Mgmt fees</span><span className="v">−£2,090</span></div>
                      <div className="row"><span className="k">Maintenance</span><span className="v">−£1,214</span></div>
                      <div
                        className="row"
                        style={{ borderTop: "1px solid var(--ink-200)", paddingTop: 8, marginTop: 4 }}
                      >
                        <span className="k" style={{ fontWeight: 500, color: "var(--ink-900)" }}>
                          Net margin
                        </span>
                        <span className="v" style={{ color: "var(--harbor-navy)", fontWeight: 500 }}>
                          £32,276
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* ============ PROBLEM ============ */}
        <section className="sec" id="problem">
          <div className="wrap">
            <div className="sec-head row-head">
              <div>
                <span className="pill">The problem</span>
                <h2 style={{ marginTop: "var(--space-5)" }}>
                  London doesn&apos;t rent by the flat. It rents <em>by the room</em>.
                </h2>
              </div>
              <p className="lede">
                Most property software was built for a landlord with one tenant per unit. A huge share of
                London stock doesn&apos;t work that way — which means operators spend their week in
                workarounds instead of their portfolio.
              </p>
            </div>

            <div className="problem">
              <div className="problem-card">
                <div className="tag">Before · the fragmented stack</div>
                <h3>Seven tabs, one spreadsheet, no margin visibility.</h3>
                <p>
                  The generic CRM logs leads. Excel tracks margin. SpareRoom lives in another tab.
                  Accounting exports sit in Drive. Every room is a fake &ldquo;property.&rdquo; Every
                  reconciliation is manual.
                </p>
                <div className="stack-list">
                  <span className="s strike">Excel: margin.xlsx</span>
                  <span className="s strike">Generic CRM</span>
                  <span className="s strike">SpareRoom tabs</span>
                  <span className="s strike">Xero exports</span>
                  <span className="s strike">Google Docs contracts</span>
                  <span className="s strike">WhatsApp threads</span>
                </div>
              </div>
              <div className="problem-card dark">
                <div className="tag">After · Harbor Ops</div>
                <h3>Rooms-first data model. Margin by bedroom. Acquisitions next to operations.</h3>
                <p>
                  Every property breaks down to the individual room. Occupancy, rent, renewals,
                  maintenance, margin — all tracked at the bedroom level, where the profitability
                  actually happens.
                </p>
                <div className="mini">
                  <div>
                    <div className="k">Per-room margin</div>
                    <div className="v">£218</div>
                  </div>
                  <div>
                    <div className="k">Days to fill</div>
                    <div className="v">11.4</div>
                  </div>
                  <div>
                    <div className="k">Rent collected</div>
                    <div className="v">98%</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ MODULES ============ */}
        <section className="sec" id="modules">
          <div className="wrap">
            <div className="sec-head row-head">
              <div>
                <span className="pill">Modules</span>
                <h2 style={{ marginTop: "var(--space-5)" }}>
                  Six modules. <em>One</em> operating picture.
                </h2>
              </div>
              <p className="lede">
                Every module is built on the same rooms-first data model — so profitability, maintenance,
                bookings and acquisitions all speak to the same bedroom-level truth.
              </p>
            </div>

            <div className="modules">
              <div className="mod">
                <div className="idx">01 / 06</div>
                <div className="ico">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 21V8l9-5 9 5v13" />
                    <path d="M9 21v-7h6v7" />
                    <path d="M6 14h12" />
                  </svg>
                </div>
                <h4>
                  Properties &amp; <em>rooms</em>
                </h4>
                <p>
                  Every property breaks down to the individual bedroom. Track occupancy, rent, condition
                  and renewal at room level — not just unit level.
                </p>
                <ul>
                  <li>Room-level floorplans</li>
                  <li>En-suite / shared flags</li>
                  <li>Condition photos &amp; history</li>
                </ul>
              </div>

              <div className="mod">
                <div className="idx">02 / 06</div>
                <div className="ico">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="7" r="4" />
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                    <path d="M23 21v-2a4 4 0 00-3-3.87" />
                  </svg>
                </div>
                <h4>Tenants &amp; contracts</h4>
                <p>
                  Leads through offboarding in one lifecycle. Digital signatures, automated renewals,
                  communication history attached to the room.
                </p>
                <ul>
                  <li>Lead → applicant → tenant</li>
                  <li>Digital signing &amp; references</li>
                  <li>Renewal reminders on rails</li>
                </ul>
              </div>

              <div className="mod">
                <div className="idx">03 / 06</div>
                <div className="ico">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="5" width="20" height="14" rx="2" />
                    <line x1="2" y1="10" x2="22" y2="10" />
                    <line x1="7" y1="15" x2="10" y2="15" />
                  </svg>
                </div>
                <h4>Bookings &amp; payments</h4>
                <p>
                  Rent collection, invoice status, reconciliation and arrears tracking. Long-term
                  tenancies and short lets live in one ledger.
                </p>
                <ul>
                  <li>GoCardless &amp; bank feeds</li>
                  <li>Arrears chaser workflows</li>
                  <li>Short-let support</li>
                </ul>
              </div>

              <div className="mod">
                <div className="idx">04 / 06</div>
                <div className="ico">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                </div>
                <h4>Profitability</h4>
                <p>
                  Real margin per property and per room. Not revenue — profit after bills, management
                  fees and maintenance. See which rooms earn and which leak.
                </p>
                <ul>
                  <li>Margin per bedroom</li>
                  <li>Net yield vs target</li>
                  <li>Leak detection</li>
                </ul>
              </div>

              <div className="mod">
                <div className="idx">05 / 06</div>
                <div className="ico">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <path d="M9 14l2 2 4-4" />
                  </svg>
                </div>
                <h4>Maintenance</h4>
                <p>
                  Ticketing, vendor assignment, scheduling and cost tracking — tied back to profitability
                  so you see the true cost of every unit.
                </p>
                <ul>
                  <li>Tenant ticket portal</li>
                  <li>Vendor SLA tracking</li>
                  <li>Cost flows into P&amp;L</li>
                </ul>
              </div>

              <div className="mod">
                <div className="idx">06 / 06</div>
                <div className="ico">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                    <polyline points="17 6 23 6 23 12" />
                  </svg>
                </div>
                <h4>
                  Acquisitions &amp; <em>market</em>
                </h4>
                <p>
                  Live SpareRoom feed plus an underwriting calculator. Know whether a deal clears your
                  return threshold before you schedule the viewing.
                </p>
                <ul>
                  <li>SpareRoom scraper feed</li>
                  <li>Break-even calculator</li>
                  <li>Pipeline &amp; deal stage</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ============ ACQUISITIONS DEEP DIVE ============ */}
        <section className="sec" id="acquisitions">
          <div className="wrap">
            <div className="sec-head">
              <span className="pill">Deep dive · 06</span>
              <h2 style={{ marginTop: "var(--space-5)" }}>
                Underwrite the deal before you <em>view the house</em>.
              </h2>
              <p className="lede">
                A live SpareRoom feed brings room-rate comps into the app. The break-even calculator
                reads your own portfolio&apos;s cost structure — bills, management fees, void assumptions
                — and tells you what margin a prospective HMO clears at your threshold.
              </p>
            </div>

            <div className="acq">
              <div className="acq-copy">
                <h3>
                  Every listing, <em>pre-underwritten</em>.
                </h3>
                <p>
                  Paste a SpareRoom or property-portal URL. Harbor Ops pulls the listing, matches
                  comparable room rates within a 500m radius, and runs your portfolio&apos;s cost model
                  against it — so you see margin-per-room before you open the inbox.
                </p>

                <div className="acq-list">
                  <div className="item">
                    <div className="n">01</div>
                    <div>
                      <h5>Live comps within 500m</h5>
                      <p>Room rates, en-suite premium, time-on-market — scraped and indexed nightly.</p>
                    </div>
                  </div>
                  <div className="item">
                    <div className="n">02</div>
                    <div>
                      <h5>Your cost model, not a generic one</h5>
                      <p>Void rate, management overhead, council tax band — pulled from your own portfolio history.</p>
                    </div>
                  </div>
                  <div className="item">
                    <div className="n">03</div>
                    <div>
                      <h5>Verdict in plain English</h5>
                      <p>Clears / doesn&apos;t clear / marginal. Plus the stress test: what the numbers look like at 85% occupancy.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="calc">
                <div className="calc-top">
                  <span className="ttl">Deal underwrite · SR-48219</span>
                  <div className="right">
                    <span className="live" />
                    Live comps · 11 min ago
                  </div>
                </div>

                <div className="listing">
                  <div className="photo">
                    LISTING
                    <br />
                    PHOTO
                  </div>
                  <div>
                    <h6>5-bed HMO · Forest Hill</h6>
                    <div className="addr">SE23 · 3 en-suite · C1 use class · EPC C</div>
                    <div className="tags">
                      <span className="badge badge-info badge-dot">SpareRoom</span>
                      <span className="badge badge-neutral">C1 use</span>
                      <span className="badge badge-neutral">Freehold</span>
                    </div>
                  </div>
                </div>

                <div className="calc-body">
                  <div className="calc-row"><span className="k">Asking price</span><span className="v">£685,000</span></div>
                  <div className="calc-row"><span className="k">Projected rent roll (5 rooms)</span><span className="v">£4,950 / mo</span></div>
                  <div className="calc-row"><span className="k">Bills &amp; council tax</span><span className="v">−£820 / mo</span></div>
                  <div className="calc-row"><span className="k">Management @ 8%</span><span className="v">−£396 / mo</span></div>
                  <div className="calc-row"><span className="k">Void allowance (12%)</span><span className="v">−£594 / mo</span></div>
                  <div className="calc-row"><span className="k">Finance cost (65% LTV · 5.4%)</span><span className="v">−£2,003 / mo</span></div>
                  <div className="calc-row total"><span className="k">Net margin / month</span><span className="v">£1,137</span></div>
                </div>

                <div className="verdict">
                  <div className="icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div>
                    <div className="t">Clears threshold · £227 margin per room</div>
                    <div className="s">Target £200 · stress-tested at 85% occ → £174</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ PROFITABILITY DEEP DIVE ============ */}
        <section className="sec" id="profitability">
          <div className="wrap">
            <div className="sec-head">
              <span className="pill">Deep dive · 04</span>
              <h2 style={{ marginTop: "var(--space-5)" }}>
                The bedroom is the P&amp;L <em>unit</em>.
              </h2>
              <p className="lede">
                Revenue per property is a vanity number. The question that matters — which rooms earn and
                which leak — has always lived in a spreadsheet. Harbor Ops answers it in the app.
              </p>
            </div>

            <div className="profit">
              <div className="prop-card">
                <div className="prop-head">
                  <div>
                    <div className="code">W2-04 · SUSSEX GARDENS</div>
                    <div className="addr" style={{ marginTop: 2 }}>
                      4-bed HMO · W2 1UH
                    </div>
                    <div className="sub">acquired Jun 2024 · £782,000</div>
                  </div>
                  <div className="right">
                    <div className="k">Net margin / mo</div>
                    <div className="v">+£1,086</div>
                  </div>
                </div>

                <div className="room-row">
                  <div className="rn">R1</div>
                  <div className="tenant">
                    <div className="nm">Amelia K.</div>
                    <div className="meta">renewal 14 JUN · 18 months</div>
                  </div>
                  <div className="num" style={{ textAlign: "left" }}>£1,180</div>
                  <div className="num pos">+£284</div>
                  <div className="hide-mobile">
                    <div className="bar"><span style={{ width: "92%" }} /></div>
                  </div>
                  <div className="hide-mobile">
                    <span className="badge badge-success badge-dot">Let</span>
                  </div>
                </div>

                <div className="room-row">
                  <div className="rn">R2</div>
                  <div className="tenant">
                    <div className="nm">Marcus H.</div>
                    <div className="meta">renewal 02 AUG · 12 months</div>
                  </div>
                  <div className="num" style={{ textAlign: "left" }}>£1,040</div>
                  <div className="num pos">+£198</div>
                  <div className="hide-mobile">
                    <div className="bar"><span style={{ width: "78%" }} /></div>
                  </div>
                  <div className="hide-mobile">
                    <span className="badge badge-success badge-dot">Let</span>
                  </div>
                </div>

                <div className="room-row">
                  <div className="rn">R3</div>
                  <div className="tenant">
                    <div className="nm">Priya R.</div>
                    <div className="meta">renewal 29 APR · overdue response</div>
                  </div>
                  <div className="num" style={{ textAlign: "left" }}>£920</div>
                  <div className="num pos">+£112</div>
                  <div className="hide-mobile">
                    <div className="bar"><span style={{ width: "54%" }} /></div>
                  </div>
                  <div className="hide-mobile">
                    <span className="badge badge-warning badge-dot">Renewal</span>
                  </div>
                </div>

                <div className="room-row">
                  <div className="rn vacant">R4</div>
                  <div className="tenant">
                    <div className="nm" style={{ color: "var(--danger-fg)" }}>
                      Vacant · 11 days
                    </div>
                    <div className="meta">listed on SpareRoom · 7 enquiries</div>
                  </div>
                  <div className="num" style={{ textAlign: "left" }}>—</div>
                  <div className="num neg">−£148</div>
                  <div className="hide-mobile">
                    <div className="bar"><span style={{ width: "12%", background: "var(--danger-fg)" }} /></div>
                  </div>
                  <div className="hide-mobile">
                    <span className="badge badge-danger badge-dot">Vacant</span>
                  </div>
                </div>
              </div>

              <div className="profit-copy">
                <h3>
                  Room R4 is quietly <em>costing you</em> £148 a month.
                </h3>
                <p>
                  Bills, council tax and finance keep running whether the bedroom is let or empty.
                  Harbor Ops surfaces the true cost of a vacancy in real time — and shows exactly which
                  rooms are pulling their weight against your portfolio target.
                </p>

                <div className="profit-stats">
                  <div className="cell">
                    <div className="v">£218</div>
                    <div className="k">AVG MARGIN / ROOM</div>
                  </div>
                  <div className="cell">
                    <div className="v">11.4 days</div>
                    <div className="k">AVG ROOM VOID</div>
                  </div>
                  <div className="cell">
                    <div className="v">£1,086</div>
                    <div className="k">NET / MONTH · W2-04</div>
                  </div>
                  <div className="cell">
                    <div className="v">89.4%</div>
                    <div className="k">PORTFOLIO OCCUPANCY</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ SURFACES ============ */}
        <section className="sec" id="surfaces">
          <div className="wrap">
            <div className="ws-panel">
              <span className="pill">
                <span className="dot" />
                Two surfaces · single codebase
              </span>
              <h3>
                Operator back office. Tenant self-serve. <em>Both built in</em>.
              </h3>
              <p className="lede">
                Prospective tenants book rooms online — applications, viewings, offers, all through
                your branded subdomain. Current tenants raise maintenance tickets through AI triage
                that categorises the issue, estimates cost and routes it to the right vendor. One
                database, role-gated access, nothing to wire together.
              </p>

              <WorkspaceToggle />
            </div>
          </div>
        </section>

        {/* ============ TESTIMONIALS ============ */}
        <section className="sec" id="testimonials">
          <div className="wrap">
            <div className="sec-head row-head">
              <div>
                <span className="pill">Operators</span>
                <h2 style={{ marginTop: "var(--space-5)" }}>
                  Built with <em>operators</em>, not focus groups.
                </h2>
              </div>
              <p className="lede">
                Early access is running with a handful of London HMO operators and boutique agencies
                across Zones 1–3.
              </p>
            </div>

            <div className="testimonials">
              <div className="quote-card">
                <div className="mk">&ldquo;</div>
                <p className="q">
                  We stopped listing every bedroom as a fake &ldquo;property.&rdquo; Our team finally{" "}
                  <em>sees the same numbers</em> at the same time — and the spreadsheet has been retired.
                </p>
                <div className="who">
                  <div className="avatar">JO</div>
                  <div>
                    <div className="name">James O.</div>
                    <div className="role">HMO operator · SE8, SE16 · 34 rooms</div>
                  </div>
                </div>
              </div>
              <div className="quote-card">
                <div className="mk">&ldquo;</div>
                <p className="q">
                  The break-even calculator killed two deals in the first week — deals we would&apos;ve
                  viewed otherwise. That alone paid for a year of the tool.
                </p>
                <div className="who">
                  <div className="avatar">RN</div>
                  <div>
                    <div className="name">Rhea N.</div>
                    <div className="role">R2R operator · W2, NW6 · 22 rooms</div>
                  </div>
                </div>
              </div>
              <div className="quote-card">
                <div className="mk">&ldquo;</div>
                <p className="q">
                  We run an agency and a management arm off one spreadsheet stack. Harbor Ops is the
                  first tool that assumes both things are true about us.
                </p>
                <div className="who">
                  <div className="avatar">DL</div>
                  <div>
                    <div className="name">Daniela L.</div>
                    <div className="role">Boutique estate agency · E1, E2 · 58 units</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ FOUNDER ============ */}
        <section className="sec" id="founder">
          <div className="wrap">
            <div className="founder">
              <div className="port">
                FOUNDER
                <br />
                PORTRAIT
                <br />
                &lt;drop image&gt;
              </div>
              <div>
                <div className="tag">Origin</div>
                <blockquote>
                  Harbor Ops started as internal tooling for a live London portfolio — W2, SW8/SW12,
                  SE8/SE16, E1/E2. After enough other operators asked what we were using, we made it a
                  product. <em>Built by an operator, not a remote product team.</em>
                </blockquote>
                <div className="signoff">
                  <strong>Harbor Ops founding team</strong> · shipping since 2024
                </div>
                <div className="postcodes">
                  <span className="pc">W2</span>
                  <span className="pc">SW8</span>
                  <span className="pc">SW12</span>
                  <span className="pc">SE8</span>
                  <span className="pc">SE16</span>
                  <span className="pc">E1</span>
                  <span className="pc">E2</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ CTA ============ */}
        <section className="sec tight" id="pricing">
          <div className="wrap">
            <div className="cta">
              <div>
                <span className="pill">
                  <span className="dot" />
                  Early access
                </span>
                <h3 style={{ marginTop: "var(--space-5)" }}>
                  Bring your portfolio. Leave your <em>spreadsheets</em>.
                </h3>
                <p>
                  Rolling invite list for London HMO operators and agencies with 10+ rooms. Onboarding
                  includes a 1:1 migration session and 90 days of import support.
                </p>
                <div className="cta-meta">
                  <span>£149 / mo per workspace · during early access</span>
                  <span>Cancel any time</span>
                  <span>Data export on day one</span>
                </div>
              </div>
              <AccessRequestForm />
            </div>
          </div>
        </section>

        {/* ============ FOOTER ============ */}
        <footer className="foot">
          <div className="wrap">
            <div className="foot-grid">
              <div>
                <div className="foot-brand">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/harbor-logo.png" alt="Harbor Ops" width={24} height={24} />
                  <span>
                    Harbor{" "}
                    <em style={{ fontFamily: "var(--ho-font-serif)", fontStyle: "italic", fontWeight: 400 }}>
                      Ops
                    </em>
                  </span>
                </div>
                <p className="tag">
                  The operating system for room-by-room property management in London. Built by
                  operators, for operators.
                </p>
              </div>
              <div>
                <h6>Product</h6>
                <ul>
                  <li><a href="#modules">Modules</a></li>
                  <li><a href="#acquisitions">Acquisitions</a></li>
                  <li><a href="#profitability">Profitability</a></li>
                  <li><a href="#surfaces">Surfaces</a></li>
                </ul>
              </div>
              <div>
                <h6>Company</h6>
                <ul>
                  <li><a href="#founder">Origin</a></li>
                  <li><a href="#testimonials">Operators</a></li>
                  <li><a href="#pricing">Demo</a></li>
                  <li><a href="#">Changelog</a></li>
                </ul>
              </div>
              <div>
                <h6>Resources</h6>
                <ul>
                  <li><a href="#">HMO margin guide</a></li>
                  <li><a href="#">Zone-2 room rates</a></li>
                  <li><a href="#">Data &amp; privacy</a></li>
                  <li><a href="#">Contact</a></li>
                </ul>
              </div>
            </div>
            <div className="wrap foot-bottom" style={{ paddingLeft: 0, paddingRight: 0 }}>
              <div>© 2026 Harbor Ops · London, UK</div>
              <div>v1.0 · built room-by-room</div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
