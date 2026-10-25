// Email templates for demo requests from the public website (/signup).
// Each generator returns { subject, html, text }, like templates/support.ts.

import { button, callout, esc, facts, harborEmail, label, link, note, paragraph, quote } from "../harbor";

type Email = { subject: string; html: string; text: string };

// ── → the Harbor team ───────────────────────────────────

export type DemoRequestTeamParams = {
  name: string;
  email: string;
  company: string;
  portfolioLabel: string;
  goal: string | null;
  /** From the pricing card's Enterprise "Request a quote". */
  quote: boolean;
  /** The request on /admin/demo-requests, or null when it couldn't be saved. */
  adminUrl: string | null;
};

export function generateDemoRequestTeamEmail(p: DemoRequestTeamParams): Email {
  const kind = p.quote ? "Quote request" : "Demo request";
  const subject = `${kind}: ${p.company} (${p.portfolioLabel})`;
  const meta = [
    `Name: ${p.name}`,
    `Email: ${p.email}`,
    `Company: ${p.company}`,
    `Portfolio: ${p.portfolioLabel}`,
    p.quote ? "Asked for: an Enterprise quote" : "",
  ].filter(Boolean);

  const rows: [string, string | { html: string }][] = [
    ["Name", p.name],
    ["Email", { html: link(`mailto:${p.email}`, p.email) }],
    ["Company", p.company],
    ["Portfolio", p.portfolioLabel],
  ];
  if (p.quote) rows.push(["Asked for", "An Enterprise quote"]);

  const html = harborEmail({
    title: subject,
    preheader: `${p.name} at ${p.company}, ${p.portfolioLabel}.`,
    eyebrow: "From the website",
    headline: [`New ${kind.toLowerCase()}.`, `${p.company}.`],
    html:
      (p.adminUrl
        ? ""
        : callout("This request could not be saved to the database, so this email is the only record of it.", "error")) +
      facts(rows) +
      (p.goal ? label("What they’re hoping to solve") + quote(p.goal) : "") +
      (p.adminUrl ? button(p.adminUrl, "Open in admin") : "") +
      note(`Reply to this email to answer ${esc(p.email)} directly. We told them our team would reply within 48 hours.`),
    footnote: "Sent to the Harbor sales inbox from the demo request form on harborops.co.uk.",
  });
  const text = [
    `New ${kind.toLowerCase()} from the website`,
    p.adminUrl ? "" : "This request could not be saved to the database, so this email is the only record of it.",
    "",
    ...meta,
    p.goal ? `\nWhat they're hoping to solve:\n${p.goal}` : "",
    "",
    p.adminUrl ? `Open: ${p.adminUrl}` : "",
    "We told them our team would reply within 48 hours.",
  ]
    .filter((line, i, all) => line !== "" || all[i - 1] !== "")
    .join("\n");
  return { subject, html, text };
}

// ── → the person who asked ──────────────────────────────────

export type DemoRequestConfirmationParams = {
  /** Validated as letters, spaces, hyphens and apostrophes: nothing in it can be a link. */
  firstName: string;
  quote: boolean;
};

/**
 * Goes to whatever address was typed into the form, so it repeats nothing the person wrote except
 * their first name (validated to be letters only).
 */
export function generateDemoRequestConfirmationEmail(p: DemoRequestConfirmationParams): Email {
  const what = p.quote ? "quote request" : "demo request";
  const subject = `We’ve got your ${what}`;
  const next = p.quote
    ? "Our team reads every request and will reply within 48 hours with a quote for your portfolio."
    : "Our team reads every request and will reply within 48 hours to book your walkthrough.";
  const html = harborEmail({
    title: subject,
    preheader: next,
    headline: [`Thanks, ${p.firstName}.`, `Your ${what} is with us.`],
    html:
      paragraph(esc(next)) +
      paragraph("If anything is urgent in the meantime, just reply to this email.") +
      paragraph("The Harbor Team"),
    footnote: `Sent because this address was used to request a ${p.quote ? "quote" : "demo"} on harborops.co.uk.`,
  });
  const text = [`Hi ${p.firstName},`, "", `Thanks for your ${what}. ${next}`, "", "If anything is urgent in the meantime, just reply to this email.", "", "The Harbor Team"].join("\n");
  return { subject, html, text };
}
