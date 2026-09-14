// Error flattening across the shapes the BoldSign SDK actually throws.
//
//   npm test
//
// Each case here corresponds to a real failure observed against the sandbox,
// not a hypothetical.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { boldSignErrorMessage, extractErrorDetail } from "./errors.ts";

describe("extractErrorDetail", () => {
  it("reads a plain object body", () => {
    assert.equal(extractErrorDetail({ error: "Forbidden" }), "Forbidden");
    assert.equal(extractErrorDetail({ message: "Bad request" }), "Bad request");
  });

  it("decodes a Buffer body from the arraybuffer download endpoints", () => {
    // downloadAuditLog on an in-progress document returns exactly this.
    const body = Buffer.from(JSON.stringify({ error: "Forbidden" }), "utf8");
    assert.equal(extractErrorDetail(body), "Forbidden");
  });

  it("falls back to raw text when a Buffer body isn't JSON", () => {
    assert.equal(extractErrorDetail(Buffer.from("upstream exploded", "utf8")), "upstream exploded");
  });

  it("reads a JSON string body", () => {
    assert.equal(extractErrorDetail('{"error":"Nope"}'), "Nope");
  });

  it("returns null for empty or missing bodies", () => {
    assert.equal(extractErrorDetail(null), null);
    assert.equal(extractErrorDetail(undefined), null);
    assert.equal(extractErrorDetail(""), null);
    assert.equal(extractErrorDetail(Buffer.alloc(0)), null);
    assert.equal(extractErrorDetail({}), null);
    assert.equal(extractErrorDetail(42), null);
  });
});

describe("boldSignErrorMessage", () => {
  it("reads an HttpError-shaped body, as thrown for 401/403", () => {
    const err = { statusCode: 403, body: { error: "Forbidden" } };
    assert.equal(boldSignErrorMessage(err), "403: Forbidden");
  });

  it("decodes a binary HttpError body", () => {
    const err = { statusCode: 403, body: Buffer.from('{"error":"Forbidden"}', "utf8") };
    assert.equal(boldSignErrorMessage(err), "403: Forbidden");
  });

  it("reads response.data on a raw AxiosError, as thrown for 400", () => {
    // The SDK only wraps the status codes each method declares (200/401/403);
    // a 400 rejects with the raw AxiosError, where `body` is absent and the
    // detail is in response.data. Without this branch every validation failure
    // read as "Request failed with status code 400".
    const err = {
      message: "Request failed with status code 400",
      response: {
        status: 400,
        data: {
          error:
            "Your account has reached the limit for the number of brands that can be created.",
        },
      },
    };
    assert.equal(
      boldSignErrorMessage(err),
      "400: Your account has reached the limit for the number of brands that can be created."
    );
  });

  it("still reports the status when no detail can be found", () => {
    assert.equal(
      boldSignErrorMessage({ statusCode: 500, body: undefined }),
      "BoldSign request failed with HTTP 500."
    );
  });

  it("falls back to the message for transport failures with no response", () => {
    assert.equal(boldSignErrorMessage(new Error("getaddrinfo ENOTFOUND")), "getaddrinfo ENOTFOUND");
  });

  it("never returns an empty string", () => {
    for (const input of [null, undefined, {}, new Error("")]) {
      const message = boldSignErrorMessage(input);
      assert.equal(typeof message, "string");
      assert.ok(message.length > 0, `empty message for ${JSON.stringify(input)}`);
    }
  });

  it("does not leak a byte-array dump", () => {
    // The regression this module exists for: err.message on a download failure
    // is a JSON dump of the response bytes, which was landing in process_error.
    const err = {
      statusCode: 403,
      body: Buffer.from('{"error":"Forbidden"}', "utf8"),
      message: JSON.stringify({ type: "Buffer", data: [123, 34, 101] }),
    };
    const message = boldSignErrorMessage(err);
    assert.ok(!message.includes("Buffer"), message);
    assert.ok(!message.includes("123"), message);
  });
});
