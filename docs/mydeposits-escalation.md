# MyDeposits / Total Property API — escalation (CreateTenancy 500)

**Status:** the sandbox `POST /rs/api/v1/tenancies` endpoint has returned HTTP 500
(empty body) for every request since 2026-08-21, re-verified 2026-09-15 and again
2026-10-15. It blocks the entire deposit-protection flow (no tenancy → no deposit →
no payment → no certificate). The fault is server-side; our request is valid and
correctly shaped. Below is a copy-paste email for `businessdevelopment@mydeposits.co.uk`
(the only published developer contact).

**Before sending, confirm:** was the 2026-09-15 version ever actually sent? If it was
and they replied, use their reply thread instead of starting a new one.

---

**To:** businessdevelopment@mydeposits.co.uk
**Subject:** Sandbox API fault — POST /rs/api/v1/tenancies returns HTTP 500 for agency 158054 (blocking integration)

Hello,

We're a software integrator building against the Total Property sandbox API and have
hit a server-side fault we cannot work around from our side. We'd be grateful if your
engineering team could pull the server-side exception logs for the requests below.

**Account**
- Agency / account ID: **158054** (HARBOR OPS LTD, agent)
- Acting user (sub): 158858 — ali.abouel3aish@gmail.com
- OAuth client_id: 28PXxeVCDzKGqhogpjn8
- Environment: sandbox (api.sandbox.totalproperty.co.uk)

**The fault**
`POST /totalproperty/rs/api/v1/tenancies` returns **HTTP 500 with an empty response
body** for every request, including the minimal valid body `{"propertyId": 10007064,
"tenancyName": "..."}`. Most recent reproduction: **2026-10-15 ~01:48:00 GMT**
(also 2026-08-21 and 2026-09-15). There is no correlation-id header on the response
(only `date` and `server: Microsoft-IIS/10.0`), so we can only give you timestamps.

**Why we believe this is server-side, not our payload**
On the same bearer token, same account, in the same test run:

| Request | Result |
|---|---|
| Bad bearer token → `POST /tenancies` | 401 (auth middleware runs) |
| `POST /tenancies {}` (empty body) | 400 — `JSON deserialization for type 'HF.RealityStone.Application.Tenancies.CreateTenancy+Request' was missing required properties including: 'propertyId'` (binding + validation run) |
| `POST /tenancies {propertyId: 10007064, tenancyName}` | **500, empty body** |
| `POST /tenancies {propertyId: 99999999}` (property does not exist) | **500** — not 404, so the handler faults *before* it looks up the property |
| `POST /tenancies/name/validate` (same module, same verb) | 200 |
| `POST /tenants/can-be-invited-to-tenancy` | **500** (same signature) |
| All tenancy / deposit / property GETs | 200 |
| `POST /properties/manage-by-agency` (creates a property + invites landlord) | 200 — so writes on this account are not blanket-failing |

The blast radius is exactly two command handlers — **CreateTenancy** and
**CanTenantsBeInvitedToTenancy**. Everything else on the same token works, including
property creation and tenancy-name validation. This looks like an unhandled exception
at handler entry (e.g. a DI-resolution failure or missing sandbox reference data),
raised before any request-specific data access.

**What would unblock us**
1. The server-side stack trace / exception for account 158054 at the timestamps above, so we can see whether it's a data-setup issue on our sandbox account or a platform bug; and/or
2. Confirmation of whether this is sandbox-only — i.e. whether the production CreateTenancy handler is healthy — since we have only ever been able to test in sandbox.

Happy to run any specific request on demand and send you fresh timestamps.

Thank you,
Ali Abouel3aish
Harbor Ops Ltd
