import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate, formatCurrency } from "@/lib/utils/formatters";
import { getRentalCodeById } from "@/features/rentals/data/rentals";
import { CopyRentalTextButton } from "@/features/rentals/ui/CopyRentalTextButton";
import { DocumentUploadForm } from "@/features/documents/ui/DocumentUploadForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { RentalApprovalPanel } from "@/features/rentals/ui/RentalApprovalPanel";
import { Button } from "@/components/ui/button";
import { deleteRentalCode } from "@/features/rentals/actions/rentals";
import { ConfirmDeleteForm } from "@/components/shared/ConfirmDeleteForm";
import { RentalEditPanel } from "@/features/rentals/ui/RentalEditPanel";
import { RentalDocumentsViewer } from "@/features/rentals/ui/RentalDocumentsViewer";
import { RentalPayoutSummary } from "@/features/rentals/ui/RentalPayoutSummary";

export default async function RentalDetailPage({
  params
}: {
  params: { id: string };
}) {
  const [rental, profile] = await Promise.all([
    getRentalCodeById(params.id),
    requireUserProfile()
  ]);
  const supabase = createSupabaseServerClient();

  const [{ data: documentSets }, { data: assistedAgent }, { data: marketingAgent }, { data: agents }] =
    await Promise.all([
      supabase
        .from("document_sets")
        .select("id, set_type, documents(id, file_name, file_path)")
        .eq("rental_code_id", params.id),
      supabase
        .from("agent_profiles")
        .select("commission_percent")
        .eq("user_id", rental.assisted_by_agent_id)
        .single(),
      supabase
        .from("agent_profiles")
        .select("marketing_fee")
        .eq("user_id", rental.marketing_agent_id)
        .single(),
      supabase
        .from("user_profiles")
        .select("id, display_name")
        .eq("tenant_id", rental.tenant_id)
        .order("display_name", { ascending: true })
    ]);

  const allDocumentPaths =
    documentSets?.flatMap((set) =>
      (set.documents ?? [])
        .map((doc) => doc.file_path)
        .filter((path): path is string => Boolean(path))
    ) ?? [];

  const signedUrlMap = new Map<string, string>();
  if (allDocumentPaths.length > 0) {
    const { data: signedUrls } = await supabase.storage
      .from("rental_docs")
      .createSignedUrls(allDocumentPaths, 60 * 60);
    signedUrls?.forEach((entry, index) => {
      const path = allDocumentPaths[index];
      if (path && entry?.signedUrl) {
        signedUrlMap.set(path, entry.signedUrl);
      }
    });
  }

  const documentSetsForViewer =
    documentSets?.map((set) => ({
      id: set.id,
      set_type: set.set_type,
      documents:
        set.documents?.map((doc) => ({
          id: doc.id,
          file_name: doc.file_name,
          url: doc.file_path ? signedUrlMap.get(doc.file_path) ?? "" : "",
        })) ?? [],
    })) ?? [];

  const marketingAgentName =
    agents?.find((agent) => agent.id === rental.marketing_agent_id)?.display_name ?? "";
  const marketingAgentLabel = marketingAgentName || rental.marketing_agent_id || "—";

  const rentalText = [
    `Code: ${rental.code}`,
    `Date: ${formatDate(rental.date)}`,
    `Fee: ${formatCurrency(rental.consultation_fee_amount)}`,
    `Payment: ${rental.payment_method}`,
    `Property: ${rental.property_address}`,
    `Licensor: ${rental.licensor_name}`,
    "",
    `Client: ${rental.client_snapshot?.full_name}`,
    `Phone: ${rental.client_snapshot?.phone}`,
    rental.client_snapshot?.nationality ? `Nationality: ${rental.client_snapshot.nationality}` : null,
    rental.client_snapshot?.dob ? `DOB: ${rental.client_snapshot.dob}` : null,
    "",
    `Assisted by: ${rental.user_profiles?.display_name ?? rental.assisted_by_agent_id}`,
    rental.marketing_agent_id ? `Marketing agent: ${marketingAgentLabel}` : null
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="space-y-6">
      <PageHeader title={`Rental ${rental.code}`} subtitle="Rental code details" />

      <div className="flex items-center gap-3">
        <StatusBadge status={rental.status} />
        <CopyRentalTextButton text={rentalText} />
        {rental.status === "pending" &&
          (profile.role.toLowerCase() === "admin" ||
            rental.assisted_by_agent_id === profile.id) ? (
          <ConfirmDeleteForm
            action={deleteRentalCode}
            message="Delete this rental? This cannot be undone."
          >
            <input type="hidden" name="rental_id" value={rental.id} />
            <Button type="submit" variant="outline" size="sm">
              Delete
            </Button>
          </ConfirmDeleteForm>
        ) : null}
      </div>

      {profile.role.toLowerCase() === "admin" && rental.status === "pending" ? (
        <Card>
          <CardContent className="space-y-4">
            <p className="text-sm font-medium text-navy">Approval details</p>
            <RentalApprovalPanel
              rentalId={rental.id}
              rentalAmount={rental.consultation_fee_amount}
              paymentMethod={rental.payment_method}
              commissionPercent={assistedAgent?.commission_percent ?? 0}
              marketingFeeDefault={marketingAgent?.marketing_fee ?? 0}
              assistedAgentId={rental.assisted_by_agent_id}
              marketingAgentId={rental.marketing_agent_id}
            />
          </CardContent>
        </Card>
      ) : null}

      {rental.assisted_by_agent_id === profile.id &&
      !(profile.role.toLowerCase() === "admin" && rental.status === "pending") ? (
        <Card>
          <CardContent className="space-y-4">
            <p className="text-sm font-medium text-navy">Your payout summary</p>
            <RentalPayoutSummary
              rentalAmount={rental.consultation_fee_amount}
              paymentMethod={rental.payment_method}
              commissionPercent={assistedAgent?.commission_percent ?? 0}
              marketingFeeDefault={marketingAgent?.marketing_fee ?? 0}
              assistedAgentId={rental.assisted_by_agent_id}
              marketingAgentId={rental.marketing_agent_id}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="space-y-2 text-sm text-foreground-secondary">
          <p className="text-sm font-medium text-navy">Rental template preview</p>
          <div className="space-y-1">
            <p>
              <strong>Code:</strong> {rental.code}
            </p>
            <p>
              <strong>Date:</strong> {formatDate(rental.date)}
            </p>
            <p>
              <strong>Fee:</strong> {formatCurrency(rental.consultation_fee_amount)}
            </p>
            <p>
              <strong>Payment:</strong> {rental.payment_method}
            </p>
            <p>
              <strong>Property:</strong> {rental.property_address}
            </p>
            <p>
              <strong>Licensor:</strong> {rental.licensor_name}
            </p>
            <div className="pt-2">
              <p className="font-medium text-navy">Client info</p>
              <p>{rental.client_snapshot?.full_name}</p>
              <p>{rental.client_snapshot?.phone}</p>
            </div>
            <div className="pt-2">
              <p className="font-medium text-navy">Agents</p>
              <p>Assisted by: {rental.user_profiles?.display_name ?? rental.assisted_by_agent_id}</p>
              <p>Marketing agent: {marketingAgentLabel}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {rental.status === "pending" &&
        (profile.role.toLowerCase() === "admin" ||
          rental.assisted_by_agent_id === profile.id) ? (
        <Card>
          <CardContent className="space-y-3">
            <RentalEditPanel
              rentalId={rental.id}
              clientId={rental.client_id}
              consultationFeeAmount={rental.consultation_fee_amount}
              paymentMethod={rental.payment_method}
              propertyAddress={rental.property_address}
              licensorName={rental.licensor_name}
              marketingAgentName={marketingAgentName}
              agents={agents ?? []}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="space-y-3">
          <p className="text-sm font-medium text-brand">Upload documents</p>
          <DocumentUploadForm rentalCodeId={rental.id} />
          <RentalDocumentsViewer sets={documentSetsForViewer} />
        </CardContent>
      </Card>
    </div>
  );
}
