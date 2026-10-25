// "Keep me signed in" markers: reading the session id out of the Supabase cookie, and deciding when a
// browser-session-only sign-in has outlived its browser.
//
//   npm test

import assert from "node:assert/strict";
import { describe, it } from "node:test";

// The cookie name is derived from the project URL at import time.
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abcref.supabase.co";
const {
  AUTH_TOKEN_COOKIE,
  SESSION_ALIVE_COOKIE,
  SESSION_ONLY_COOKIE,
  deletionHeaders,
  isSessionOnlyExpired,
  isSessionTokenCookie,
  sessionIdFromAccessToken,
  sessionIdFromCookies,
  sessionPersistenceCookies,
} = await import("./sessionPersistence.ts");

const b64url = (s: string) => Buffer.from(s, "utf-8").toString("base64url");
const jwt = (payload: Record<string, unknown>) =>
  `${b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64url(JSON.stringify(payload))}.sig`;
const session = (sid: string) =>
  JSON.stringify({ access_token: jwt({ sub: "user-1", session_id: sid, exp: 9999999999 }), refresh_token: "r" });

describe("isSessionTokenCookie", () => {
  it("matches the session cookie and its chunks", () => {
    assert.equal(AUTH_TOKEN_COOKIE, "sb-abcref-auth-token");
    assert.equal(isSessionTokenCookie("sb-abcref-auth-token"), true);
    assert.equal(isSessionTokenCookie("sb-abcref-auth-token.0"), true);
    assert.equal(isSessionTokenCookie("sb-abcref-auth-token.12"), true);
  });

  it("never matches the PKCE verifier, which reset and invite links need", () => {
    assert.equal(isSessionTokenCookie("sb-abcref-auth-token-code-verifier"), false);
  });

  it("ignores other projects and other cookies", () => {
    assert.equal(isSessionTokenCookie("sb-other-auth-token"), false);
    assert.equal(isSessionTokenCookie("ho_sess"), false);
    assert.equal(isSessionTokenCookie("sb-abcref-auth-token.x"), false);
  });
});

describe("sessionIdFromCookies", () => {
  it("reads a base64- prefixed cookie", () => {
    const cookies = [{ name: "sb-abcref-auth-token", value: `base64-${b64url(session("s-1"))}` }];
    assert.equal(sessionIdFromCookies(cookies), "s-1");
  });

  it("reads a plain JSON cookie", () => {
    assert.equal(sessionIdFromCookies([{ name: "sb-abcref-auth-token", value: session("s-2") }]), "s-2");
  });

  it("joins chunks in numeric order, whatever order they arrive in", () => {
    const value = `base64-${b64url(session("s-3"))}`;
    const cut = Math.floor(value.length / 2);
    const cookies = [
      { name: "sb-abcref-auth-token.1", value: value.slice(cut) },
      { name: "other", value: "x" },
      { name: "sb-abcref-auth-token.0", value: value.slice(0, cut) },
    ];
    assert.equal(sessionIdFromCookies(cookies), "s-3");
  });

  it("returns null for no cookie or a malformed one", () => {
    assert.equal(sessionIdFromCookies([]), null);
    assert.equal(sessionIdFromCookies([{ name: "sb-abcref-auth-token", value: "base64-%%%" }]), null);
    assert.equal(sessionIdFromCookies([{ name: "sb-abcref-auth-token", value: "{}" }]), null);
  });

  it("reads the claim straight from a token too", () => {
    assert.equal(sessionIdFromAccessToken(jwt({ session_id: "s-4" })), "s-4");
    assert.equal(sessionIdFromAccessToken("not-a-jwt"), null);
    assert.equal(sessionIdFromAccessToken(null), null);
  });
});

describe("isSessionOnlyExpired", () => {
  const auth = (sid: string) => ({ name: "sb-abcref-auth-token", value: session(sid) });

  it("is false without a marker (the default: keep me signed in)", () => {
    assert.equal(isSessionOnlyExpired([auth("s-1")]), false);
  });

  it("is false while the browser-session marker is still there", () => {
    const cookies = [auth("s-1"), { name: SESSION_ONLY_COOKIE, value: "s-1" }, { name: SESSION_ALIVE_COOKIE, value: "s-1" }];
    assert.equal(isSessionOnlyExpired(cookies), false);
  });

  it("is true once the browser has closed and dropped the browser-session marker", () => {
    assert.equal(isSessionOnlyExpired([auth("s-1"), { name: SESSION_ONLY_COOKIE, value: "s-1" }]), true);
  });

  it("is false for a different session, e.g. one opened from a password-reset link", () => {
    assert.equal(isSessionOnlyExpired([auth("s-2"), { name: SESSION_ONLY_COOKIE, value: "s-1" }]), false);
  });

  it("is false when there is no session to end", () => {
    assert.equal(isSessionOnlyExpired([{ name: SESSION_ONLY_COOKIE, value: "s-1" }]), false);
  });
});

describe("sessionPersistenceCookies", () => {
  it("clears both markers when the box is ticked", () => {
    const cookies = sessionPersistenceCookies({ keepSignedIn: true, sessionId: "s-1", domain: ".example.com", secure: true });
    assert.deepEqual(cookies.map((c) => [c.name, c.value, c.options.maxAge]), [
      [SESSION_ONLY_COOKIE, "", 0],
      [SESSION_ALIVE_COOKIE, "", 0],
    ]);
  });

  it("marks the session as browser-session only when unticked", () => {
    const [only, alive] = sessionPersistenceCookies({ keepSignedIn: false, sessionId: "s-1", domain: ".example.com", secure: true });
    assert.equal(only.value, "s-1");
    assert.ok((only.options.maxAge ?? 0) > 0);
    assert.equal(alive.value, "s-1");
    assert.equal(alive.options.maxAge, undefined); // a session cookie
    assert.equal(alive.options.httpOnly, true);
    assert.equal(alive.options.domain, ".example.com");
  });

  it("falls back to keeping the session when its id can't be read", () => {
    const cookies = sessionPersistenceCookies({ keepSignedIn: false, sessionId: null, domain: undefined, secure: false });
    assert.ok(cookies.every((c) => c.options.maxAge === 0));
  });
});

describe("deletionHeaders", () => {
  it("deletes the host-only copy and the shared-domain copy", () => {
    const headers = deletionHeaders("sb-abcref-auth-token", ".example.com", true);
    assert.equal(headers.length, 2);
    assert.ok(headers.every((h) => h.startsWith("sb-abcref-auth-token=; ") && h.includes("Max-Age=0") && h.includes("Secure")));
    assert.ok(!headers[0].includes("Domain="));
    assert.ok(headers[1].includes("Domain=.example.com"));
  });

  it("only the host-only copy off production", () => {
    assert.equal(deletionHeaders("x", undefined, false).length, 1);
  });
});
