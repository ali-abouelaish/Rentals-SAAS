import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";
import { getTdsAgencies } from "@/features/tds/data/connections";
import { TdsConnectionsManager } from "@/features/tds/ui/TdsConnectionsManager";

export default async function AdminDepositSchemesPage() {
  const agencies = await getTdsAgencies();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Deposit Schemes"
        subtitle="Store each agency's TDS (Tenancy Deposit Scheme) API credentials. Agencies apply to TDS for their own Member ID, Branch ID and API key, then you enter them here on their behalf."
      />

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="h-4 w-4 text-brand" />
            <p className="text-sm font-medium text-foreground">TDS Custodial — Agency Credentials</p>
          </div>
          <TdsConnectionsManager agencies={agencies} />
        </CardContent>
      </Card>
    </div>
  );
}
