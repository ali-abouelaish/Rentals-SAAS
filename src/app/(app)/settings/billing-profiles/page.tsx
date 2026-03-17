import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { getBillingProfiles } from "@/features/invoices/data/queries";
import {
  createBillingProfile,
  updateBillingProfile,
  deleteBillingProfile,
  uploadBillingLogo
} from "@/features/invoices/actions/billingProfiles";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BillingProfilesTable } from "@/features/invoices/ui/BillingProfilesTable";

export default async function BillingProfilesPage() {
  const profile = await requireRole([...ADMIN_ROLES]);
  const isAdmin = true; // page is admin-only
  const profiles = await getBillingProfiles();

  return (
    <div className="space-y-6">
      <PageHeader title="Billing Profiles" subtitle="Manage invoice billing details" />

      {isAdmin ? (
        <Card>
          <CardContent className="space-y-3">
            <p className="text-sm font-medium text-brand">Create profile</p>
            <form action={createBillingProfile} encType="multipart/form-data" className="grid gap-3 md:grid-cols-2">
              <Input name="name" placeholder="Profile name" required />
              <Input name="sender_company_name" placeholder="Company name" required />
              <Input name="sender_address" placeholder="Sender address" />
              <Input name="sender_email" placeholder="Sender email" />
              <Input name="sender_phone" placeholder="Sender phone" />
              <Input name="bank_account_holder_name" placeholder="Account holder" required />
              <Input name="bank_account_number" placeholder="Account number" required />
              <Input name="bank_sort_code" placeholder="Sort code" required />
              <Input name="default_payment_terms_days" placeholder="Payment terms (net days)" />
              <Input name="footer_thank_you_text" placeholder="Footer text" />
              <div className="md:col-span-2 space-y-1">
                <label className="block text-xs font-medium text-foreground-muted">Logo (optional)</label>
                <Input type="file" name="logo" accept="image/*" />
              </div>
              <div className="md:col-span-2">
                <Button type="submit">Create</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="space-y-4">
          <BillingProfilesTable
            profiles={profiles}
            isAdmin={isAdmin}
            onUpdate={updateBillingProfile}
            onDelete={deleteBillingProfile}
            onUploadLogo={uploadBillingLogo}
          />
        </CardContent>
      </Card>
    </div>
  );
}
