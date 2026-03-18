"use client";

import { useEffect, useCallback, useState, useTransition } from "react";
import { createRentalCodeWithDocuments } from "../actions/rentals";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
  const [isPending, startTransition] = useTransition();
  const [sourcingFiles, setSourcingFiles] = useState<File[]>([]);
  const [paymentFiles, setPaymentFiles] = useState<File[]>([]);
  const [clientIdFiles, setClientIdFiles] = useState<File[]>([]);
  const [nextCode, setNextCode] = useState<string | null>(null);
  const [loadingCode, setLoadingCode] = useState(false);

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
    formData.append("client_id", clientId);

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

    startTransition(async () => {
      try {
        await createRentalCodeWithDocuments(formData);
        toast.success("Rental code created successfully");
        const form = document.getElementById("rental-code-form") as HTMLFormElement;
        form?.reset();
        setSourcingFiles([]);
        setPaymentFiles([]);
        setClientIdFiles([]);
        // Refresh the next code preview
        loadCode();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to create rental code");
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
          required
        />
        <Select
          name="payment_method"
          defaultValue=""
          options={[
            { label: "Select payment method", value: "" },
            { label: "💵 Cash", value: "cash" },
            { label: "💸 Bank transfer", value: "transfer" },
            { label: "💳 Card", value: "card" },
          ]}
        />
        <Input
          name="property_address"
          placeholder="Property address"
        />
        <Input
          name="licensor_name"
          placeholder="Licensor name"
        />
        <div className="md:col-span-2">
          <label className="text-xs text-foreground-secondary mb-1 block">
            Marketing agent (optional)
          </label>
          <Select
            name="marketing_agent_name"
            defaultValue=""
            options={[
              { label: "None", value: "" },
              ...agents.map((agent) => ({
                label: agent.name,
                value: agent.name,
              })),
            ]}
          />
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
        <Button type="submit" disabled={isPending} className="w-full md:w-auto">
          {isPending ? "Creating..." : "Create rental code"}
        </Button>
      </div>
    </form>
  );
}
