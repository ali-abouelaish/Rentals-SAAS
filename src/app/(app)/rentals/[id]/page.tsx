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
import { Input } from "@/components/ui/input";
import { updateRentalCode, deleteRentalCode } from "@/features/rentals/actions/rentals";
import { ConfirmDeleteForm } from "@/components/shared/ConfirmDeleteForm";

export default async function RentalDetailPage({
  params
}: {
  params: { id: string };
}) {
  const rental = await getRentalCodeById(params.id);
  const profile = await requireUserProfile();
  const supabase = createSupabaseServerClient();
  const { data: documentSets } = await supabase
    .from("document_sets")
    .select("id, set_type, documents(id, file_name)")
    .eq("rental_code_id", params.id);

  const { data: assistedAgent } = await supabase
    .from("agent_profiles")
    .select("commission_percent")
    .eq("user_id", rental.assisted_by_agent_id)
    .single();

  const { data: marketingAgent } = await supabase
    .from("agent_profiles")
    .select("marketing_fee")
    .eq("user_id", rental.marketing_agent_id)
    .single();

  const { data: agents } = await supabase
    .from("user_profiles")
    .select("id, display_name")
    .eq("tenant_id", rental.tenant_id)
    .order("display_name", { ascending: true });

  const marketingAgentName =
    agents?.find((agent) => agent.id === rental.marketing_agent_id)?.display_name ?? "";

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
    rental.marketing_agent_id ? `Marketing agent: ${rental.marketing_agent_id}` : null
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
              <p>Marketing agent: {rental.marketing_agent_id ?? "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {rental.status === "pending" &&
        (profile.role.toLowerCase() === "admin" ||
          rental.assisted_by_agent_id === profile.id) ? (
        <Card>
          <CardContent className="space-y-3">
            <p className="text-sm font-medium text-brand">Edit rental</p>
            <form action={updateRentalCode} className="grid gap-3 md:grid-cols-2">
              <input type="hidden" name="rental_id" value={rental.id} />
              <input type="hidden" name="client_id" value={rental.client_id} />
              <Input
                name="consultation_fee_amount"
                type="number"
                step="0.01"
                defaultValue={String(rental.consultation_fee_amount)}
              />
              <select
                name="payment_method"
                defaultValue={rental.payment_method}
                className="h-10 w-full rounded-xl border border-border-muted bg-surface-card px-3 text-sm shadow-sm"
              >
                <option value="cash">Cash</option>
                <option value="transfer">Transfer</option>
                <option value="card">Card</option>
              </select>
              <Input
                name="property_address"
                defaultValue={rental.property_address}
                placeholder="Property address"
              />
              <Input
                name="licensor_name"
                defaultValue={rental.licensor_name}
                placeholder="Licensor name"
              />
              <div className="md:col-span-2">
                <label className="text-xs text-foreground-secondary">Marketing agent (optional)</label>
                <Input
                  list="marketing-agent-edit-list"
                  name="marketing_agent_name"
                  defaultValue={marketingAgentName}
                  placeholder="Search by name"
                />
                <datalist id="marketing-agent-edit-list">
                  {(agents ?? []).map((agent) => (
                    <option key={agent.id} value={agent.display_name ?? "Agent"} />
                  ))}
                </datalist>
              </div>
              <div className="md:col-span-2">
                <Button type="submit" variant="secondary">
                  Save changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="space-y-3">
          <p className="text-sm font-medium text-brand">Upload documents</p>
          <DocumentUploadForm rentalCodeId={rental.id} />
          <div className="space-y-2 text-sm text-foreground-secondary">
            {documentSets?.map((set) => (
              <div key={set.id}>
                <p className="font-medium text-brand">{set.set_type.replace("_", " ")}</p>
                <p>{set.documents?.length ?? 0} documents</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
