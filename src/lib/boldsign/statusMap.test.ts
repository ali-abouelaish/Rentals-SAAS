// Event -> status mapping and the out-of-order rules.
//
//   npm test

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isTerminal,
  mapEventToStatus,
  planEventApplication,
  shouldApplyStatus,
  TERMINAL_STATUSES,
} from "./statusMap.ts";
import type { BoldSignDocumentStatus } from "./types.ts";

describe("mapEventToStatus", () => {
  it("maps the lifecycle events the integration subscribes to", () => {
    assert.equal(mapEventToStatus("Sent"), "awaiting_signature");
    assert.equal(mapEventToStatus("Signed"), "partially_signed");
    assert.equal(mapEventToStatus("Completed"), "completed");
    assert.equal(mapEventToStatus("Declined"), "declined");
    assert.equal(mapEventToStatus("Expired"), "expired");
    assert.equal(mapEventToStatus("Revoked"), "revoked");
    assert.equal(mapEventToStatus("SendFailed"), "failed");
  });

  it("returns null for events that carry no status change", () => {
    for (const eventType of [
      "Viewed",
      "Reassigned",
      "Reminder",
      "AuthenticationFailed",
      "DeliveryFailed",
      "TemplateCreated",
      "SenderIdentityCreated",
    ]) {
      assert.equal(mapEventToStatus(eventType), null, `${eventType} should not change status`);
    }
  });

  it("returns null for an unrecognised event rather than throwing", () => {
    // BoldSign can add event types; an unknown one must not break the endpoint.
    assert.equal(mapEventToStatus("SomeFutureEvent"), null);
    assert.equal(mapEventToStatus(""), null);
  });
});

describe("isTerminal", () => {
  it("treats the four end states as terminal", () => {
    for (const status of TERMINAL_STATUSES) assert.equal(isTerminal(status), true);
  });

  it("treats in-flight states as non-terminal", () => {
    assert.equal(isTerminal("awaiting_signature"), false);
    assert.equal(isTerminal("partially_signed"), false);
  });

  it("does not treat a failed send as terminal, so it can be retried", () => {
    assert.equal(isTerminal("failed"), false);
  });
});

describe("shouldApplyStatus", () => {
  it("advances through the normal lifecycle", () => {
    assert.equal(shouldApplyStatus("awaiting_signature", "partially_signed"), true);
    assert.equal(shouldApplyStatus("partially_signed", "completed"), true);
    assert.equal(shouldApplyStatus("awaiting_signature", "declined"), true);
    assert.equal(shouldApplyStatus("awaiting_signature", "expired"), true);
  });

  it("refuses to walk a completed document backwards", () => {
    // The case this rule exists for: a delayed 'Signed' arriving after the
    // 'Completed' that followed it would otherwise un-execute an agreement.
    assert.equal(shouldApplyStatus("completed", "partially_signed"), false);
    assert.equal(shouldApplyStatus("completed", "awaiting_signature"), false);
  });

  it("refuses to move between terminal states", () => {
    assert.equal(shouldApplyStatus("declined", "completed"), false);
    assert.equal(shouldApplyStatus("revoked", "expired"), false);
    assert.equal(shouldApplyStatus("expired", "completed"), false);
  });

  it("allows a repeat of the same terminal status", () => {
    // So a redelivered Completed can retry an artefact download that failed the
    // first time.
    for (const status of TERMINAL_STATUSES) {
      assert.equal(shouldApplyStatus(status, status), true, `${status} should be re-appliable`);
    }
  });

  it("allows a failed send to be superseded", () => {
    assert.equal(shouldApplyStatus("failed", "awaiting_signature"), true);
    assert.equal(shouldApplyStatus("failed", "completed"), true);
  });

  it("is exhaustive over the status union", () => {
    // Guards against a status being added to the type without a decision here.
    const all: BoldSignDocumentStatus[] = [
      "awaiting_signature",
      "partially_signed",
      "completed",
      "declined",
      "expired",
      "revoked",
      "failed",
    ];
    for (const from of all) {
      for (const to of all) {
        assert.equal(typeof shouldApplyStatus(from, to), "boolean");
      }
    }
  });
});

describe("planEventApplication", () => {
  const base = { currentStatus: "awaiting_signature" as const, hasSignedPdf: false, hasAuditTrail: false };

  it("does nothing for an event that carries no status", () => {
    assert.deepEqual(planEventApplication({ ...base, eventType: "Viewed" }), {
      action: "no_status_change",
    });
  });

  it("applies a normal advance", () => {
    assert.deepEqual(planEventApplication({ ...base, eventType: "Signed" }), {
      action: "apply",
      status: "partially_signed",
      fetchArtifacts: false,
    });
  });

  it("fetches artefacts on completion", () => {
    assert.deepEqual(planEventApplication({ ...base, eventType: "Completed" }), {
      action: "apply",
      status: "completed",
      fetchArtifacts: true,
    });
  });

  it("skips the download when both artefacts are already stored", () => {
    // A redelivered Completed must not re-download for nothing.
    assert.deepEqual(
      planEventApplication({
        eventType: "Completed",
        currentStatus: "completed",
        hasSignedPdf: true,
        hasAuditTrail: true,
      }),
      { action: "apply", status: "completed", fetchArtifacts: false }
    );
  });

  it("retries the download when only one artefact was stored", () => {
    // The half-finished case: the signed PDF uploaded, the audit trail didn't.
    assert.deepEqual(
      planEventApplication({
        eventType: "Completed",
        currentStatus: "completed",
        hasSignedPdf: true,
        hasAuditTrail: false,
      }),
      { action: "apply", status: "completed", fetchArtifacts: true }
    );
  });

  it("ignores an out-of-order event against a terminal document", () => {
    assert.deepEqual(
      planEventApplication({
        eventType: "Signed",
        currentStatus: "completed",
        hasSignedPdf: true,
        hasAuditTrail: true,
      }),
      { action: "ignore", reason: "terminal" }
    );
  });

  it("never asks for artefacts on a non-completion event", () => {
    for (const eventType of ["Sent", "Signed", "Declined", "Expired", "Revoked", "SendFailed"]) {
      const plan = planEventApplication({ ...base, eventType });
      if (plan.action === "apply") {
        assert.equal(plan.fetchArtifacts, false, `${eventType} should not fetch artefacts`);
      }
    }
  });
});
