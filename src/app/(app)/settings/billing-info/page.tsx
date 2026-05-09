import { PageHeader } from "@/components/layout/PageHeader";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantBillingInfo } from "@/features/billing-info/data/queries";
import { BillingInfoForm } from "@/features/billing-info/ui/BillingInfoForm";
import { EmailTestCard } from "@/features/billing-info/ui/EmailTestCard";
import { AgencyContactEmailCard } from "@/features/tenants/ui/AgencyContactEmailCard";
import { normalizeBranding } from "@/lib/email/branding";

export default async function BillingInfoPage() {
  const profile = await requireRole([...ADMIN_ROLES]);
  const info = await getTenantBillingInfo();

  const supabase = createSupabaseServerClient();
  const [{ data: { user } }, { data: tenant }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("tenants")
      .select("branding, contact_email")
      .eq("id", profile.tenant_id)
      .single(),
  ]);

  const defaultEmail = user?.email ?? "";
  const branding = normalizeBranding(tenant?.branding);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing info"
        subtitle="Subscription, payment status and billing contact for your account"
      />
      <AgencyContactEmailCard initialEmail={tenant?.contact_email ?? null} />
      <BillingInfoForm info={info} />
      <EmailTestCard
        defaultEmail={defaultEmail}
        currentReplyTo={branding.reply_to_email}
      />
    </div>
  );
}
