"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthShell, CheckIcon } from "@/components/auth/AuthShell";

export default function SignupPage() {
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    // Client-only submission for now — matches landing's AccessRequestForm.
    // Real pipe (email / demo-requests table) can be wired separately.
    await new Promise((r) => setTimeout(r, 300));
    setPending(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <AuthShell
        pill="Request a demo"
        heading={<>Bring your portfolio. Leave your <em>spreadsheets</em>.</>}
        lede="Private beta for London operators running 10+ rooms."
      >
        <div className="success-state">
          <div className="mark">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2>Demo request <em>received</em>.</h2>
          <p>
            Thanks — a human, not a bot, reviews every request. Expect a reply within 48 hours with a
            calendar link and onboarding steps.
          </p>
          <div className="email">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            Check your inbox for confirmation
          </div>
          <div style={{ maxWidth: 280, margin: "0 auto" }}>
            <Link href="/" className="btn btn-secondary">Back to site</Link>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      pill="Request a demo"
      heading={<>Bring your portfolio. Leave your <em>spreadsheets</em>.</>}
      lede="Private beta for London operators running 10+ rooms. A human — not a bot — reviews every request and replies within 48 hours to book your walkthrough."
      foot={<>Already onboarded? <Link href="/login">Sign in</Link></>}
    >
      <form onSubmit={onSubmit}>
        <div className="row-fields">
          <div className="field">
            <label className="lab" htmlFor="su-first">First name</label>
            <input id="su-first" className="input" name="first_name" type="text" placeholder="Amelia" required autoComplete="given-name" />
          </div>
          <div className="field">
            <label className="lab" htmlFor="su-last">Last name</label>
            <input id="su-last" className="input" name="last_name" type="text" placeholder="Khan" required autoComplete="family-name" />
          </div>
        </div>
        <div className="field">
          <label className="lab" htmlFor="su-email">Work email</label>
          <input id="su-email" className="input" name="email" type="email" placeholder="operator@company.co.uk" required autoComplete="email" />
        </div>
        <div className="row-fields">
          <div className="field">
            <label className="lab" htmlFor="su-company">Company</label>
            <input id="su-company" className="input" name="company" type="text" placeholder="Truehold Ltd" required autoComplete="organization" />
          </div>
          <div className="field">
            <label className="lab" htmlFor="su-portfolio">Portfolio size</label>
            <select id="su-portfolio" className="input" name="portfolio_size" required defaultValue="">
              <option value="" disabled>Select…</option>
              <option>Under 10 rooms</option>
              <option>10–49 rooms</option>
              <option>50–99 rooms</option>
              <option>100–200 rooms</option>
              <option>200+ rooms</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label className="lab" htmlFor="su-goal">What are you hoping to solve?</label>
          <textarea
            id="su-goal"
            className="input"
            name="goal"
            rows={3}
            placeholder="E.g. margin leakage across a 60-room HMO portfolio, fragmented maintenance tracking…"
          />
        </div>
        <label className="check">
          <input type="checkbox" name="terms" required />
          <span className="box"><CheckIcon /></span>
          <span>
            I agree to Harbor Ops&apos; <a href="#">Terms</a> and <a href="#">Privacy Policy</a>.
          </span>
        </label>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Submitting…" : "Request a demo →"}
        </button>
        <div className="meta-row">
          <span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>{" "}
            48-hour reply
          </span>
          <span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>{" "}
            No credit card
          </span>
          <span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>{" "}
            Reviewed by a human
          </span>
        </div>
      </form>
    </AuthShell>
  );
}
