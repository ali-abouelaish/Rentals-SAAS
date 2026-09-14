// Sender-identity status interpretation and brand drift.
//
//   npm test

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  brandIsStale,
  canSendOnBehalfOf,
  senderIdentityState,
} from "./senderIdentityStatus.ts";

describe("senderIdentityState", () => {
  it("recognises an approved identity", () => {
    assert.equal(senderIdentityState("Approved"), "verified");
  });

  it("ignores casing and padding", () => {
    // Observed inconsistently from the API. A padded value falling through to
    // "unknown" would strand a perfectly good identity.
    assert.equal(senderIdentityState("  approved  "), "verified");
    assert.equal(senderIdentityState("APPROVED"), "verified");
  });

  it("treats an absent status as none, not as a failure", () => {
    assert.equal(senderIdentityState(null), "none");
    assert.equal(senderIdentityState(undefined), "none");
    assert.equal(senderIdentityState("   "), "none");
  });

  it("separates pending from declined", () => {
    // Both read as "not verified", but the UI has to say "check your inbox"
    // for one and "you said no" for the other.
    assert.equal(senderIdentityState("Pending"), "pending");
    assert.equal(senderIdentityState("Declined"), "declined");
    assert.equal(senderIdentityState("Revoked"), "declined");
  });

  it("treats an unrecognised status as unusable, not as verified", () => {
    // The whole point. Their vocabulary is undocumented; guessing permissively
    // means passing onBehalfOf for an unapproved identity, which rejects the
    // send outright — a tenancy agreement that silently never goes.
    assert.equal(senderIdentityState("SomethingNew"), "unknown");
    assert.equal(senderIdentityState("partially-approved"), "unknown");
  });
});

describe("canSendOnBehalfOf", () => {
  const verified = {
    sender_identity_email: "lettings@agency.co.uk",
    sender_identity_status: "Approved",
    sender_identity_verified_at: "2026-09-01T10:00:00Z",
  };

  it("allows a fully verified identity", () => {
    assert.equal(canSendOnBehalfOf(verified), true);
  });

  it("refuses when there is no address", () => {
    assert.equal(canSendOnBehalfOf({ ...verified, sender_identity_email: null }), false);
  });

  it("refuses a verified status with no timestamp", () => {
    // Means we never persisted a confirmation of our own.
    assert.equal(
      canSendOnBehalfOf({ ...verified, sender_identity_verified_at: null }),
      false
    );
  });

  it("refuses a stale timestamp once the status stops saying approved", () => {
    // The case that motivates requiring both: BoldSign revoked the identity,
    // our row still carries the old approval date. Sending on behalf of it
    // fails the entire document rather than merely losing the branding.
    assert.equal(
      canSendOnBehalfOf({ ...verified, sender_identity_status: "Revoked" }),
      false
    );
  });

  it("refuses a pending identity even with an address and a timestamp", () => {
    assert.equal(
      canSendOnBehalfOf({ ...verified, sender_identity_status: "Pending" }),
      false
    );
  });
});

describe("brandIsStale", () => {
  const snapshot = {
    brand_name: "Maple Lettings",
    email_display_name: "Maple Lettings",
    logo_source_url: "https://cdn.example/logo.png",
    primary_color: "#0B3C71",
  };
  const current = {
    displayName: "Maple Lettings",
    logoUrl: "https://cdn.example/logo.png",
    primaryColor: "#0B3C71",
  };

  it("is not stale when nothing changed", () => {
    assert.equal(brandIsStale(snapshot, current), false);
  });

  it("notices a renamed agency", () => {
    assert.equal(brandIsStale(snapshot, { ...current, displayName: "Maple Homes" }), true);
  });

  it("notices a new logo", () => {
    assert.equal(
      brandIsStale(snapshot, { ...current, logoUrl: "https://cdn.example/new.png" }),
      true
    );
  });

  it("notices a colour change", () => {
    assert.equal(brandIsStale(snapshot, { ...current, primaryColor: "#FF0000" }), true);
  });

  it("treats a logo being removed as drift", () => {
    // Not merely cosmetic: BoldSign requires a logo, so a sync attempted in
    // this state will fail and the agency needs telling.
    assert.equal(brandIsStale(snapshot, { ...current, logoUrl: null }), true);
  });

  it("is stale when nothing was ever synced", () => {
    assert.equal(
      brandIsStale(
        {
          brand_name: null,
          email_display_name: null,
          logo_source_url: null,
          primary_color: null,
        },
        current
      ),
      true
    );
  });
});
