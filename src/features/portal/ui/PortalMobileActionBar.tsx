"use client";

import { useState } from "react";
import { Banknote, Check, Mail, Phone, Wrench } from "lucide-react";

interface Props {
  /** Phone is preferred for the contact action; email is the fallback. */
  agency: { email: string; phone: string | null };
  /** "" in production; "?companySlug=x" on localhost. */
  slugSuffix: string;
  /** Null when there's no active tenancy — the rent action is then hidden. */
  paymentReference: string | null;
}

const ITEM =
  "flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-medium text-foreground-secondary transition-colors active:bg-surface-inset";

/**
 * The three things a renter actually opens the portal to do, kept within thumb
 * reach on a phone. Hidden from md up, where the same actions are already
 * visible inside the cards without scrolling.
 */
export function PortalMobileActionBar({
  agency,
  slugSuffix,
  paymentReference,
}: Props) {
  const [copied, setCopied] = useState(false);

  const contactHref = agency.phone
    ? `tel:${agency.phone.replace(/\s+/g, "")}`
    : `mailto:${agency.email}`;

  /** Jump to the rent card and put the reference on the clipboard in one tap —
   *  the two halves of "I'm about to set up my standing order". */
  async function goToRent() {
    document
      .getElementById("rent")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });

    if (!paymentReference) return;
    try {
      await navigator.clipboard.writeText(paymentReference);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (http / old browser) — the scroll still lands the
      // renter on the card, where the reference is shown in full.
    }
  }

  return (
    <nav
      aria-label="Portal quick actions"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface-card/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-3xl items-stretch gap-1 px-2 py-1.5">
        <a
          href={`/portal/report${slugSuffix}`}
          className={ITEM}
          title="Opens a chat with our maintenance assistant — it can often help you fix the issue right away, or raises a ticket for us if not"
        >
          <Wrench className="h-5 w-5" aria-hidden />
          Report
        </a>

        <a
          href={contactHref}
          className={ITEM}
          title={
            agency.phone
              ? "Call your property manager"
              : "Email your property manager"
          }
        >
          {agency.phone ? (
            <Phone className="h-5 w-5" aria-hidden />
          ) : (
            <Mail className="h-5 w-5" aria-hidden />
          )}
          Contact
        </a>

        {paymentReference ? (
          <button
            type="button"
            onClick={() => void goToRent()}
            className={ITEM}
            title="Jump to your rent card and copy your payment reference"
          >
            {copied ? (
              <Check className="h-5 w-5 text-success" aria-hidden />
            ) : (
              <Banknote className="h-5 w-5" aria-hidden />
            )}
            {copied ? "Copied" : "Rent"}
          </button>
        ) : null}
      </div>
    </nav>
  );
}
