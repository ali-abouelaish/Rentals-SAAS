// The post-login `next` guard: only paths on our own site survive.
//
//   npm test

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { safeNextPath } from "./safeNext.ts";

describe("safeNextPath", () => {
  it("keeps an ordinary path, with its query and hash", () => {
    assert.equal(safeNextPath("/dashboard"), "/dashboard");
    assert.equal(safeNextPath("/landlords/42?tab=notes#top"), "/landlords/42?tab=notes#top");
    assert.equal(
      safeNextPath("/oauth/consent?authorization_id=abc"),
      "/oauth/consent?authorization_id=abc"
    );
  });

  it("refuses other hosts, however they are spelled", () => {
    assert.equal(safeNextPath("//evil.example"), null);
    assert.equal(safeNextPath("/\\evil.example"), null);
    assert.equal(safeNextPath("https://evil.example/"), null);
    assert.equal(safeNextPath("javascript:alert(1)"), null);
  });

  it("refuses control characters that URL parsers strip", () => {
    // "/%09/evil.example" once decoded: browsers drop the tab and land on //evil.example
    assert.equal(safeNextPath("/\t/evil.example"), null);
    assert.equal(safeNextPath("/\n/evil.example"), null);
    assert.equal(safeNextPath("/ /evil.example"), null);
    assert.equal(safeNextPath("/\u0000x"), null);
  });

  it("leaves a still-encoded escape alone: it stays a path on our host", () => {
    assert.equal(safeNextPath("/%09/evil.example"), "/%09/evil.example");
  });

  it("refuses empty, relative, non-string and oversized values", () => {
    assert.equal(safeNextPath(""), null);
    assert.equal(safeNextPath("dashboard"), null);
    assert.equal(safeNextPath(undefined), null);
    assert.equal(safeNextPath(null), null);
    assert.equal(safeNextPath(42), null);
    assert.equal(safeNextPath(`/${"a".repeat(3000)}`), null);
  });

  it("normalises dot segments without leaving the site", () => {
    assert.equal(safeNextPath("/a/../b"), "/b");
    assert.equal(safeNextPath("/../../etc"), "/etc");
  });
});
