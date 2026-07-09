import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Landmark, ShieldCheck } from "lucide-react";
import { getTdsAgencies } from "@/features/tds/data/connections";
import { TdsConnectionsManager } from "@/features/tds/ui/TdsConnectionsManager";
import { getDpsAgencies } from "@/features/dps/data/connections";
import { DpsConnectionsManager } from "@/features/dps/ui/DpsConnectionsManager";

export default async function AdminDepositSchemesPage() {
  const [tdsAgencies, dpsAgencies] = await Promise.all([getTdsAgencies(), getDpsAgencies()]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Deposit Schemes"
        subtitle="Store each agency's deposit scheme API credentials. Agencies apply to TDS / DPS for their own keys, then you enter them here on their behalf."
      />

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="h-4 w-4 text-brand" />
            <p className="text-sm font-medium text-foreground">TDS Custodial — Agency Credentials</p>
          </div>
          <TdsConnectionsManager agencies={tdsAgencies} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 mb-4">
            <Landmark className="h-4 w-4 text-brand" />
            <p className="text-sm font-medium text-foreground">
              DPS (Deposit Protection Service) — Agency Credentials
            </p>
          </div>
          <DpsConnectionsManager agencies={dpsAgencies} />
        </CardContent>
      </Card>
    </div>
  );
}
