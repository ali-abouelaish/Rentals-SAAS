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
import { deleteRentalCode, updateRentalStatus } from "@/features/rentals/actions/rentals";
import { ConfirmDeleteForm } from "@/components/shared/ConfirmDeleteForm";
import { RentalEditPanel } from "@/features/rentals/ui/RentalEditPanel";
import { RentalDocumentsViewer } from "@/features/rentals/ui/RentalDocumentsViewer";
import { RentalPayoutSummary } from "@/features/rentals/ui/RentalPayoutSummary";
import { RentalStatusSelect } from "@/features/rentals/ui/RentalStatusSelect";
import { DollarSign } from "lucide-react";

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

  // Build rental text in the requested format for clipboard
  const paymentText =
    rental.payment_method === "cash"
      ? "Cash 💵"
      : rental.payment_method === "transfer"
      ? "Transfer 💸"
      : rental.payment_method === "card"
      ? "Card 💳"
      : rental.payment_method;

  const client = rental.clients as { full_name?: string; phone?: string; nationality?: string | null; dob?: string | null; occupation?: string | null; company_or_university_name?: string | null } | null;
  const clientFullName = client?.full_name ?? "";
  const clientPhone = client?.phone ?? "";
  const clientNationality = client?.nationality ?? null;
  const clientDob = client?.dob ?? null;
  const clientOccupation = client?.occupation ?? null;

  // Age from DOB if available
  let ageText: string | null = null;
  if (clientDob) {
    const dobDate = new Date(clientDob);
    if (!Number.isNaN(dobDate.getTime())) {
      const today = new Date();
      let age = today.getFullYear() - dobDate.getFullYear();
      const m = today.getMonth() - dobDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) {
        age--;
      }
      ageText = `Age: ${age}`;
    }
  }

  const formattedDate = (() => {
    const d = new Date(rental.date);
    if (Number.isNaN(d.getTime())) return formatDate(rental.date);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  })();

  const rentalTextLines: string[] = [
    "Client Code",
    "",
    rental.code,
    "",
    `Date: ${formattedDate}`,
    `Consultation Fee: ${formatCurrency(rental.consultation_fee_amount)}`,
    `Payment: ${paymentText}`,
    "___________",
    "",
    "Client Information",
    "",
    clientFullName ? `Full Name: ${clientFullName}` : "",
    clientPhone ? `Phone Number: ${clientPhone}` : "",
    ageText ?? "",
    clientNationality ? `Nationality: ${clientNationality}` : "",
    clientOccupation ? `Position/Role: ${clientOccupation}` : "",
    "____________",
    "",
    `Assisted by: ${rental.user_profiles?.display_name ?? rental.assisted_by_agent_id}`,
    rental.marketing_agent_id ? `Marketing Agent: ${marketingAgentLabel}` : ""
  ];

  const rentalText = rentalTextLines.filter((line) => line !== "").join("\n");

  return (
    <div className="space-y-6">
      <PageHeader title={`Rental ${rental.code}`} subtitle="Rental code details" />

      <div className="flex items-center gap-3">
        <StatusBadge status={rental.status} />
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

        {/* Admin status shortcuts (same behavior as list view) */}
        {profile.role.toLowerCase() === "admin" && rental.status === "approved" && (
          <form
            action={async (formData) => {
              "use server";
              await updateRentalStatus(formData);
            }}
          >
            <input type="hidden" name="rental_id" value={rental.id} />
            <input type="hidden" name="status" value="paid" />
            <Button type="submit" variant="success" size="sm">
              <DollarSign className="h-3 w-3 mr-1" />
              Mark as paid
            </Button>
          </form>
        )}
        {profile.role.toLowerCase() === "admin" && rental.status === "paid" && (
          <form
            action={async (formData) => {
              "use server";
              await updateRentalStatus(formData);
            }}
          >
            <input type="hidden" name="rental_id" value={rental.id} />
            <input type="hidden" name="status" value="refunded" />
            <Button type="submit" variant="outline" size="sm">
              Refund
            </Button>
          </form>
        )}
      </div>

      {profile.role.toLowerCase() === "admin" && (
        <Card>
          <CardContent className="space-y-3">
            <p className="text-sm font-medium text-navy">Admin controls</p>
            <RentalStatusSelect rentalId={rental.id} currentStatus={rental.status} />
          </CardContent>
        </Card>
      )}

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

      {(profile.role.toLowerCase() === "admin" || rental.assisted_by_agent_id === profile.id) && (
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
      )}

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
            <p className="font-semibold">Client Code</p>
            <p>{rental.code}</p>
            <p>
              <strong>Date:</strong> {formattedDate}
            </p>
            <p>
              <strong>Consultation Fee:</strong> {formatCurrency(rental.consultation_fee_amount)}
            </p>
            <p>
              <strong>Payment:</strong> {paymentText}
            </p>
            <p>___________</p>
            <div className="pt-2 space-y-1">
              <p className="font-semibold">Client Information</p>
              <p>
                <strong>Full Name:</strong> {clientFullName}
              </p>
              <p>
                <strong>Phone Number:</strong> {clientPhone}
              </p>
              {ageText && (
                <p>
                  <strong>Age:</strong> {ageText.replace("Age: ", "")}
                </p>
              )}
              {clientNationality && (
                <p>
                  <strong>Nationality:</strong> {clientNationality}
                </p>
              )}
              {clientOccupation && (
                <p>
                  <strong>Position/Role:</strong> {clientOccupation}
                </p>
              )}
              <p>____________</p>
            </div>
            <div className="pt-2 space-y-1">
              <p>
                <strong>Assisted by:</strong>{" "}
                {rental.user_profiles?.display_name ?? rental.assisted_by_agent_id}
              </p>
              <p>
                <strong>Marketing Agent:</strong> {marketingAgentLabel}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <CopyRentalTextButton text={rentalText} label="Copy Rental Details" />
      </div>

      <Card>
        <CardContent className="space-y-3">
          <p className="text-sm font-medium text-brand">Documents</p>
          <RentalDocumentsViewer sets={documentSetsForViewer} />
          <DocumentUploadForm rentalCodeId={rental.id} />
        </CardContent>
      </Card>
    </div>
  );
}
