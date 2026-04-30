/**
 * Per-agency branding stored on tenants.branding (jsonb).
 * Mirrors the shape documented in the rent-reminders migration.
 */
export type AgencyBranding = {
  logo_url: string | null;
  primary_color: string;
  accent_color: string;
  from_display_name: string;
  reply_to_email: string;
  footer_address: string;
  custom_domain: string | null;
  custom_domain_verified: boolean;
};

export const DEFAULT_BRANDING: AgencyBranding = {
  logo_url: null,
  primary_color: "#0F172A",
  accent_color: "#3B82F6",
  from_display_name: "Harbor Ops",
  reply_to_email: "",
  footer_address: "",
  custom_domain: null,
  custom_domain_verified: false,
};

export function normalizeBranding(raw: unknown): AgencyBranding {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<AgencyBranding>;
  return {
    logo_url: typeof r.logo_url === "string" ? r.logo_url : DEFAULT_BRANDING.logo_url,
    primary_color: typeof r.primary_color === "string" && r.primary_color
      ? r.primary_color
      : DEFAULT_BRANDING.primary_color,
    accent_color: typeof r.accent_color === "string" && r.accent_color
      ? r.accent_color
      : DEFAULT_BRANDING.accent_color,
    from_display_name: typeof r.from_display_name === "string" && r.from_display_name
      ? r.from_display_name
      : DEFAULT_BRANDING.from_display_name,
    reply_to_email: typeof r.reply_to_email === "string"
      ? r.reply_to_email
      : DEFAULT_BRANDING.reply_to_email,
    footer_address: typeof r.footer_address === "string"
      ? r.footer_address
      : DEFAULT_BRANDING.footer_address,
    custom_domain: typeof r.custom_domain === "string" && r.custom_domain
      ? r.custom_domain
      : null,
    custom_domain_verified: r.custom_domain_verified === true,
  };
}

export type Agency = {
  id: string;
  name: string;
  branding: AgencyBranding;
};
