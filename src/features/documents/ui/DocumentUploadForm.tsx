"use client";

import { uploadDocuments } from "../actions/documents";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useState } from "react";

export function DocumentUploadForm({ rentalCodeId }: { rentalCodeId: string }) {
  const [setType, setSetType] = useState("sourcing_agreement");

  return (
    <form
      action={async (formData) => {
        await uploadDocuments(formData);
      }}
      className="grid gap-3 md:grid-cols-2"
    >
      <input type="hidden" name="rental_code_id" value={rentalCodeId} />
      <input type="hidden" name="document_set_type" value={setType} />
      <Select
        value={setType}
        onChange={(value: string) => setSetType(value)}
        options={[
          { label: "Sourcing Agreement", value: "sourcing_agreement" },
          { label: "Client ID", value: "client_id" },
          { label: "Payment Proof", value: "payment_proof" }
        ]}
      />
      <input
        className="rounded-xl border border-border-muted bg-surface-card px-3 py-2 text-sm"
        type="file"
        name="files"
        accept="image/*,application/pdf"
        multiple
        required
      />
      <div className="md:col-span-2">
        <Button type="submit">Upload documents</Button>
      </div>
    </form>
  );
}
