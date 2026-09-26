import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireRole, requireUserProfile } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { requireFeature } from "@/lib/entitlements/requireFeature";
import { TrackEntityVisit } from "@/features/search/ui/TrackEntityVisit";
import { getOwnerById } from "@/features/owners/data/owners";
import { formatFeeConfig } from "@/features/owners/domain/types";
import { OwnerDetailTabs } from "@/features/owners/ui/OwnerDetailTabs";
import { OwnerDetailsForm } from "@/features/owners/ui/OwnerDetailsForm";
import { OwnerPropertiesTable } from "@/features/owners/ui/OwnerPropertiesTable";
import { OwnerStatementsPanel } from "@/features/owners/ui/OwnerStatementsPanel";
import { DeleteOwnerButton } from "@/features/owners/ui/OwnerActions";
import { listStatementsForOwner } from "@/features/owner-statements/data/owner-statements";

export default async function OwnerDetailRoute({ params }: { params: { id: string } }) {
  await requireRole([...ADMIN_ROLES]);
  await requireFeature("owner_statements");

  const profile = await requireUserProfile();
  const [detail, statements] = await Promise.all([
    getOwnerById(params.id),
    listStatementsForOwner(params.id),
  ]);
  if (!detail) notFound();

  const { owner, properties } = detail;

  return (
    <div className="space-y-[var(--gap-bento)]">
      <TrackEntityVisit
        tenantId={profile.tenant_id}
        kind="owner"
        id={owner.id}
        title={owner.name}
        subtitle={owner.email ?? owner.phone ?? null}
        href={`/owners/${owner.id}`}
      />

      <Link
        href="/owners"
        className="inline-flex min-h-11 md:min-h-0 items-center gap-1.5 text-sm text-foreground-secondary hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Landlords
      </Link>

      <PageHeader
        title={owner.name}
        subtitle={[
          `${properties.length} propert${properties.length === 1 ? "y" : "ies"}`,
          formatFeeConfig(
            owner.management_fee_type,
            owner.management_fee_percent,
            owner.management_fee_amount
          ),
          owner.email ?? owner.phone ?? null,
        ]
          .filter(Boolean)
          .join(" · ")}
        action={<DeleteOwnerButton ownerId={owner.id} ownerName={owner.name} />}
      />

      <OwnerDetailTabs
        propertyCount={properties.length}
        statementCount={statements.length}
        overview={<OwnerDetailsForm owner={owner} />}
        properties={<OwnerPropertiesTable properties={properties} />}
        statements={
          <OwnerStatementsPanel
            ownerId={owner.id}
            statements={statements}
            propertyCount={properties.length}
          />
        }
      />
    </div>
  );
}
