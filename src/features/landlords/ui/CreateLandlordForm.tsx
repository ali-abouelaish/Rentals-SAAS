"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createLandlord } from "@/features/landlords/actions/landlords";
import { LandlordForm } from "./LandlordForm";
import type { LandlordFormValues } from "../domain/schemas";

function toFormData(values: LandlordFormValues): FormData {
  const fd = new FormData();
  fd.set("name", values.name);
  fd.set("contact", values.contact ?? "");
  fd.set("billing_address", values.billing_address ?? "");
  fd.set("email", values.email ?? "");
  fd.set("spareroom_profile_url", values.spareroom_profile_url ?? "");
  fd.set("pays_commission", values.pays_commission);
  fd.set("commission_amount_gbp", String(values.commission_amount_gbp ?? 0));
  fd.set("commission_term_text", values.commission_term_text ?? "");
  fd.set("we_do_viewing", values.we_do_viewing);
  fd.set("profile_notes", values.profile_notes ?? "");
  return fd;
}

function isNextRedirect(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "digest" in e &&
    String((e as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

export function CreateLandlordForm() {
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (values: LandlordFormValues) => {
    setIsPending(true);
    try {
      await createLandlord(toFormData(values));
      // redirect() in the action navigates away
    } catch (e) {
      if (isNextRedirect(e)) throw e;
      toast.error(e instanceof Error ? e.message : "Failed to create landlord");
      setIsPending(false);
    }
  };

  return (
    <LandlordForm
      defaultValues={{
        name: "",
        contact: "",
        billing_address: "",
        email: "",
        spareroom_profile_url: "",
        pays_commission: "yes",
        commission_amount_gbp: 0,
        commission_term_text: "",
        we_do_viewing: "yes",
        profile_notes: "",
      }}
      submitLabel="Create landlord"
      pendingLabel="Creating…"
      isPending={isPending}
      onSubmit={handleSubmit}
    />
  );
}

export { toFormData as landlordValuesToFormData };
