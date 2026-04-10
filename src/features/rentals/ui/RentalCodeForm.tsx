"use client";

import { useEffect, useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createRentalCodeWithDocuments } from "../actions/rentals";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export function RentalCodeForm({
  clientId,
  agents,
  isAdmin,
  currentUserId
}: {
  clientId: string;
  agents: { id: string; name: string }[];
  isAdmin?: boolean;
  currentUserId?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sourcingFiles, setSourcingFiles] = useState<File[]>([]);
  const [paymentFiles, setPaymentFiles] = useState<File[]>([]);
  const [clientIdFiles, setClientIdFiles] = useState<File[]>([]);
  const [nextCode, setNextCode] = useState<string | null>(null);
  const [loadingCode, setLoadingCode] = useState(false);
  const [marketingAgentIds, setMarketingAgentIds] = useState<string[]>([]);
  const [fee, setFee] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");

  const isComplete =
    fee !== "" && Number(fee) > 0 &&
    paymentMethod !== "" &&
    sourcingFiles.length > 0 &&
    paymentFiles.length > 0 &&
    clientIdFiles.length > 0;

  const loadCode = useCallback(async () => {
    try {
      setLoadingCode(true);
      const res = await fetch("/api/rentals/next-code");
      if (res.ok) {
        const data = await res.json();
        setNextCode(String(data.code ?? ""));
      }
    } catch {
      // ignore preview errors
    } finally {
      setLoadingCode(false);
    }
  }, []);

  useEffect(() => {
    loadCode();
  }, [loadCode]);

  const handleSubmit = async (formData: FormData) => {
    if (!clientId) {
      toast.error("Client is missing. Please go back and select a client.");
      return;
    }
    formData.append("client_id", clientId);

    const feeValue = Number(fee);
    if (!fee || isNaN(feeValue) || feeValue <= 0) {
      toast.error("Please enter a valid consultation fee");
      return;
    }
    if (!paymentMethod) {
      toast.error("Please select a payment method");
      return;
    }
    if (sourcingFiles.length === 0) {
      toast.error("Please upload sourcing agreement documents");
      return;
    }
    if (paymentFiles.length === 0) {
      toast.error("Please upload payment proof documents");
      return;
    }
    if (clientIdFiles.length === 0) {
      toast.error("Please upload client ID documents");
      return;
    }

    sourcingFiles.forEach((file) => formData.append("sourcing_agreement", file));
    paymentFiles.forEach((file) => formData.append("payment_proof", file));
    clientIdFiles.forEach((file) => formData.append("client_id_doc", file));

    // Append marketing agent IDs as individual form fields
    marketingAgentIds.filter(Boolean).forEach((id) => {
      formData.append("marketing_agent_id_list", id);
    });

    startTransition(async () => {
      const result = await createRentalCodeWithDocuments(formData);

      if (result.ok) {
        // Full success — reset form
        toast.success("Rental code created successfully");
        const form = document.getElementById("rental-code-form") as HTMLFormElement;
        form?.reset();
        setSourcingFiles([]);
        setPaymentFiles([]);
        setClientIdFiles([]);
        setMarketingAgentIds([]);
        setFee("");
        setPaymentMethod("");
        router.refresh();
        loadCode();
      } else if (result.partial) {
        // Rental was created but document upload failed — don't reset,
        // guide the user to the rental page to re-upload documents.
        toast.error(
          `Rental ${result.rentalCode?.code} was created but documents failed to upload. Please go to the rental and re-upload your documents.`,
          { duration: 10000 }
        );
      } else {
        // Pre-insert failure — form state is preserved so the user can
        // fix the issue and retry without re-entering everything.
        toast.error(
          `${result.error ?? "Something went wrong"}. Your entries have been kept — please review and try again.`,
          { duration: 8000 }
        );
      }
    });
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (files: File[]) => void
  ) => {
    const files = Array.from(e.target.files || []);
    setter(files);
  };

  return (
    <form
      id="rental-code-form"
      action={handleSubmit}
      className="space-y-4"
    >
      {nextCode && (
        <>
          <input type="hidden" name="code" value={nextCode} />
          <div className="w-full md:w-[70%] mx-auto rounded-xl border border-border bg-surface-card px-4 py-3 text-sm shadow-sm">
            <span className="block text-center font-semibold tracking-tight text-foreground">
              {loadingCode ? "Client …" : `Client ${nextCode}`}
            </span>
          </div>
        </>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {isAdmin && (
          <div className="md:col-span-2 space-y-1">
            <label className="text-xs text-foreground-secondary mb-1 block">
              Create for agent
            </label>
            <Select
              name="assisted_by_agent_id"
              defaultValue={currentUserId ?? ""}
              options={agents.map((agent) => ({
                label: agent.name,
                value: agent.id,
              }))}
            />
          </div>
        )}
        <Input
          name="consultation_fee_amount"
          placeholder="Consultation fee"
          type="number"
          step="0.01"
          min="0"
          value={fee}
          onChange={(e) => setFee(e.target.value)}
          required
        />
        <Select
          name="payment_method"
          value={paymentMethod}
          onChange={(val: string) => setPaymentMethod(val)}
          required
          options={[
            { label: "Select payment method", value: "" },
            { label: "💵 Cash", value: "cash" },
            { label: "💸 Bank transfer", value: "transfer" },
            { label: "💳 Card", value: "card" },
          ]}
        />
        <div className="md:col-span-2 space-y-2">
          <label className="text-xs text-foreground-secondary block">
            Marketing agents (optional)
          </label>
          {marketingAgentIds.map((agentId, index) => (
            <div key={index} className="flex items-center gap-2">
              <Select
                value={agentId}
                onChange={(val: string) => {
                  const updated = [...marketingAgentIds];
                  updated[index] = val;
                  setMarketingAgentIds(updated);
                }}
                options={[
                  { label: "Select agent", value: "" },
                  ...agents
                    .filter((a) => a.id === agentId || !marketingAgentIds.includes(a.id))
                    .map((a) => ({ label: a.name, value: a.id })),
                ]}
              />
              <button
                type="button"
                onClick={() => setMarketingAgentIds(marketingAgentIds.filter((_, i) => i !== index))}
                className="text-error hover:text-error/80"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {marketingAgentIds.length < 5 && (
            <button
              type="button"
              onClick={() => setMarketingAgentIds([...marketingAgentIds, ""])}
              className="text-xs text-brand hover:underline"
            >
              + Add marketing agent
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-foreground-secondary mb-1 block">
          Notes (optional)
        </label>
        <Textarea
          name="notes"
          placeholder="Add any notes about this rental (visible only to your team)"
          rows={3}
        />
      </div>

      <div className="space-y-4 pt-4 border-t border-border">
        <h3 className="text-sm font-semibold text-foreground mb-3">Required Documents</h3>

        <div>
          <label className="text-xs text-foreground-secondary mb-1 block">
            Sourcing Agreement <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-foreground-muted mb-2">Upload 4 images or 1 PDF</p>
          <input
            type="file"
            accept="image/*,application/pdf"
            multiple
            onChange={(e) => handleFileChange(e, setSourcingFiles)}
            className="w-full rounded-xl border border-border-muted bg-surface-card px-3 py-2 text-sm file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brand file:text-brand-fg file:cursor-pointer hover:file:bg-brand/90"
            required
          />
          {sourcingFiles.length > 0 && (
            <p className="text-xs text-foreground-muted mt-1">
              {sourcingFiles.length} file{sourcingFiles.length !== 1 ? "s" : ""} selected
            </p>
          )}
        </div>

        <div>
          <label className="text-xs text-foreground-secondary mb-1 block">
            Payment Proof <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-foreground-muted mb-2">Upload at least 1 image or PDF</p>
          <input
            type="file"
            accept="image/*,application/pdf"
            multiple
            onChange={(e) => handleFileChange(e, setPaymentFiles)}
            className="w-full rounded-xl border border-border-muted bg-surface-card px-3 py-2 text-sm file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brand file:text-brand-fg file:cursor-pointer hover:file:bg-brand/90"
            required
          />
          {paymentFiles.length > 0 && (
            <p className="text-xs text-foreground-muted mt-1">
              {paymentFiles.length} file{paymentFiles.length !== 1 ? "s" : ""} selected
            </p>
          )}
        </div>

        <div>
          <label className="text-xs text-foreground-secondary mb-1 block">
            Client ID <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-foreground-muted mb-2">Upload at least 1 image or PDF</p>
          <input
            type="file"
            accept="image/*,application/pdf"
            multiple
            onChange={(e) => handleFileChange(e, setClientIdFiles)}
            className="w-full rounded-xl border border-border-muted bg-surface-card px-3 py-2 text-sm file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brand file:text-brand-fg file:cursor-pointer hover:file:bg-brand/90"
            required
          />
          {clientIdFiles.length > 0 && (
            <p className="text-xs text-foreground-muted mt-1">
              {clientIdFiles.length} file{clientIdFiles.length !== 1 ? "s" : ""} selected
            </p>
          )}
        </div>
      </div>

      <div className="pt-4">
        <Button type="submit" disabled={isPending || !isComplete} className="w-full md:w-auto">
          {isPending ? "Creating..." : "Create rental code"}
        </Button>
      </div>
    </form>
  );
}
