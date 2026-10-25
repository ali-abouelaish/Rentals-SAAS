// Rate-limit key for the public demo form: the address our proxy saw, not one the client claims.
//
//   npm test

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { requestIp } from "./requestIp.ts";

const headers = (values: Record<string, string>) => ({ get: (name: string) => values[name.toLowerCase()] ?? null });

describe("requestIp", () => {
  it("takes the rightmost public address, ignoring what the client prepended", () => {
    assert.equal(requestIp(headers({ "x-forwarded-for": "1.2.3.4, 81.2.69.160, 127.0.0.1" })), "81.2.69.160");
  });

  it("skips private and loopback hops on the right", () => {
    assert.equal(requestIp(headers({ "x-forwarded-for": "81.2.69.160, 10.0.0.2, 172.20.1.1, ::1" })), "81.2.69.160");
  });

  it("falls back to X-Real-IP when every forwarded hop is private", () => {
    assert.equal(requestIp(headers({ "x-forwarded-for": "127.0.0.1", "x-real-ip": "81.2.69.161" })), "81.2.69.161");
  });

  it("copes with no headers at all", () => {
    assert.equal(requestIp(headers({})), "unknown");
  });

  it("keeps IPv6 public addresses", () => {
    assert.equal(requestIp(headers({ "x-forwarded-for": "2a00:1450:4009:81f::200e, 127.0.0.1" })), "2a00:1450:4009:81f::200e");
  });
});
