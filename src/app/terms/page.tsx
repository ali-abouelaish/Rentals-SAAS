import "../_legal/legal.css";
import { TocScrollSpy } from "../_legal/TocScrollSpy";
import { PrintButton } from "../_legal/PrintButton";

export const metadata = {
  title: "Harbor Ops — Terms & Conditions of Service",
  description:
    "These Terms govern your access to and use of the Harbor Ops platform — the room-by-room property management software operated by Harbor Ops Ltd.",
};

const sections = [
  { id: "s1", num: "01", title: "Introduction" },
  { id: "s2", num: "02", title: "Definitions" },
  { id: "s3", num: "03", title: "Account registration & eligibility" },
  { id: "s4", num: "04", title: "Subscription & payment" },
  { id: "s5", num: "05", title: "Permitted use & restrictions" },
  { id: "s6", num: "06", title: "Customer Data & data processing" },
  { id: "s7", num: "07", title: "Intellectual property" },
  { id: "s8", num: "08", title: "Availability & maintenance" },
  { id: "s9", num: "09", title: "Confidentiality" },
  { id: "s10", num: "10", title: "Warranties & disclaimers" },
  { id: "s11", num: "11", title: "Limitation of liability" },
  { id: "s12", num: "12", title: "Indemnification" },
  { id: "s13", num: "13", title: "Term & termination" },
  { id: "s14", num: "14", title: "Governing law & disputes" },
  { id: "s15", num: "15", title: "General" },
];

export default function TermsPage() {
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
              Legal · binding agreement
            </span>
            <h1>
              Terms &amp; <em>Conditions</em> of Service.
            </h1>
            <p className="lede">
              These Terms govern your access to and use of the Harbor Ops platform — the
              room-by-room property management software operated by Harbor Ops Ltd. By
              registering for or using the Platform, you agree to be bound by everything
              below.
            </p>

            <div className="doc-tabs" role="tablist">
              <a href="/terms" className="active">
                Terms
              </a>
              <a href="/privacy">Privacy Policy</a>
            </div>

            <div className="meta-strip">
              <div className="cell">
                <div className="k">Effective date</div>
                <div className="v">
                  <em>May</em> 2025
                </div>
              </div>
              <div className="cell">
                <div className="k">Document</div>
                <div className="v">v1.0 · 15 sections</div>
              </div>
              <div className="cell">
                <div className="k">Operated by</div>
                <div className="v">Harbor Ops Ltd · 17215410</div>
              </div>
              <div className="cell">
                <div className="k">Governing law</div>
                <div className="v">England &amp; Wales</div>
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
                    These Terms and Conditions (“Terms”) govern your access to and use of
                    the Harbor Ops platform (“Platform”), a property management
                    software-as-a-service (“SaaS”) operated by Harbor Ops Ltd, a company
                    registered in England and Wales (Company Number: 17215410). By
                    registering for or using the Platform, you (“Customer” or “User”)
                    agree to be bound by these Terms.
                  </p>
                  <p>
                    If you are entering into these Terms on behalf of a business or
                    organisation, you represent and warrant that you have authority to
                    bind that entity to these Terms.
                  </p>
                </div>
              </section>

              <section id="s2">
                <div className="section-head">
                  <div className="section-num">02</div>
                  <h2>Definitions</h2>
                </div>
                <div className="section-body">
                  <p>In these Terms, the following definitions apply:</p>
                  <div className="defs">
                    <div className="def">
                      <div className="term">Platform</div>
                      <div className="desc">
                        The Harbor Ops web-based property management application and all
                        related services, APIs, and features.
                      </div>
                    </div>
                    <div className="def">
                      <div className="term">Subscription</div>
                      <div className="desc">
                        The paid plan purchased by the Customer granting access to the
                        Platform.
                      </div>
                    </div>
                    <div className="def">
                      <div className="term">User</div>
                      <div className="desc">
                        Any individual authorised by the Customer to access the Platform
                        under the Customer’s account.
                      </div>
                    </div>
                    <div className="def">
                      <div className="term">Customer Data</div>
                      <div className="desc">
                        All data uploaded to or generated on the Platform by the Customer
                        or its Users, including tenant records, financial data, and
                        property information.
                      </div>
                    </div>
                    <div className="def">
                      <div className="term">Confidential Information</div>
                      <div className="desc">
                        Any non-public information disclosed by either party in connection
                        with these Terms.
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section id="s3">
                <div className="section-head">
                  <div className="section-num">03</div>
                  <h2>Account registration &amp; eligibility</h2>
                </div>
                <div className="section-body">
                  <p>
                    To use the Platform, you must register an account and provide
                    accurate, complete, and current information. You must be at least 18
                    years old and a legally incorporated business or sole trader operating
                    within the United Kingdom (or such other jurisdiction as we may
                    permit).
                  </p>
                  <p>
                    You are responsible for maintaining the confidentiality of your login
                    credentials and for all activity that occurs under your account. You
                    must notify us immediately at{" "}
                    <a className="inline" href="mailto:legal@harborops.co.uk">
                      legal@harborops.co.uk
                    </a>{" "}
                    if you become aware of any unauthorised access.
                  </p>
                  <p>
                    We reserve the right to suspend or terminate accounts that provide
                    false information or violate these Terms.
                  </p>
                </div>
              </section>

              <section id="s4">
                <div className="section-head">
                  <div className="section-num">04</div>
                  <h2>Subscription &amp; payment</h2>
                </div>
                <div className="section-body">
                  <h3>4.1 Plans and fees</h3>
                  <p>
                    Access to the Platform is provided on a subscription basis. Fees are
                    as set out on our pricing page at{" "}
                    <a className="inline" href="/#pricing">
                      harborops.co.uk/pricing
                    </a>{" "}
                    and may vary by plan tier. All fees are quoted exclusive of VAT unless
                    stated otherwise.
                  </p>

                  <h3>4.2 Billing</h3>
                  <p>
                    Subscriptions are billed in advance on a monthly or annual basis
                    depending on the plan selected. Payment is processed via our
                    third-party payment provider. By providing payment details, you
                    authorise us to charge the applicable fees on each renewal date.
                  </p>

                  <h3>4.3 Late payment</h3>
                  <p>
                    If payment is not received by the due date, we reserve the right to
                    suspend access to the Platform until outstanding amounts are settled.
                    Overdue amounts may attract interest at 4% above the Bank of England
                    base rate per annum.
                  </p>

                  <h3>4.4 Refunds</h3>
                  <p>
                    Subscription fees are non-refundable except where required by
                    applicable law or as expressly stated in writing by Harbor Ops. If you
                    cancel your subscription, access will continue until the end of the
                    current billing period.
                  </p>

                  <h3>4.5 Price changes</h3>
                  <p>
                    We may change subscription fees at any time. We will provide at least
                    30 days’ written notice of any price increase. Your continued use of
                    the Platform after the notice period constitutes acceptance of the new
                    fees.
                  </p>

                  <div className="callout">
                    <div className="ico">£</div>
                    <div className="body">
                      All fees are quoted in <strong>GBP and exclude VAT</strong>. Late
                      payment may attract interest at{" "}
                      <strong>4% above the Bank of England base rate</strong> per annum.
                    </div>
                  </div>
                </div>
              </section>

              <section id="s5">
                <div className="section-head">
                  <div className="section-num">05</div>
                  <h2>Permitted use &amp; restrictions</h2>
                </div>
                <div className="section-body">
                  <p>
                    You may use the Platform solely for lawful property management
                    purposes in connection with your own letting agency or property
                    portfolio. You must not:
                  </p>
                  <ul>
                    <li>
                      sublicense, resell, or otherwise make the Platform available to
                      third parties except as expressly permitted;
                    </li>
                    <li>
                      reverse engineer, decompile, or attempt to extract source code from
                      the Platform;
                    </li>
                    <li>
                      use the Platform to store or transmit unlawful, harmful, or
                      fraudulent content;
                    </li>
                    <li>
                      interfere with or disrupt the integrity or performance of the
                      Platform or its infrastructure;
                    </li>
                    <li>
                      attempt to gain unauthorised access to any part of the Platform or
                      its related systems;
                    </li>
                    <li>
                      use automated scripts or bots to access the Platform in a manner
                      that exceeds normal usage.
                    </li>
                  </ul>
                </div>
              </section>

              <section id="s6">
                <div className="section-head">
                  <div className="section-num">06</div>
                  <h2>Customer Data &amp; data processing</h2>
                </div>
                <div className="section-body">
                  <p>
                    You retain all ownership of Customer Data. By uploading data to the
                    Platform, you grant Harbor Ops a limited licence to process that data
                    solely for the purpose of providing the Platform services.
                  </p>
                  <p>
                    We process personal data contained within Customer Data as a data
                    processor on your behalf. Where you direct us to process personal data
                    of tenants or third parties, you are the data controller and are
                    responsible for ensuring that such processing is lawful. Our data
                    processing obligations are further described in our{" "}
                    <a className="inline" href="/privacy">
                      Privacy Policy
                    </a>{" "}
                    and any Data Processing Agreement entered into with you.
                  </p>
                  <p>
                    We implement appropriate technical and organisational measures to
                    protect Customer Data against unauthorised access, loss, or
                    disclosure. However, no system is completely secure and we cannot
                    guarantee absolute security.
                  </p>
                </div>
              </section>

              <section id="s7">
                <div className="section-head">
                  <div className="section-num">07</div>
                  <h2>Intellectual property</h2>
                </div>
                <div className="section-body">
                  <p>
                    The Platform, including all software, designs, content, and
                    documentation, is the exclusive property of Harbor Ops Ltd and its
                    licensors. Nothing in these Terms transfers any intellectual property
                    rights to you.
                  </p>
                  <p>
                    You may not copy, reproduce, modify, or create derivative works of any
                    part of the Platform without our prior written consent.
                  </p>
                  <p>
                    Harbor Ops may use aggregated, anonymised data derived from usage of
                    the Platform for product improvement and analytics purposes, provided
                    such data cannot be used to identify you or any individual.
                  </p>
                </div>
              </section>

              <section id="s8">
                <div className="section-head">
                  <div className="section-num">08</div>
                  <h2>Availability &amp; maintenance</h2>
                </div>
                <div className="section-body">
                  <p>
                    We will use commercially reasonable efforts to make the Platform
                    available with a target uptime of 99.5% per calendar month, excluding
                    scheduled maintenance and circumstances beyond our reasonable control.
                  </p>
                  <p>
                    We reserve the right to carry out scheduled maintenance, which we will
                    aim to perform during off-peak hours and with prior notice where
                    practicable. Unplanned downtime or degraded performance does not
                    entitle you to a refund unless expressly agreed.
                  </p>
                  <p>
                    We may update, modify, or discontinue features of the Platform at any
                    time. Where a change materially reduces functionality, we will provide
                    reasonable notice.
                  </p>
                </div>
              </section>

              <section id="s9">
                <div className="section-head">
                  <div className="section-num">09</div>
                  <h2>Confidentiality</h2>
                </div>
                <div className="section-body">
                  <p>
                    Each party agrees to keep the other’s Confidential Information
                    confidential and not to disclose it to any third party without prior
                    written consent, except as required by law or regulation.
                  </p>
                  <p>
                    This obligation does not apply to information that is or becomes
                    publicly available through no fault of the receiving party, or that
                    was already known to the receiving party prior to disclosure.
                  </p>
                </div>
              </section>

              <section id="s10">
                <div className="section-head">
                  <div className="section-num">10</div>
                  <h2>Warranties &amp; disclaimers</h2>
                </div>
                <div className="section-body">
                  <p>
                    We warrant that the Platform will substantially perform in accordance
                    with its documentation under normal use and conditions. We do not
                    warrant that the Platform will be error-free or uninterrupted.
                  </p>
                  <div className="callout dark">
                    <div className="ico">!</div>
                    <div className="body">
                      THE PLATFORM IS PROVIDED ON AN{" "}
                      <strong>“AS IS” AND “AS AVAILABLE”</strong> BASIS. TO THE FULLEST
                      EXTENT PERMITTED BY APPLICABLE LAW, WE DISCLAIM ALL OTHER
                      WARRANTIES, EXPRESS OR IMPLIED, INCLUDING ANY IMPLIED WARRANTIES OF
                      MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR
                      NON-INFRINGEMENT.
                    </div>
                  </div>
                  <p>
                    We do not provide legal, financial, or tax advice. Any tools or
                    templates provided within the Platform are for informational purposes
                    only and should not be relied upon as professional advice.
                  </p>
                </div>
              </section>

              <section id="s11">
                <div className="section-head">
                  <div className="section-num">11</div>
                  <h2>Limitation of liability</h2>
                </div>
                <div className="section-body">
                  <p>
                    To the fullest extent permitted by law, Harbor Ops shall not be liable
                    for any indirect, incidental, special, consequential, or punitive
                    damages arising out of or related to your use of the Platform,
                    including loss of profit, loss of data, or loss of goodwill.
                  </p>
                  <p>
                    Our total aggregate liability to you in connection with these Terms
                    shall not exceed the total fees paid by you to Harbor Ops in the 12
                    months preceding the event giving rise to the claim.
                  </p>
                  <p>
                    Nothing in these Terms limits liability for death or personal injury
                    caused by negligence, fraud or fraudulent misrepresentation, or any
                    other liability that cannot be excluded by law.
                  </p>
                </div>
              </section>

              <section id="s12">
                <div className="section-head">
                  <div className="section-num">12</div>
                  <h2>Indemnification</h2>
                </div>
                <div className="section-body">
                  <p>
                    You agree to indemnify, defend, and hold harmless Harbor Ops and its
                    officers, directors, employees, and agents from any claims, losses,
                    damages, or costs (including reasonable legal fees) arising from:
                  </p>
                  <ul>
                    <li>your breach of these Terms;</li>
                    <li>your use of the Platform in violation of applicable law;</li>
                    <li>
                      any claim by a third party relating to Customer Data you have
                      uploaded.
                    </li>
                  </ul>
                </div>
              </section>

              <section id="s13">
                <div className="section-head">
                  <div className="section-num">13</div>
                  <h2>Term &amp; termination</h2>
                </div>
                <div className="section-body">
                  <p>
                    These Terms commence on the date you first access the Platform and
                    continue until your subscription is terminated.
                  </p>
                  <p>
                    Either party may terminate these Terms by providing 30 days’ written
                    notice. We may terminate immediately if you materially breach these
                    Terms and fail to remedy the breach within 14 days of written notice.
                  </p>
                  <p>
                    Upon termination, your right to access the Platform ceases. We will
                    retain Customer Data for up to 30 days following termination, during
                    which time you may request an export. After this period, Customer
                    Data may be permanently deleted.
                  </p>
                </div>
              </section>

              <section id="s14">
                <div className="section-head">
                  <div className="section-num">14</div>
                  <h2>Governing law &amp; disputes</h2>
                </div>
                <div className="section-body">
                  <p>
                    These Terms are governed by and construed in accordance with the laws
                    of England and Wales. Any disputes arising out of or in connection
                    with these Terms shall be subject to the exclusive jurisdiction of
                    the courts of England and Wales.
                  </p>
                  <p>
                    Before initiating formal proceedings, the parties agree to attempt to
                    resolve any dispute in good faith through written notice and a 30-day
                    negotiation period.
                  </p>
                </div>
              </section>

              <section id="s15">
                <div className="section-head">
                  <div className="section-num">15</div>
                  <h2>General</h2>
                </div>
                <div className="section-body">
                  <div className="defs">
                    <div className="def">
                      <div className="term">Entire agreement</div>
                      <div className="desc">
                        These Terms, together with the Privacy Policy and any applicable
                        Order Form, constitute the entire agreement between the parties
                        regarding the Platform.
                      </div>
                    </div>
                    <div className="def">
                      <div className="term">Amendments</div>
                      <div className="desc">
                        We may update these Terms from time to time. Material changes will
                        be notified via email or in-platform notice at least 14 days
                        before they take effect.
                      </div>
                    </div>
                    <div className="def">
                      <div className="term">Waiver</div>
                      <div className="desc">
                        Failure by either party to enforce any right or provision of these
                        Terms shall not constitute a waiver of future enforcement.
                      </div>
                    </div>
                    <div className="def">
                      <div className="term">Severability</div>
                      <div className="desc">
                        If any provision is found unenforceable, the remaining provisions
                        shall continue in full force.
                      </div>
                    </div>
                    <div className="def">
                      <div className="term">Assignment</div>
                      <div className="desc">
                        You may not assign your rights or obligations under these Terms
                        without our prior written consent. We may assign these Terms to
                        any successor entity.
                      </div>
                    </div>
                    <div className="def">
                      <div className="term">Notices</div>
                      <div className="desc">
                        All formal notices must be sent in writing to the registered
                        addresses of the respective parties or via email to
                        legal@harborops.co.uk.
                      </div>
                    </div>
                  </div>

                  <div className="contact">
                    <div>
                      <h4>Questions about these Terms?</h4>
                      <p>
                        Write to our legal team and we’ll respond within five working
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
