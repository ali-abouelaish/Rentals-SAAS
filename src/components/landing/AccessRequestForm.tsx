"use client";

import { useState, FormEvent } from "react";
import { ThankYouDialog } from "@/components/shared/ThankYouDialog";

export function AccessRequestForm() {
  const [submitted, setSubmitted] = useState(false);
  const [showThanks, setShowThanks] = useState(false);
  const [email, setEmail] = useState("");

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
    setShowThanks(true);
  };

  return (
    <>
      <form onSubmit={onSubmit}>
        <input
          className="input"
          type="email"
          placeholder="operator@company.co.uk"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button className="btn btn-primary btn-lg" type="submit" disabled={submitted}>
          {submitted ? "Request received ✓" : "Request demo"}
        </button>
      </form>

      <ThankYouDialog
        open={showThanks}
        onOpenChange={setShowThanks}
        title="Request received"
        message={
          <>
            Thanks — we&apos;ve got your demo request
            {email ? (
              <>
                {" "}
                for <strong className="text-foreground">{email}</strong>
              </>
            ) : null}
            .
          </>
        }
        footnote="One of the team will be in touch within one working day to arrange a walkthrough."
        actionLabel="Back to the site"
        // The marketing site is monochrome — the tenant accent has no meaning here.
        actionClassName="bg-[#111111] text-white hover:bg-[#2a2a2a]"
        // Keep the modal in the landing's type stack — Radix portals it outside
        // the .harbor-landing tree, so the scoped font never reaches it.
        contentStyle={{ fontFamily: "'Geist', ui-sans-serif, system-ui, sans-serif" }}
      />
    </>
  );
}
