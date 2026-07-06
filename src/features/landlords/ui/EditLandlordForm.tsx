"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { updateLandlord } from "@/features/landlords/actions/landlords";
import { toast } from "sonner";
import { LandlordForm } from "./LandlordForm";
import { landlordValuesToFormData } from "./CreateLandlordForm";
import type { LandlordFormValues } from "../domain/schemas";

type Landlord = {
  id: string;
  name: string;
  contact: string | null;
  billing_address: string | null;
  email: string | null;
  spareroom_profile_url: string | null;
  pays_commission: boolean;
  commission_amount_gbp: number | null;
  commission_term_text: string | null;
  we_do_viewing: boolean;
  profile_notes: string | null;
};

export function EditLandlordForm({ landlord }: { landlord: Landlord }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  async function handleSubmit(values: LandlordFormValues) {
    setIsPending(true);
    try {
      const fd = landlordValuesToFormData(values);
      fd.set("landlord_id", landlord.id);
      await updateLandlord(fd);
      toast.success("Changes saved");
      setIsEditing(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-brand">Edit landlord</p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={isEditing ? "ghost" : "secondary"}
            size="sm"
            onClick={() => setIsEditing((prev) => !prev)}
          >
            {isEditing ? "Cancel" : "Edit"}
          </Button>
        </div>
      </div>

      {isEditing && (
        <LandlordForm
          defaultValues={{
            name: landlord.name,
            contact: landlord.contact ?? "",
            billing_address: landlord.billing_address ?? "",
            email: landlord.email ?? "",
            spareroom_profile_url: landlord.spareroom_profile_url ?? "",
            pays_commission: landlord.pays_commission ? "yes" : "no",
            commission_amount_gbp: landlord.commission_amount_gbp ?? 0,
            commission_term_text: landlord.commission_term_text ?? "",
            we_do_viewing: landlord.we_do_viewing ? "yes" : "no",
            profile_notes: landlord.profile_notes ?? "",
          }}
          submitLabel="Save changes"
          pendingLabel="Saving…"
          isPending={isPending}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
