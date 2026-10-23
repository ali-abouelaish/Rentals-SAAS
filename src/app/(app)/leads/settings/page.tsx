import { headers } from "next/headers";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { hasFeature } from "@/lib/entitlements/requireFeature";
import { buildPublicApiBaseUrl } from "@/lib/urls";
import { getGmailConnection, getPlatformConfigs } from "@/features/leads/data/gmail";
import { listWebsiteConnections } from "@/features/leads/data/websiteLeads";
import { GmailConnectionCard } from "@/features/leads/ui/GmailConnectionCard";
import { PlatformConfigsCard } from "@/features/leads/ui/PlatformConfigsCard";
import { WebsiteLeadsCard } from "@/features/leads/ui/WebsiteLeadsCard";
import { SettingsToast } from "./SettingsToast";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function LeadsSettingsPage({
  searchParams,
}: {
  searchParams?: { connected?: string; error?: string };
}) {
  await requireRole([...ADMIN_ROLES]);

  const websiteLeadsOn = await hasFeature("website_leads");
  const [connection, platformConfigs, websiteConnections] = await Promise.all([
    getGmailConnection(),
    getPlatformConfigs(),
    websiteLeadsOn ? listWebsiteConnections() : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <SettingsToast connected={searchParams?.connected} error={searchParams?.error} />

      <div className="flex items-center gap-3">
        <Link
          href="/leads"
          className="inline-flex items-center gap-1.5 text-sm text-foreground-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Leads
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Leads Settings</h1>
        <p className="text-sm text-foreground-muted mt-0.5">
          {websiteLeadsOn
            ? "Gmail connection, portal platforms and connected websites"
            : "Gmail connection and platform configuration"}
        </p>
      </div>

      <div className="space-y-4 max-w-2xl">
        <GmailConnectionCard connection={connection} />
        <PlatformConfigsCard configs={platformConfigs} />
        {websiteLeadsOn && (
          <WebsiteLeadsCard connections={websiteConnections} apiBaseUrl={buildPublicApiBaseUrl(headers())} />
        )}
      </div>
    </div>
  );
}
