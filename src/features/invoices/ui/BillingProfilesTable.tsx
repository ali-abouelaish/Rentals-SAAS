"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BillingProfile } from "@/features/invoices/domain/types";

type UpdateAction = (
  prevState: { ok?: boolean; error?: string },
  formData: FormData
) => Promise<{ ok?: boolean; error?: string }>;

export function BillingProfilesTable({
  profiles,
  isAdmin,
  onUpdate,
  onDelete,
}: {
  profiles: BillingProfile[];
  isAdmin: boolean;
  onUpdate: UpdateAction;
  onDelete: (id: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="divide-y divide-border">
      {profiles.map((profile) => (
        <div key={profile.id} className="py-4 first:pt-0 last:pb-0">
          {/* Profile summary row */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{profile.name}</p>
              <p className="text-xs text-foreground-secondary truncate">{profile.sender_company_name}</p>
              <p className="text-xs text-foreground-muted mt-0.5">Net {profile.default_payment_terms_days} days</p>
            </div>
            {isAdmin ? (
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setEditingId((prev) => (prev === profile.id ? null : profile.id))
                  }
                >
                  {editingId === profile.id ? "Close" : "Edit"}
                </Button>
                <form action={onDelete.bind(null, profile.id)}>
                  <Button type="submit" variant="outline" size="sm">
                    Delete
                  </Button>
                </form>
              </div>
            ) : (
              <span className="text-xs text-foreground-muted shrink-0">Read only</span>
            )}
          </div>

          {/* Inline edit form */}
          {isAdmin && editingId === profile.id && (
            <div className="mt-3 rounded-xl border border-border-muted p-3">
              <EditProfileForm profile={profile} onUpdate={onUpdate} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function EditProfileForm({
  profile,
  onUpdate,
}: {
  profile: BillingProfile;
  onUpdate: UpdateAction;
}) {
  const [state, formAction] = useFormState(onUpdate, {});

  useEffect(() => {
    if (state?.ok) toast.success("Profile saved.");
    else if (state?.error) toast.error(state.error);
  }, [state?.ok, state?.error]);

  return (
    <form action={formAction} encType="multipart/form-data" className="grid gap-2 sm:grid-cols-2">
      <input type="hidden" name="billing_profile_id" value={profile.id} />
      <div>
        <label className="block text-xs text-foreground-muted mb-1">Profile name</label>
        <Input name="name" defaultValue={profile.name} placeholder="Profile name" required />
      </div>
      <div>
        <label className="block text-xs text-foreground-muted mb-1">Company name</label>
        <Input name="sender_company_name" defaultValue={profile.sender_company_name} placeholder="Company name" required />
      </div>
      <div>
        <label className="block text-xs text-foreground-muted mb-1">Sender address</label>
        <Input name="sender_address" defaultValue={profile.sender_address ?? ""} placeholder="Sender address" />
      </div>
      <div>
        <label className="block text-xs text-foreground-muted mb-1">Sender email</label>
        <Input name="sender_email" defaultValue={profile.sender_email ?? ""} placeholder="Sender email" />
      </div>
      <div>
        <label className="block text-xs text-foreground-muted mb-1">Sender phone</label>
        <Input name="sender_phone" defaultValue={profile.sender_phone ?? ""} placeholder="Sender phone" />
      </div>
      <div>
        <label className="block text-xs text-foreground-muted mb-1">Account holder</label>
        <Input name="bank_account_holder_name" defaultValue={profile.bank_account_holder_name} placeholder="Account holder" required />
      </div>
      <div>
        <label className="block text-xs text-foreground-muted mb-1">Account number</label>
        <Input name="bank_account_number" defaultValue={profile.bank_account_number} placeholder="Account number" required />
      </div>
      <div>
        <label className="block text-xs text-foreground-muted mb-1">Sort code</label>
        <Input name="bank_sort_code" defaultValue={profile.bank_sort_code} placeholder="Sort code" required />
      </div>
      <div>
        <label className="block text-xs text-foreground-muted mb-1">Payment terms (days)</label>
        <Input name="default_payment_terms_days" defaultValue={profile.default_payment_terms_days} placeholder="7" />
      </div>
      <div>
        <label className="block text-xs text-foreground-muted mb-1">Footer text</label>
        <Input name="footer_thank_you_text" defaultValue={profile.footer_thank_you_text} placeholder="Footer text" />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-xs text-foreground-muted mb-1">
          Logo {profile.logo_url ? "(replace existing)" : "(optional)"}
        </label>
        <Input type="file" name="logo" accept="image/*" />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" variant="secondary" size="sm">
          Save changes
        </Button>
      </div>
    </form>
  );
}
