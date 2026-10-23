// What may and may not leave the process in a Sentry event.
//
//   npm test

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { scrubBreadcrumb, scrubEvent, scrubString, scrubUrl } from "./scrub.ts";

const UUID = "3f2b8c1e-9a4d-4e7b-8c2a-1d5e6f7a8b9c";
const HEX_SECRET = "a3f1c9e07b2d4f6a8c0e1b3d5f7a9c2e4b6d8f0a1c3e5b7d9f2a4c6e8b0d2f4a";
const JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.abc_DEF-123";

describe("scrubString", () => {
  it("replaces emails, JWTs and long secrets", () => {
    assert.equal(
      scrubString(`send to jo.bloggs+x@example.co.uk failed: ${JWT} ${HEX_SECRET}`),
      "send to [email] failed: [jwt] [secret]"
    );
  });

  it("keeps UUIDs, which are ids rather than secrets", () => {
    assert.equal(scrubString(`tenant ${UUID} missing`), `tenant ${UUID} missing`);
  });

  it("keeps long identifiers that contain no digits", () => {
    const name = "createRentalCodeWithLandlordAndAgentLookup";
    assert.equal(scrubString(name), name);
  });
});

describe("scrubUrl", () => {
  it("filters sensitive query params and keeps the rest", () => {
    assert.equal(
      scrubUrl("https://acme.harborops.co.uk/portal/login?token=abc123&next=%2Fportal"),
      "https://acme.harborops.co.uk/portal/login?token=[Filtered]&next=/portal"
    );
  });

  it("filters tokens in the fragment (Supabase recovery links)", () => {
    assert.equal(
      scrubUrl("/reset-password#access_token=xyz&refresh_token=abc&type=recovery"),
      "/reset-password#access_token=[Filtered]&refresh_token=[Filtered]&type=recovery"
    );
  });

  it("filters bearer tokens in share, form and preference paths", () => {
    assert.equal(scrubUrl("/s/Zx81kq-Ab_09/units"), "/s/[Filtered]/units");
    assert.equal(scrubUrl("https://h.example/f/abc123"), "https://h.example/f/[Filtered]");
    assert.equal(scrubUrl("/preferences/tok.sig"), "/preferences/[Filtered]");
    assert.equal(scrubUrl("/api/shares/tok/track"), "/api/shares/[Filtered]/track");
  });

  it("scrubs emails in encoded query values", () => {
    assert.equal(scrubUrl("/leads?q=jo%40example.com"), "/leads?q=[email]");
  });
});

describe("scrubEvent", () => {
  it("drops Next's redirect and not-found control flow", () => {
    assert.equal(scrubEvent({}, { originalException: { digest: "NEXT_REDIRECT;replace;/login;307;" } }), null);
    assert.equal(scrubEvent({}, { originalException: { digest: "NEXT_NOT_FOUND" } }), null);
  });

  it("tags the digest users see as the error page Reference", () => {
    const event = scrubEvent({ tags: { runtime: "node" } }, { originalException: { digest: "2876543210" } });
    assert.deepEqual(event?.tags, { runtime: "node", digest: "2876543210" });
  });

  it("drops request bodies, cookies and every header but the user agent", () => {
    const event = scrubEvent({
      request: {
        url: "https://acme.harborops.co.uk/leads?email=jo@example.com",
        data: { name: "Jo Bloggs", passport: "123456789" },
        cookies: { "sb-access-token": JWT },
        headers: { "user-agent": "Mozilla/5.0", cookie: "sb=1", "x-forwarded-for": "1.2.3.4" },
      },
    });
    assert.deepEqual(event?.request, {
      url: "https://acme.harborops.co.uk/leads?email=[Filtered]",
      query_string: undefined,
      data: undefined,
      cookies: undefined,
      env: undefined,
      headers: { "user-agent": "Mozilla/5.0" },
    });
  });

  it("scrubs console.error arguments captured into extra", () => {
    const event = scrubEvent({
      extra: {
        arguments: [
          "[email] failed to write error_events row",
          { tenantId: UUID, recipientEmail: "jo@example.com", errMsg: "bounced for jo@example.com" },
        ],
      },
    });
    assert.deepEqual(event?.extra, {
      arguments: [
        "[email] failed to write error_events row",
        { tenantId: UUID, recipientEmail: "[Filtered]", errMsg: "bounced for [email]" },
      ],
    });
  });

  it("scrubs messages and exception values", () => {
    const event = scrubEvent({
      message: "lookup failed for jo@example.com",
      exception: { values: [{ value: `bad token ${JWT}` }] },
    });
    assert.equal(event?.message, "lookup failed for [email]");
    assert.equal(event?.exception.values[0].value, "bad token [jwt]");
  });

  it("reduces the user to an id", () => {
    const event = scrubEvent({ user: { id: UUID, email: "jo@example.com", ip_address: "1.2.3.4" } });
    assert.deepEqual(event?.user, { id: UUID });
  });
});

describe("scrubBreadcrumb", () => {
  it("scrubs fetch URLs and navigation targets", () => {
    const crumb = scrubBreadcrumb({
      category: "fetch",
      data: { method: "GET", url: "/api/portal/login-link?token=abc", status_code: 200 },
    });
    assert.deepEqual(crumb.data, {
      method: "GET",
      url: "/api/portal/login-link?token=[Filtered]",
      status_code: 200,
    });

    const nav = scrubBreadcrumb({ category: "navigation", data: { from: "/dashboard", to: "/s/tok123" } });
    assert.deepEqual(nav.data, { from: "/dashboard", to: "/s/[Filtered]" });
  });
});
