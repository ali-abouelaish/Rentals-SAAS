"use client";

// Works order e-signature, in the drawer's Overview tab.
//
// The behaviour lives in the shared SigningPanel; this supplies the actions and
// the wording specific to a contractor accepting a works order.

import { useCallback } from "react";

import { SigningPanel } from "@/components/signing/SigningPanel";

import { getWorksOrderSigningState, sendWorksOrderForSignature } from "../actions/signing";

type Props = {
  jobId: string;
  /** The send needs a contractor with an email; without one it is blocked. */
  hasContractorEmail: boolean;
};

export function WorksOrderSigningPanel({ jobId, hasContractorEmail }: Props) {
  const loadState = useCallback(() => getWorksOrderSigningState(jobId), [jobId]);
  const onSend = useCallback(() => sendWorksOrderForSignature(jobId), [jobId]);

  return (
    <SigningPanel
      loadState={loadState}
      onSend={onSend}
      blockedReason={
        hasContractorEmail
          ? null
          : "Assign a supplier with an email address before sending for signature."
      }
      upsellHint="Send works orders to contractors for e-signature, so acceptance of the work and the costs is on record before anyone starts."
      sendTooltip="Emails the assigned contractor a copy to sign. They accept the work and the costs shown on the works order."
      idleHint="Sends the works order to the assigned contractor to accept by e-signature."
      pendingHint="The contractor signs by email; this updates automatically."
      completedHint="The signed copy and audit trail are stored against this works order."
      successMessage="Works order sent for signature"
    />
  );
}
