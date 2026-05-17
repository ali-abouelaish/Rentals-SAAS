import "../_legal/legal.css";
import { TocScrollSpy } from "../_legal/TocScrollSpy";
import { PrintButton } from "../_legal/PrintButton";

export const metadata = {
  title: "Harbor Ops — Privacy Policy",
  description:
    "How Harbor Ops Ltd collects, uses, stores, and shares information when you use the Harbor Ops platform — written in compliance with the UK GDPR and the Data Protection Act 2018.",
};

const sections = [
  { id: "s1", title: "Introduction" },
  { id: "s2", title: "What data we collect" },
  { id: "s3", title: "How we use your data" },
  { id: "s4", title: "Data we process on your behalf" },
  { id: "s5", title: "Sharing of data" },
  { id: "s6", title: "International data transfers" },
  { id: "s7", title: "Data retention" },
  { id: "s8", title: "Cookies" },
  { id: "s9", title: "Your rights under UK GDPR" },
  { id: "s10", title: "Security" },
  { id: "s11", title: "Children’s data" },
  { id: "s12", title: "Changes to this policy" },
  { id: "s13", title: "Contact us" },
];

export default function PrivacyPage() {
  return (
    <div className="harbor-legal">
      <div className="bg-layer bg-grain" aria-hidden />
      <div className="bg-layer bg-grid" aria-hidden />

      <div className="page">
        {/* NAV */}
        <nav className="nav">
          <div className="wrap nav-inner">
            <a href="/" className="brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/harbor-logo.png" alt="Harbor Ops" width={28} height={28} />
              <span className="brand-name">
                Harbor <em>Ops</em>
              </span>
            </a>
            <div className="nav-links">
              <a href="/#problem">Why Harbor</a>
              <a href="/#modules">Modules</a>
              <a href="/#acquisitions">Acquisitions</a>
              <a href="/#profitability">Profitability</a>
              <a href="/#workspaces">Workspaces</a>
              <a href="/#pricing">Access</a>
            </div>
            <div className="nav-cta">
              <a href="/login" className="btn btn-ghost btn-sm">
                Sign in
              </a>
              <a href="/signup" className="btn btn-primary btn-sm">
                Request a demo
              </a>
            </div>
          </div>
        </nav>

        {/* HERO */}
        <header className="legal-hero">
          <div className="wrap legal-hero-inner">
            <span className="pill">
              <span className="dot" />
              Legal · UK GDPR &amp; Data Protection Act 2018
            </span>
            <h1>
              How we handle <em>your data</em>.
            </h1>
            <p className="lede">
              Harbor Ops Ltd is committed to protecting your personal data. This Privacy
              Policy explains how we collect, use, store, and share information when you
              use the Harbor Ops platform — written in compliance with the UK GDPR and the
              Data Protection Act 2018.
            </p>

            <div className="doc-tabs" role="tablist">
              <a href="/terms">Terms</a>
              <a href="/privacy" className="active">
                Privacy Policy
              </a>
            </div>

            <div className="meta-strip">
              <div className="cell">
                <div className="k">Effective date</div>
                <div className="v">
                  <em>May</em> 2025
                </div>
              </div>
              <div className="cell">
                <div className="k">Data controller</div>
                <div className="v">Harbor Ops Ltd</div>
              </div>
              <div className="cell">
                <div className="k">Company number</div>
                <div className="v">17215410 · England &amp; Wales</div>
              </div>
              <div className="cell">
                <div className="k">Regulator</div>
                <div className="v">ICO · ico.org.uk</div>
              </div>
            </div>
          </div>
        </header>

        {/* BODY */}
        <main className="legal-body">
          <div className="wrap legal-grid">
            {/* TOC */}
            <aside className="toc" id="toc">
              <div className="label">Contents</div>
              <ol>
                {sections.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`}>{s.title}</a>
                  </li>
                ))}
              </ol>
              <div className="download">
                <PrintButton />
              </div>
            </aside>

            {/* ARTICLE */}
            <article className="article">
              <section id="s1">
                <div className="section-head">
                  <div className="section-num">01</div>
                  <h2>Introduction</h2>
                </div>
                <div className="section-body">
                  <p>
                    Harbor Ops Ltd (“Harbor Ops”, “we”, “us”, or “our”) is committed to
                    protecting your personal data. This Privacy Policy explains how we
                    collect, use, store, and share information when you use the Harbor
                    Ops platform (“Platform”). It is written in compliance with the UK
                    General Data Protection Regulation (“UK GDPR”) and the Data Protection
                    Act 2018.
                  </p>
                  <p>
                    Harbor Ops Ltd is registered in England and Wales (Company Number:
                    17215410) and acts as the data controller for personal data collected
                    from Users and website visitors.
                  </p>
                </div>
              </section>

              <section id="s2">
                <div className="section-head">
                  <div className="section-num">02</div>
                  <h2>What data we collect</h2>
                </div>
                <div className="section-body">
                  <h3>2.1 Data you provide directly</h3>
                  <ul>
                    <li>
                      <strong>Account registration information</strong> — name, email
                      address, business name, and contact details.
                    </li>
                    <li>
                      <strong>Billing information</strong> — payment details processed and
                      stored by our third-party payment provider (we do not store full
                      card details).
                    </li>
                    <li>
                      <strong>Customer Data</strong> — tenant records, property
                      information, lease documents, rent histories, and other data you
                      upload or create within the Platform.
                    </li>
                    <li>
                      <strong>Support and communications</strong> — information you
                      provide when contacting us for support.
                    </li>
                  </ul>

                  <h3>2.2 Data collected automatically</h3>
                  <ul>
                    <li>
                      <strong>Usage data</strong> — pages visited, features used, session
                      duration, and interactions within the Platform.
                    </li>
                    <li>
                      <strong>Device and technical data</strong> — IP address, browser
                      type, operating system, and device identifiers.
                    </li>
                    <li>
                      <strong>Cookies and similar technologies</strong> — session cookies
                      for authentication and analytics cookies (see Section 8).
                    </li>
                  </ul>
                </div>
              </section>

              <section id="s3">
                <div className="section-head">
                  <div className="section-num">03</div>
                  <h2>How we use your data</h2>
                </div>
                <div className="section-body">
                  <p>
                    We process your personal data for the following purposes and on the
                    following legal bases:
                  </p>
                  <div className="dtable">
                    <div className="row h">
                      <div>Purpose</div>
                      <div>What it involves</div>
                      <div>Legal basis</div>
                    </div>
                    <div className="row">
                      <div>
                        <strong>Provide &amp; operate the Platform</strong>
                      </div>
                      <div>Run your account, host your data, deliver features.</div>
                      <div className="basis">Performance of contract</div>
                    </div>
                    <div className="row">
                      <div>
                        <strong>Process payments &amp; subscriptions</strong>
                      </div>
                      <div>Charge fees, issue invoices, manage renewals.</div>
                      <div className="basis">Performance of contract</div>
                    </div>
                    <div className="row">
                      <div>
                        <strong>Transactional communications</strong>
                      </div>
                      <div>Invoices, service updates, security alerts.</div>
                      <div className="basis">Legitimate interest &amp; contract</div>
                    </div>
                    <div className="row">
                      <div>
                        <strong>Customer support</strong>
                      </div>
                      <div>Respond to queries and resolve issues.</div>
                      <div className="basis">Legitimate interest</div>
                    </div>
                    <div className="row">
                      <div>
                        <strong>Improve the Platform</strong>
                      </div>
                      <div>Aggregated, anonymised product analytics.</div>
                      <div className="basis">Legitimate interest</div>
                    </div>
                    <div className="row">
                      <div>
                        <strong>Legal &amp; regulatory compliance</strong>
                      </div>
                      <div>Tax, fraud prevention, data protection law.</div>
                      <div className="basis">Legal obligation</div>
                    </div>
                    <div className="row">
                      <div>
                        <strong>Marketing communications</strong>
                      </div>
                      <div>Product updates and feature announcements.</div>
                      <div className="basis">Consent, where required</div>
                    </div>
                  </div>
                </div>
              </section>

              <section id="s4">
                <div className="section-head">
                  <div className="section-num">04</div>
                  <h2>Data we process on your behalf (processor role)</h2>
                </div>
                <div className="section-body">
                  <p>
                    When you upload Customer Data to the Platform, which may include
                    personal data of your tenants or third parties, Harbor Ops acts as a
                    data processor and you are the data controller. We process such data
                    only on your documented instructions and in accordance with our
                    contractual obligations.
                  </p>
                  <p>
                    As the data controller for Customer Data, you are responsible for
                    ensuring you have a lawful basis to process that data and for
                    providing any required notices to the individuals concerned.
                  </p>
                  <div className="callout">
                    <div className="ico">§</div>
                    <div className="body">
                      A <strong>Data Processing Agreement (DPA)</strong> is available upon
                      request and governs our processing of Customer Data on your behalf.
                      Email{" "}
                      <a className="inline" href="mailto:legal@harborops.co.uk">
                        legal@harborops.co.uk
                      </a>{" "}
                      to request a copy.
                    </div>
                  </div>
                </div>
              </section>

              <section id="s5">
                <div className="section-head">
                  <div className="section-num">05</div>
                  <h2>Sharing of data</h2>
                </div>
                <div className="section-body">
                  <p>
                    We do not sell your personal data. We may share data with the
                    following categories of third parties:
                  </p>
                  <div className="dtable">
                    <div className="row h">
                      <div>Category</div>
                      <div>Purpose</div>
                      <div>Example</div>
                    </div>
                    <div className="row">
                      <div>
                        <strong>Payment processors</strong>
                      </div>
                      <div>Handle subscription billing.</div>
                      <div className="basis">e.g. Stripe</div>
                    </div>
                    <div className="row">
                      <div>
                        <strong>Hosting infrastructure</strong>
                      </div>
                      <div>
                        Privately managed servers — own database infrastructure, not
                        shared with third-party cloud storage.
                      </div>
                      <div className="basis">Harbor Ops infra</div>
                    </div>
                    <div className="row">
                      <div>
                        <strong>Email delivery services</strong>
                      </div>
                      <div>Send transactional and notification emails.</div>
                      <div className="basis">e.g. Resend</div>
                    </div>
                    <div className="row">
                      <div>
                        <strong>Analytics providers</strong>
                      </div>
                      <div>
                        Aggregated usage analytics, configured to minimise personal data
                        exposure.
                      </div>
                      <div className="basis">Privacy-respecting</div>
                    </div>
                    <div className="row">
                      <div>
                        <strong>Legal or regulatory authorities</strong>
                      </div>
                      <div>
                        Where required by law, court order, or to protect rights and
                        safety.
                      </div>
                      <div className="basis">As required by law</div>
                    </div>
                  </div>
                  <p>
                    All third-party processors are subject to contractual data processing
                    obligations and are required to implement appropriate security
                    measures.
                  </p>
                </div>
              </section>

              <section id="s6">
                <div className="section-head">
                  <div className="section-num">06</div>
                  <h2>International data transfers</h2>
                </div>
                <div className="section-body">
                  <p>
                    We primarily store and process data within the United Kingdom and the
                    European Economic Area. Where data is transferred to third countries,
                    we ensure adequate safeguards are in place, such as UK adequacy
                    decisions or Standard Contractual Clauses as appropriate.
                  </p>
                </div>
              </section>

              <section id="s7">
                <div className="section-head">
                  <div className="section-num">07</div>
                  <h2>Data retention</h2>
                </div>
                <div className="section-body">
                  <p>
                    We retain personal data for as long as necessary to fulfil the
                    purposes for which it was collected, including:
                  </p>
                  <div className="dtable">
                    <div className="row h">
                      <div>Data type</div>
                      <div>Retention period</div>
                      <div>Reason</div>
                    </div>
                    <div className="row">
                      <div>
                        <strong>Account data</strong>
                      </div>
                      <div>Duration of subscription + up to 7 years</div>
                      <div className="basis">Legal &amp; tax compliance</div>
                    </div>
                    <div className="row">
                      <div>
                        <strong>Customer Data</strong>
                      </div>
                      <div>30 days after account termination</div>
                      <div className="basis">
                        Then securely deleted, unless you request earlier deletion
                      </div>
                    </div>
                    <div className="row">
                      <div>
                        <strong>Usage &amp; log data</strong>
                      </div>
                      <div>Up to 12 months</div>
                      <div className="basis">Operational diagnostics</div>
                    </div>
                  </div>
                  <p>
                    You may request deletion of your personal data at any time, subject to
                    our legal retention obligations.
                  </p>
                </div>
              </section>

              <section id="s8">
                <div className="section-head">
                  <div className="section-num">08</div>
                  <h2>Cookies</h2>
                </div>
                <div className="section-body">
                  <p>We use the following categories of cookies:</p>
                  <ul>
                    <li>
                      <strong>Strictly necessary cookies</strong> — required for the
                      Platform to function, including authentication and session
                      management. These cannot be disabled.
                    </li>
                    <li>
                      <strong>Analytics cookies</strong> — used to understand how the
                      Platform is used, in aggregate. You may opt out of analytics cookies
                      via your account settings.
                    </li>
                  </ul>
                  <p>We do not use advertising or third-party tracking cookies.</p>
                </div>
              </section>

              <section id="s9">
                <div className="section-head">
                  <div className="section-num">09</div>
                  <h2>Your rights under UK GDPR</h2>
                </div>
                <div className="section-body">
                  <p>
                    As a data subject, you have the following rights regarding your
                    personal data:
                  </p>
                  <div className="rights">
                    <div className="r">
                      <div className="k">Right of access</div>
                      <div className="v">
                        Obtain a copy of the personal data we hold about you.
                      </div>
                    </div>
                    <div className="r">
                      <div className="k">Right to rectification</div>
                      <div className="v">
                        Request correction of inaccurate or incomplete data.
                      </div>
                    </div>
                    <div className="r">
                      <div className="k">Right to erasure</div>
                      <div className="v">
                        Request deletion of your data in certain circumstances.
                      </div>
                    </div>
                    <div className="r">
                      <div className="k">Right to restriction</div>
                      <div className="v">
                        Request that we restrict processing of your data.
                      </div>
                    </div>
                    <div className="r">
                      <div className="k">Right to data portability</div>
                      <div className="v">
                        Receive your data in a structured, machine-readable format.
                      </div>
                    </div>
                    <div className="r">
                      <div className="k">Right to object</div>
                      <div className="v">
                        Object to processing based on legitimate interests.
                      </div>
                    </div>
                    <div className="r">
                      <div className="k">Automated decisions</div>
                      <div className="v">
                        We don’t make solely automated decisions that have a legal or
                        similarly significant effect.
                      </div>
                    </div>
                    <div className="r">
                      <div className="k">Right to complain</div>
                      <div className="v">
                        Lodge a complaint with the Information Commissioner’s Office
                        (ICO).
                      </div>
                    </div>
                  </div>
                  <p>
                    To exercise any of these rights, please contact us at{" "}
                    <a className="inline" href="mailto:legal@harborops.co.uk">
                      legal@harborops.co.uk
                    </a>
                    . We will respond within 30 days. You also have the right to lodge a
                    complaint with the Information Commissioner’s Office (ICO) at{" "}
                    <a
                      className="inline"
                      href="https://ico.org.uk"
                      target="_blank"
                      rel="noopener"
                    >
                      ico.org.uk
                    </a>
                    .
                  </p>
                </div>
              </section>

              <section id="s10">
                <div className="section-head">
                  <div className="section-num">10</div>
                  <h2>Security</h2>
                </div>
                <div className="section-body">
                  <p>
                    We implement appropriate technical and organisational measures to
                    protect personal data against unauthorised access, disclosure,
                    alteration, or destruction. These measures include:
                  </p>
                  <ul>
                    <li>encryption in transit (TLS) and at rest;</li>
                    <li>role-based access controls and least-privilege provisioning;</li>
                    <li>regular security reviews and dependency auditing.</li>
                  </ul>
                  <div className="callout dark">
                    <div className="ico">!</div>
                    <div className="body">
                      In the event of a personal data breach that poses a risk to
                      individuals, we will notify the ICO{" "}
                      <strong>within 72 hours</strong> and affected individuals where
                      required by UK GDPR.
                    </div>
                  </div>
                </div>
              </section>

              <section id="s11">
                <div className="section-head">
                  <div className="section-num">11</div>
                  <h2>Children’s data</h2>
                </div>
                <div className="section-body">
                  <p>
                    The Platform is intended for use by businesses and is not directed at
                    individuals under the age of 18. We do not knowingly collect personal
                    data from children. If you believe we have inadvertently collected
                    such data, please contact us immediately.
                  </p>
                </div>
              </section>

              <section id="s12">
                <div className="section-head">
                  <div className="section-num">12</div>
                  <h2>Changes to this policy</h2>
                </div>
                <div className="section-body">
                  <p>
                    We may update this Privacy Policy from time to time to reflect changes
                    in our practices or applicable law. Material changes will be
                    communicated via email or in-platform notice at least 14 days before
                    they take effect. The effective date at the top of this document will
                    be updated accordingly.
                  </p>
                </div>
              </section>

              <section id="s13">
                <div className="section-head">
                  <div className="section-num">13</div>
                  <h2>Contact us</h2>
                </div>
                <div className="section-body">
                  <p>
                    If you have any questions about this Privacy Policy or how we handle
                    your data, please contact:
                  </p>
                  <div className="defs">
                    <div className="def">
                      <div className="term">Entity</div>
                      <div className="desc">Harbor Ops Ltd</div>
                    </div>
                    <div className="def">
                      <div className="term">Company no.</div>
                      <div className="desc">
                        17215410 — registered in England &amp; Wales
                      </div>
                    </div>
                    <div className="def">
                      <div className="term">Email</div>
                      <div className="desc">
                        <a className="inline" href="mailto:legal@harborops.co.uk">
                          legal@harborops.co.uk
                        </a>
                      </div>
                    </div>
                    <div className="def">
                      <div className="term">Website</div>
                      <div className="desc">
                        <a className="inline" href="/">
                          harborops.co.uk
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="contact">
                    <div>
                      <h4>Need a DPA, SAR, or data export?</h4>
                      <p>
                        Reach out to our data protection team — we respond within 30
                        days.
                      </p>
                    </div>
                    <a className="cbtn" href="mailto:legal@harborops.co.uk">
                      legal@harborops.co.uk →
                    </a>
                  </div>
                </div>
              </section>
            </article>
          </div>
        </main>

        {/* FOOTER */}
        <footer className="foot">
          <div className="wrap">
            <div className="foot-grid">
              <div>
                <div className="foot-brand">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/harbor-logo.png" alt="Harbor Ops" width={24} height={24} />
                  <span>
                    Harbor <em>Ops</em>
                  </span>
                </div>
                <p className="tag">
                  The operating system for room-by-room property management in London.
                  Built by operators, for operators.
                </p>
              </div>
              <div>
                <h6>Product</h6>
                <ul>
                  <li>
                    <a href="/#modules">Modules</a>
                  </li>
                  <li>
                    <a href="/#acquisitions">Acquisitions</a>
                  </li>
                  <li>
                    <a href="/#profitability">Profitability</a>
                  </li>
                  <li>
                    <a href="/#workspaces">Workspaces</a>
                  </li>
                </ul>
              </div>
              <div>
                <h6>Company</h6>
                <ul>
                  <li>
                    <a href="/#founder">Origin</a>
                  </li>
                  <li>
                    <a href="/#testimonials">Operators</a>
                  </li>
                  <li>
                    <a href="/#pricing">Access</a>
                  </li>
                  <li>
                    <a href="#">Changelog</a>
                  </li>
                </ul>
              </div>
              <div>
                <h6>Legal</h6>
                <ul>
                  <li>
                    <a href="/terms">Terms &amp; Conditions</a>
                  </li>
                  <li>
                    <a href="/privacy">Privacy Policy</a>
                  </li>
                  <li>
                    <a href="mailto:legal@harborops.co.uk">Contact legal</a>
                  </li>
                  <li>
                    <a href="#">DPA on request</a>
                  </li>
                </ul>
              </div>
            </div>
            <div
              className="wrap foot-bottom"
              style={{ paddingLeft: 0, paddingRight: 0 }}
            >
              <div>© 2026 Harbor Ops Ltd · Company No. 17215410 · London, UK</div>
              <div className="foot-legal-links">
                <a href="/terms">Terms</a>
                <a href="/privacy">Privacy</a>
              </div>
            </div>
          </div>
        </footer>
      </div>

      <TocScrollSpy />
    </div>
  );
}
