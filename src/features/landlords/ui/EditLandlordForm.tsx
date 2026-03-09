"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { updateLandlord } from "@/features/landlords/actions/landlords";
import { toast } from "sonner";

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

  async function handleSubmit(formData: FormData) {
    setIsPending(true);
    try {
      await updateLandlord(formData);
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
        <Button
          type="button"
          variant={isEditing ? "ghost" : "secondary"}
          size="sm"
          onClick={() => setIsEditing((prev) => !prev)}
        >
          {isEditing ? "Cancel" : "Edit"}
        </Button>
      </div>

      {isEditing && (
        <form action={handleSubmit} className="grid gap-3 md:grid-cols-2">
          <input type="hidden" name="landlord_id" value={landlord.id} />
          <Input name="name" defaultValue={landlord.name} placeholder="Name" required />
          <Input name="contact" defaultValue={landlord.contact ?? ""} placeholder="Contact" />
          <Input
            name="billing_address"
            defaultValue={landlord.billing_address ?? ""}
            placeholder="Billing address"
          />
          <Input name="email" defaultValue={landlord.email ?? ""} placeholder="Email" />
          <Input
            name="spareroom_profile_url"
            defaultValue={landlord.spareroom_profile_url ?? ""}
            placeholder="Spareroom profile URL"
          />
          <div>
            <label className="text-xs text-foreground-secondary">Pays commission</label>
            <select
              name="pays_commission"
              defaultValue={landlord.pays_commission ? "yes" : "no"}
              className="h-10 w-full rounded-xl border border-border-muted bg-surface-card px-3 text-sm shadow-sm"
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          <Input
            name="commission_amount_gbp"
            type="number"
            step="0.01"
            defaultValue={String(landlord.commission_amount_gbp ?? 0)}
            placeholder="Commission amount (£)"
          />
          <Input
            name="commission_term_text"
            defaultValue={landlord.commission_term_text ?? ""}
            placeholder="Commission term text (e.g. 1 week)"
          />
          <div>
            <label className="text-xs text-foreground-secondary">We do viewing</label>
            <select
              name="we_do_viewing"
              defaultValue={landlord.we_do_viewing ? "yes" : "no"}
              className="h-10 w-full rounded-xl border border-border-muted bg-surface-card px-3 text-sm shadow-sm"
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <Textarea
              name="profile_notes"
              defaultValue={landlord.profile_notes ?? ""}
              placeholder="Profile notes"
            />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" variant="secondary" disabled={isPending}>
              {isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
