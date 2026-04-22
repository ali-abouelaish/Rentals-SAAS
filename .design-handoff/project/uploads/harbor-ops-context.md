# Harbor Ops — AI Landing Page Context

> Use this document as a context block when prompting any AI tool to generate
> copy, components, or sections for the Harbor Ops landing page. Paste the
> whole thing under a `## Context` heading in your prompt.

---

## Product

Harbor Ops is a property management SaaS for London letting agencies and HMO (House in Multiple Occupation) operators. It replaces the fragmented stack of spreadsheets, generic CRMs, SpareRoom tabs, and accounting exports that small-to-mid property operators currently stitch together.

## One-line positioning

The operating system for room-by-room property management in London.

## Problem it solves

Most property software is built for landlords who rent whole flats to one tenant. London's rental market doesn't work that way — a huge share of stock is let room-by-room across HMOs and shared houses, where occupancy, turnover speed, and margin per bedroom determine whether a portfolio is profitable. Existing tools force operators into workarounds: listing each room as a fake "property," tracking margin in Excel, and managing acquisitions in yet another tab.

## Target users

- London-based letting agencies managing 10–200 units
- HMO operators and rent-to-rent businesses
- Property management arms of boutique estate agencies
- Portfolio landlords running multi-tenant arrangements

## Core modules

**Properties & Units (rooms-first)**
Every property breaks down to the individual room. Track occupancy, rent, and condition at the bedroom level, not just the unit level.

**Tenants & Contracts**
Full lifecycle: leads, applications, contracts, renewals, offboarding. Digital signatures, automated renewal reminders, tenant communication history.

**Bookings & Payments**
Rent collection, invoice status, payment reconciliation, arrears tracking. Short-term and long-term let support.

**Profitability**
Real margin tracked per property and per room. Not just revenue — actual profit after bills, management fees, and maintenance.

**Maintenance**
Ticketing, vendor assignment, scheduling, cost tracking. Tied back to profitability so you see the true cost of a unit.

**Acquisitions & Market Insight**
Integrated SpareRoom scraper feeds live market data. An AI break-even calculator tells operators whether a prospective deal clears their return threshold before they view it.

**Dual-workspace architecture**
A rental agency workspace (Truehold) and a property management workspace (Harbor Ops) run in a single codebase with super-admin oversight — so operators who do both don't have to context-switch between tools.

## Technical stack

Next.js, PostgreSQL, Supabase. Web-first, mobile-responsive.

## Differentiators (for "Why Harbor Ops" sections)

1. Rooms-first data model — built for how London actually lets
2. Acquisitions built in — live SpareRoom data plus AI underwriting
3. Margin visibility at property *and* room level
4. Dual-workspace setup for operators who run both an agency and in-house management
5. Built by an active London operator, not a remote product team

## Founder / origin story

Built by an operator managing a live London portfolio across W2, SW8/SW12, SE8/SE16, and E1/E2 postcodes. Harbor Ops started as internal tooling and evolved into a product after repeated requests from other operators facing the same fragmented-stack problem.

## Voice & tone guidance for AI-generated copy

- Direct, operator-to-operator. Not corporate.
- Specific over generic — say "HMO operators in Zone 2" rather than "property professionals."
- Assumes the reader knows the market. Don't over-explain what an HMO is.
- Understated confidence. No "revolutionary," no "game-changing," no "next-generation."
- Numbers and concrete nouns beat adjectives. "Track margin per room" beats "powerful profitability features."

## Do NOT say

- "All-in-one" (overused)
- "Revolutionize" / "transform" / "disrupt"
- "Empower" (especially "empower landlords")
- Anything that implies it replaces a human property manager — it's a tool for operators, not a replacement for them
- "AI-powered" as a headline claim — AI is a feature inside the acquisitions module, not the product's identity

## Sections a landing page should cover

1. Hero — headline + dashboard mockup
2. Problem framing — "built for how London actually lets"
3. Core modules grid (6 modules above)
4. Acquisitions deep-dive (the AI calculator is a compelling differentiator)
5. Profitability deep-dive (margin-per-room is a wedge)
6. Testimonials from operators
7. Pricing or "request access" CTA
8. Footer

## Sample hero options (for reference, not prescriptive)

- Operate your portfolio. Fill your rooms. Grow with clarity.
- Property management, built for London's room-by-room market.
- Run your portfolio, not your spreadsheets.

## Design system

Harbor Ops uses the EstateFlow design system (see `estateflow-design-system.html`). Any AI-generated components should respect:

- Near-monochrome palette, color reserved for status and data
- Geist (sans) + Instrument Serif italic for display accents + Geist Mono for numbers
- Hairline borders over drop shadows
- Eyebrow pills opening each section
- Monospace two-digit indices (01, 02, 03) on major feature blocks
