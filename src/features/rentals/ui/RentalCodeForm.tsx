"use client";

import { useEffect, useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createRentalCodeWithDocuments } from "../actions/rentals";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const MAX_TOTAL_SIZE_MB = 15;

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
  const [marketingAgentIds, setMarketingAgentIds] = useState<string[]>([""]);
  const [fee, setFee] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const todayIso = new Date().toISOString().slice(0, 10);

  const hasMarketingAgent = marketingAgentIds.some((id) => id !== "");

  const isComplete =
    fee !== "" && Number(fee) > 0 &&
    paymentMethod !== "" &&
    hasMarketingAgent &&
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

  function totalFileSize() {
    const all = [...sourcingFiles, ...paymentFiles, ...clientIdFiles];
    return all.reduce((sum, f) => sum + f.size, 0);
  }

  const handleSubmit = async (formData: FormData) => {
    // ── Client-side validation ──
    if (!clientId) {
      toast.error("Client is missing. Please go back and select a client.");
      return;
    }
    const feeValue = Number(fee);
    if (!fee || isNaN(feeValue) || feeValue <= 0) {
      toast.error("Please enter a valid consultation fee");
      return;
    }
    if (!paymentMethod) {
      toast.error("Please select a payment method");
      return;
    }
    if (!hasMarketingAgent) {
      toast.error("Please select a marketing agent (even if it's you)");
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

    // Check total file size before sending
    const sizeMB = totalFileSize() / (1024 * 1024);
    if (sizeMB > MAX_TOTAL_SIZE_MB) {
      toast.error(
        `Total file size is ${sizeMB.toFixed(1)}MB which exceeds the ${MAX_TOTAL_SIZE_MB}MB limit. Please use smaller or fewer files.`,
        { duration: 8000 }
      );
      return;
    }

    // ── Build FormData ──
    formData.append("client_id", clientId);
    sourcingFiles.forEach((file) => formData.append("sourcing_agreement", file));
    paymentFiles.forEach((file) => formData.append("payment_proof", file));
    clientIdFiles.forEach((file) => formData.append("client_id_doc", file));
    marketingAgentIds.filter(Boolean).forEach((id) => {
      formData.append("marketing_agent_id_list", id);
    });

    // ── Submit ──
    startTransition(async () => {
      let result: { ok: boolean; partial?: boolean; rentalCode?: any; error?: string } | undefined;

      try {
        result = await createRentalCodeWithDocuments(formData);
      } catch {
        // falls through to the !result check below
      }

      // Handle network / proxy failures (413, timeout, etc.)
      if (!result) {
        toast.error(
          "Upload failed — your files may be too large. Please reduce file sizes and try again. Your entries have been kept.",
          { duration: 10000 }
        );
        return;
      }

      if (result.ok) {
        const code = result.rentalCode?.code as string | undefined;
        toast.success(
          code ? `Rental ${code} created successfully` : "Rental code created successfully"
        );
        setCreatedCode(code ?? "");
        const form = document.getElementById("rental-code-form") as HTMLFormElement;
        form?.reset();
        setSourcingFiles([]);
        setPaymentFiles([]);
        setClientIdFiles([]);
        setMarketingAgentIds([""]);
        setFee("");
        setPaymentMethod("");
        router.refresh();
        loadCode();
      } else if (result.partial) {
        toast.error(
          `Rental ${result.rentalCode?.code} was created but documents failed to upload. Please go to the rental and re-upload your documents.`,
          { duration: 10000 }
        );
      } else {
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
      {createdCode !== null && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-xl border border-success/30 bg-success/10 px-4 py-3"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 text-success" strokeWidth={2} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {createdCode
                ? `Rental ${createdCode} created successfully`
                : "Rental created successfully"}
            </p>
            <p className="text-xs text-foreground-muted">
              It now appears in the rental codes list below. You can create another one.
            </p>
          </div>
        </div>
      )}

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
        <div className="md:col-span-2 space-y-1">
          <label className="text-xs text-foreground-secondary mb-1 block">
            Rental date
          </label>
          <Input
            name="date"
            type="date"
            defaultValue={todayIso}
            required
          />
        </div>
        <Input
          name="consultation_fee_amount"
          placeholder="Consultation fee"
          type="number"
          step="0.01"
          min="0"
          value={fee}
          onChange={(e) => {
            setFee(e.target.value);
            if (createdCode !== null) setCreatedCode(null);
          }}
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
            Marketing agents <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-foreground-muted">
            Please select a marketing agent, even if it&apos;s you.
          </p>
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
