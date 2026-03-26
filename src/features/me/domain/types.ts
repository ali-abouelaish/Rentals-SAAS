export type PublicCardData = {
  agentId: string;
  displayName: string;
  role: string;
  avatarUrl: string | null;
  phone: string | null;
  contactEmail: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  linkedinUrl: string | null;
  tenantId: string;
  branding: {
    brandName: string | null;
    logoUrl: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
  };
};
