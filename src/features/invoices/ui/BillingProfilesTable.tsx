"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BillingProfile } from "@/features/invoices/domain/types";

export function BillingProfilesTable({
  profiles,
  isAdmin,
  onUpdate,
  onDelete,
  onUploadLogo
}: {
  profiles: BillingProfile[];
  isAdmin: boolean;
  onUpdate: (formData: FormData) => void;
  onDelete: (id: string) => void;
  onUploadLogo: (
    prevState: { ok?: boolean; error?: string },
    formData: FormData
  ) => void | Promise<{ ok?: boolean; error?: string }>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Company</TableHead>
          <TableHead>Terms</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {profiles.map((profile) => (
          <TableRow key={profile.id}>
            <TableCell>{profile.name}</TableCell>
            <TableCell>{profile.sender_company_name}</TableCell>
            <TableCell>Net {profile.default_payment_terms_days} days</TableCell>
            <TableCell>
              {isAdmin ? (
                <div className="flex flex-wrap gap-2">
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
                <span className="text-xs text-gray-400">Read only</span>
              )}
              {isAdmin && editingId === profile.id ? (
                <div className="mt-3 space-y-2 rounded-xl border border-muted p-3">
                  <form action={onUpdate} className="grid gap-2 md:grid-cols-2">
                    <input type="hidden" name="billing_profile_id" value={profile.id} />
                    <Input name="name" defaultValue={profile.name} placeholder="Profile name" required />
                    <Input
                      name="sender_company_name"
                      defaultValue={profile.sender_company_name}
                      placeholder="Company name"
                      required
                    />
                    <Input name="sender_address" defaultValue={profile.sender_address ?? ""} placeholder="Sender address" />
                    <Input name="sender_email" defaultValue={profile.sender_email ?? ""} placeholder="Sender email" />
                    <Input name="sender_phone" defaultValue={profile.sender_phone ?? ""} placeholder="Sender phone" />
                    <Input
                      name="bank_account_holder_name"
                      defaultValue={profile.bank_account_holder_name}
                      placeholder="Account holder"
                      required
                    />
                    <Input
                      name="bank_account_number"
                      defaultValue={profile.bank_account_number}
                      placeholder="Account number"
                      required
                    />
                    <Input
                      name="bank_sort_code"
                      defaultValue={profile.bank_sort_code}
                      placeholder="Sort code"
                      required
                    />
                    <Input
                      name="default_payment_terms_days"
                      defaultValue={profile.default_payment_terms_days}
                      placeholder="Payment terms (net days)"
                    />
                    <Input
                      name="footer_thank_you_text"
                      defaultValue={profile.footer_thank_you_text}
                      placeholder="Footer text"
                    />
                    <div className="md:col-span-2">
                      <Button type="submit" variant="secondary" size="sm">
                        Save changes
                      </Button>
                    </div>
                  </form>

                  <LogoUploadForm
                    profileId={profile.id}
                    onUploadLogo={onUploadLogo}
                  />
                </div>
              ) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function SubmitUploadButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      {pending ? "Uploading..." : "Upload logo"}
    </Button>
  );
}

function LogoUploadForm({
  profileId,
  onUploadLogo
}: {
  profileId: string;
  onUploadLogo: (
    prevState: { ok?: boolean; error?: string },
    formData: FormData
  ) => void | Promise<{ ok?: boolean; error?: string }>;
}) {
  const [state, formAction] = useFormState(onUploadLogo, {});

  useEffect(() => {
    if (state?.ok) {
      toast.success("Logo uploaded.");
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state?.ok, state?.error]);

  return (
    <form
      action={formAction}
      encType="multipart/form-data"
      className="flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="billing_profile_id" value={profileId} />
      <input type="file" name="file" accept="image/*" required />
      <SubmitUploadButton />
    </form>
  );
}
