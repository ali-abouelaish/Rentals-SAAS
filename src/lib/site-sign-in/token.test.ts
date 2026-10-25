// Website sign-in tokens for Useful Resources links.
//
//   npm test
//
// Agency websites verify these with their own code (the WordPress and Node
// snippets in siteSignInSnippets.ts), so any drift from plain RFC 7519 HS256,
// or from the claims docs/website-sign-in.md promises, locks every agency's
// team out of their site at once.

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";

import { deriveSiteSecret, signHs256Jwt, signSiteSignInToken } from "./token.ts";

process.env.QUICK_LINK_SSO_SECRET = "a".repeat(64);

const LINK = "11111111-1111-4111-8111-111111111111";
const KEY = "22222222-2222-4222-8222-222222222222";

function decode(part: string) {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}

function mint() {
  return signSiteSignInToken({
    linkId: LINK,
    keyId: KEY,
    callbackUrl: "https://www.agency.co.uk/wp-admin/admin-post.php?action=harbor_sign_in",
    returnTo: "https://www.agency.co.uk/staff",
    user: {
      id: "8f14e45f-ceea-467f-a8f8-123456789abc",
      email: "Jane@Agency.co.uk",
      name: "Jane Smith",
      role: "agent",
      isAdmin: false,
      tenantId: "b5b00020-0000-4000-8000-000000000000",
    },
  });
}

describe("signHs256Jwt", () => {
  it("matches the standard jwt.io HS256 example", () => {
    const token = signHs256Jwt({ sub: "1234567890", name: "John Doe", iat: 1516239022 }, "your-256-bit-secret");
    assert.equal(
      token,
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
    );
  });
});

describe("deriveSiteSecret", () => {
  it("is stable, so admins can show it again", () => {
    assert.equal(deriveSiteSecret(LINK, KEY), deriveSiteSecret(LINK, KEY));
    assert.match(deriveSiteSecret(LINK, KEY), /^hos_[A-Za-z0-9_-]{43}$/);
  });

  it("changes with a new key id (Replace secret) and differs per link", () => {
    const original = deriveSiteSecret(LINK, KEY);
    assert.notEqual(deriveSiteSecret(LINK, "33333333-3333-4333-8333-333333333333"), original);
    assert.notEqual(deriveSiteSecret("44444444-4444-4444-8444-444444444444", KEY), original);
  });

  it("refuses to run without a 32-byte master key", () => {
    const saved = process.env.QUICK_LINK_SSO_SECRET;
    try {
      process.env.QUICK_LINK_SSO_SECRET = "abcd";
      assert.throws(() => deriveSiteSecret(LINK, KEY), /32-byte/);
      delete process.env.QUICK_LINK_SSO_SECRET;
      assert.throws(() => deriveSiteSecret(LINK, KEY), /not set/);
    } finally {
      process.env.QUICK_LINK_SSO_SECRET = saved;
    }
  });
});

describe("signSiteSignInToken", () => {
  it("is signed with the link's secret exactly as shown to the admin", () => {
    const [header, payload, signature] = mint().split(".");
    const expected = createHmac("sha256", deriveSiteSecret(LINK, KEY)).update(`${header}.${payload}`).digest("base64url");
    assert.equal(signature, expected);
    assert.deepEqual(decode(header), { alg: "HS256", typ: "JWT" });
  });

  it("carries the documented claims", () => {
    const claims = decode(mint().split(".")[1]);
    assert.equal(claims.iss, "harbor-ops");
    assert.equal(claims.aud, "https://www.agency.co.uk");
    assert.equal(claims.sub, "8f14e45f-ceea-467f-a8f8-123456789abc");
    assert.equal(claims.email, "jane@agency.co.uk");
    assert.equal(claims.name, "Jane Smith");
    assert.equal(claims.role, "agent");
    assert.equal(claims.is_admin, false);
    assert.equal(claims.agency_id, "b5b00020-0000-4000-8000-000000000000");
    assert.equal(claims.return_to, "https://www.agency.co.uk/staff");
    assert.equal(claims.exp - claims.iat, 60);
  });

  it("gives every sign-in its own jti, so sites can refuse replays", () => {
    assert.notEqual(decode(mint().split(".")[1]).jti, decode(mint().split(".")[1]).jti);
  });
});
