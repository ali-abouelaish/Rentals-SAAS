"use client";

// Tenancy agreement e-signature, in the contract drawer's Document tab.
//
// The behaviour lives in the shared SigningPanel; this supplies the actions and
// the wording specific to a tenancy being signed and countersigned.

import { useCallback } from "react";

import { SigningPanel } from "@/components/signing/SigningPanel";

import { getContractSigningState, sendContractForSignature } from "../actions/signing";

type Props = {
  contractId: string;
  /** There is nothing to send until the contract has been generated. */
  hasGeneratedDocument: boolean;
};

export function ContractSigningPanel({ contractId, hasGeneratedDocument }: Props) {
  const loadState = useCallback(() => getContractSigningState(contractId), [contractId]);
  const onSend = useCallback(() => sendContractForSignature(contractId), [contractId]);

  return (
    <SigningPanel
      loadState={loadState}
      onSend={onSend}
      blockedReason={
        hasGeneratedDocument
          ? null
          : "Generate the contract from a template first — there is no document to sign."
      }
      upsellHint="Send this tenancy agreement out for legally binding e-signature — the tenant signs, the landlord countersigns, and the executed copy files itself against the contract."
      sendTooltip="Emails the tenancy agreement to the tenant to sign, then to the landlord to countersign. Each party signs in the boxes placed on your template."
      idleHint="Sends the generated tenancy agreement to the tenant and landlord to sign electronically."
      pendingHint="The tenant signs first, then the landlord countersigns; this updates automatically."
      completedHint="The contract is marked signed, and the executed copy and audit trail are stored against it."
      successMessage="Tenancy agreement sent for signature"
    />
  );
}
