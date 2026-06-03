"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ShieldCheck, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { secureDeposit, type SecureDepositResult } from "../actions/secureDeposit";
import { PaymentInstructions } from "./PaymentInstructions";

type TenantRow = { fullName: string; email: string; phone: string; isLead: boolean };

export function SecureDepositWizard({
  contractId,
  depositPounds,
  defaultTenant,
  triggerLabel = "Secure with mydeposits",
  resume = false,
}: {
  contractId: string;
  depositPounds: number;
  defaultTenant?: { fullName: string; email: string; phone: string } | null;
  triggerLabel?: string;
  resume?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<SecureDepositResult | null>(null);
  const [tenants, setTenants] = useState<TenantRow[]>([
    {
      fullName: defaultTenant?.fullName ?? "",
      email: defaultTenant?.email ?? "",
      phone: defaultTenant?.phone ?? "",
      isLead: true,
    },
  ]);

  const updateTenant = (i: number, patch: Partial<TenantRow>) =>
    setTenants((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const addTenant = () =>
    setTenants((rows) => [...rows, { fullName: "", email: "", phone: "", isLead: false }]);

  const removeTenant = (i: number) =>
    setTenants((rows) => rows.filter((_, idx) => idx !== i));

  const setLead = (i: number) =>
    setTenants((rows) => rows.map((r, idx) => ({ ...r, isLead: idx === i })));

  const onSubmit = () => {
    if (tenants.some((t) => !t.fullName.trim() || !t.email.trim())) {
      toast.error("Every tenant needs a name and email.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await secureDeposit({
          contractId,
          tenants: tenants.map((t) => ({
            fullName: t.fullName.trim(),
            email: t.email.trim(),
            phone: t.phone.trim() || null,
            isLead: t.isLead,
          })),
        });
        setResult(res);
        if (res.warning) toast.warning(res.warning);
        else toast.success("Deposit secured with mydeposits");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to secure deposit");
      }
    });
  };

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <ShieldCheck className="h-3.5 w-3.5" />
        {resume ? "Resume securing" : triggerLabel}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setResult(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Secure deposit with mydeposits</DialogTitle>
            <DialogDescription>
              Deposit amount £{depositPounds.toLocaleString()}. The property, tenancy and deposit are
              created in the scheme; a bank-transfer payment instruction is returned at the end.
            </DialogDescription>
          </DialogHeader>

          {result ? (
            <div className="space-y-4">
              <p className="text-sm text-foreground">
                Status: <span className="font-semibold">{result.status.replace("_", " ")}</span>
              </p>
              <PaymentInstructions instructions={result.paymentInstructions} />
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {resume && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
                  An earlier attempt was interrupted. Re-running resumes from where it stopped — no
                  duplicate scheme entries are created.
                </p>
              )}

              <div className="space-y-3">
                {tenants.map((t, i) => (
                  <div key={i} className="rounded-lg border border-border p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground-muted">
                        Tenant {i + 1}
                      </span>
                      {tenants.length > 1 && (
                        <Button
                          variant="destructive"
                          size="xs"
                          onClick={() => removeTenant(i)}
                          aria-label="Remove tenant"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <div className="space-y-1">
                      <label htmlFor={`md-name-${i}`} className="block text-xs font-medium text-foreground">
                        Full name
                      </label>
                      <Input
                        id={`md-name-${i}`}
                        value={t.fullName}
                        onChange={(e) => updateTenant(i, { fullName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor={`md-email-${i}`} className="block text-xs font-medium text-foreground">
                        Email
                      </label>
                      <Input
                        id={`md-email-${i}`}
                        type="email"
                        value={t.email}
                        onChange={(e) => updateTenant(i, { email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor={`md-phone-${i}`} className="block text-xs font-medium text-foreground">
                        Phone (optional)
                      </label>
                      <Input
                        id={`md-phone-${i}`}
                        value={t.phone}
                        onChange={(e) => updateTenant(i, { phone: e.target.value })}
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-foreground">
                      <input
                        type="radio"
                        name="md-lead"
                        checked={t.isLead}
                        onChange={() => setLead(i)}
                      />
                      Lead tenant
                    </label>
                  </div>
                ))}
              </div>

              <Button variant="outline" size="sm" onClick={addTenant}>
                <Plus className="h-3.5 w-3.5" />
                Add tenant
              </Button>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                  Cancel
                </Button>
                <Button variant="secondary" loading={isPending} onClick={onSubmit}>
                  <ShieldCheck className="h-4 w-4" />
                  Secure deposit
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
