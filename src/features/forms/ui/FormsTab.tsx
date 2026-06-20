"use client";

import { useState } from "react";
import { Send, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormSendDialog } from "./FormSendDialog";
import type { Form } from "../domain/types";
import type { Unit } from "@/features/properties/domain/types";

interface FormsTabProps {
  unit: Unit;
  forms: Form[];
}

export function FormsTab({ unit, forms }: FormsTabProps) {
  const [sendForm, setSendForm] = useState<Form | null>(null);

  const tenantEmail = unit.pm_tenant?.email ?? unit.resident?.email ?? null;
  const tenantName = unit.pm_tenant?.full_name ?? unit.resident?.full_name ?? "Tenant";

  const clients = tenantEmail
    ? [{ id: "tenant", full_name: tenantName, email: tenantEmail }]
    : [];

  const unitPortfolioId = unit.property?.portfolio_id ?? null;

  const relevantForms = forms
    .filter((f) => f.portfolio_id == null || f.portfolio_id === unitPortfolioId);

  if (relevantForms.length === 0) {
    return (
      <div className="py-10 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 mb-3">
          <ListChecks className="h-6 w-6 text-brand" />
        </div>
        <p className="text-sm font-semibold text-foreground mb-1">No forms available</p>
        <p className="text-xs text-foreground-secondary max-w-[200px] mx-auto">
          Active forms linked to this portfolio (or global forms) will appear here.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {relevantForms.map((form) => (
          <div
            key={form.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-card p-3"
          >
            <div className="min-w-0 flex-1">
              {form.portfolio && (
                <span
                  className="inline-flex items-center rounded-md font-semibold tracking-wide uppercase px-1.5 py-0.5 text-[10px] mb-0.5"
                  style={{
                    backgroundColor: `${form.portfolio.color}22`,
                    color: form.portfolio.color,
                    border: `1px solid ${form.portfolio.color}44`,
                  }}
                >
                  {form.portfolio.name}
                </span>
              )}
              <p className="text-sm font-medium text-foreground truncate">{form.name}</p>
              {form.description && (
                <p className="text-xs text-foreground-muted truncate">{form.description}</p>
              )}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              title={tenantEmail ? `Send to ${tenantName} (${tenantEmail})` : "Send this form via email"}
              onClick={() => setSendForm(form)}
            >
              <Send className="h-3.5 w-3.5 mr-1" />
              Send
            </Button>
          </div>
        ))}
      </div>

      {sendForm && (
        <FormSendDialog
          formId={sendForm.id}
          formName={sendForm.name}
          clients={clients}
          open
          onOpenChange={(open) => {
            if (!open) setSendForm(null);
          }}
        />
      )}
    </>
  );
}
