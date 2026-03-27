import type { ReactNode } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

interface LayoutProps {
  children: ReactNode;
  params: { slug: string };
}

type TenantRow = {
  name: string;
  branding: { brand_name: string | null; logo_url: string | null } | null;
} | null;

export default async function ApplyLayout({ children, params }: LayoutProps) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("booking_forms")
    .select("tenant:tenants(name, branding:tenant_branding_settings(brand_name, logo_url))")
    .eq("public_slug", params.slug)
    .eq("is_active", true)
    .single();

  const tenant = data?.tenant as unknown as TenantRow;
  const brandName = tenant?.branding?.brand_name ?? tenant?.name ?? "Rental Application";
  const logoUrl = tenant?.branding?.logo_url;

  return (
    <div className="min-h-screen bg-surface-page">
      <header className="border-b border-border bg-surface-card">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          {logoUrl && (
            <img src={logoUrl} alt={brandName} className="h-8 w-auto object-contain" />
          )}
          <span className="text-base font-bold text-foreground">{brandName}</span>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
