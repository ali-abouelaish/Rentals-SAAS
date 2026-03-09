"use client";

import { useTransition, useState } from "react";
import { createRentalCodeWithDocuments } from "../actions/rentals";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { toast } from "sonner";

export function RentalCodeForm({
  clientId,
  agents
}: {
  clientId: string;
  agents: { id: string; name: string }[];
}) {
  const [isPending, startTransition] = useTransition();
  const [sourcingFiles, setSourcingFiles] = useState<File[]>([]);
  const [paymentFiles, setPaymentFiles] = useState<File[]>([]);
  const [clientIdFiles, setClientIdFiles] = useState<File[]>([]);

  const handleSubmit = async (formData: FormData) => {
    formData.append("client_id", clientId);
    
    // Validate files are selected
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
    
    // Add files to formData
    sourcingFiles.forEach((file) => {
      formData.append("sourcing_agreement", file);
    });
    paymentFiles.forEach((file) => {
      formData.append("payment_proof", file);
    });
    clientIdFiles.forEach((file) => {
      formData.append("client_id_doc", file);
    });

    startTransition(async () => {
      try {
        await createRentalCodeWithDocuments(formData);
        toast.success("Rental code created successfully");
        // Reset form
        const form = document.getElementById("rental-code-form") as HTMLFormElement;
        form?.reset();
        setSourcingFiles([]);
        setPaymentFiles([]);
        setClientIdFiles([]);
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
      <div className="grid gap-3 md:grid-cols-2">
        <Input
          name="consultation_fee_amount"
          placeholder="Consultation fee"
          type="number"
          step="0.01"
          required
          defaultValue={0}
        />
        <Select
          name="payment_method"
          defaultValue="cash"
          options={[
            { label: "Cash", value: "cash" },
            { label: "Transfer", value: "transfer" },
            { label: "Card", value: "card" },
          ]}
        />
        <Input
          name="property_address"
          placeholder="Property address"
          required
        />
        <Input
          name="licensor_name"
          placeholder="Licensor name"
          required
        />
        <div className="md:col-span-2">
          <label className="text-xs text-foreground-secondary mb-1 block">
            Marketing agent (optional)
          </label>
          <Input
            name="marketing_agent_name"
            list="marketing-agent-list"
            placeholder="Search by name"
          />
          <datalist id="marketing-agent-list">
            {agents.map((agent) => (
              <option key={agent.id} value={agent.name} />
            ))}
          </datalist>
          <p className="text-xs text-foreground-muted mt-1">
            Leave blank if not applicable.
          </p>
        </div>
      </div>

      {/* Document Uploads */}
      <div className="space-y-4 pt-4 border-t border-border">
        <h3 className="text-sm font-semibold text-foreground mb-3">Required Documents</h3>
        
        {/* Sourcing Agreement */}
        <div>
          <label className="text-xs text-foreground-secondary mb-1 block">
            Sourcing Agreement <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-foreground-muted mb-2">
            Upload 4 images or 1 PDF
          </p>
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

        {/* Payment Proof */}
        <div>
          <label className="text-xs text-foreground-secondary mb-1 block">
            Payment Proof <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-foreground-muted mb-2">
            Upload at least 1 image or PDF
          </p>
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

        {/* Client ID */}
        <div>
          <label className="text-xs text-foreground-secondary mb-1 block">
            Client ID <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-foreground-muted mb-2">
            Upload at least 1 image or PDF
          </p>
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
