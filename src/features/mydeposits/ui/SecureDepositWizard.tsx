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
import { secureDepositSchema } from "../domain/types";
import { PaymentInstructions } from "./PaymentInstructions";

type TenantRow = { firstName: string; lastName: string; email: string; phone: string; isLead: boolean };
type LandlordRow = { firstName: string; lastName: string; email: string; phone: string };

/** Best-effort split of a stored "Firstname Lastname" into the two fields the scheme requires. */
function splitName(full: string | undefined): { firstName: string; lastName: string } {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

const Hint = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[11px] text-foreground-muted">{children}</p>
);

const FieldError = ({ message }: { message?: string }) =>
  message ? <p className="text-[11px] font-medium text-destructive">{message}</p> : null;

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
      ...splitName(defaultTenant?.fullName),
      email: defaultTenant?.email ?? "",
      phone: defaultTenant?.phone ?? "",
      isLead: true,
    },
  ]);
  const [landlord, setLandlord] = useState<LandlordRow>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateTenant = (i: number, patch: Partial<TenantRow>) =>
    setTenants((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const addTenant = () =>
    setTenants((rows) => [
      ...rows,
      { firstName: "", lastName: "", email: "", phone: "", isLead: false },
    ]);

  const removeTenant = (i: number) =>
    setTenants((rows) => rows.filter((_, idx) => idx !== i));

  const setLead = (i: number) =>
    setTenants((rows) => rows.map((r, idx) => ({ ...r, isLead: idx === i })));

  const onSubmit = () => {
    // Same schema the server action re-validates with — client validation is a
    // convenience, never the authority.
    const candidate = {
      contractId,
      landlord: {
        firstName: landlord.firstName.trim(),
        lastName: landlord.lastName.trim(),
        email: landlord.email.trim(),
        phone: landlord.phone.trim(),
      },
      tenants: tenants.map((t) => ({
        firstName: t.firstName.trim(),
        lastName: t.lastName.trim(),
        email: t.email.trim(),
        phone: t.phone.trim() || null,
        isLead: t.isLead,
      })),
    };
    const check = secureDepositSchema.safeParse(candidate);
    if (!check.success) {
      const next: Record<string, string> = {};
      for (const issue of check.error.issues) {
        const key = issue.path.join(".");
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      toast.error("Check the highlighted fields.");
      return;
    }
    setErrors({});
    startTransition(async () => {
      try {
        const res = await secureDeposit(check.data);
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

              <div className="rounded-lg border border-border p-3 space-y-2.5">
                <span className="text-xs font-semibold text-foreground-muted">Landlord</span>
                <p className="text-[11px] text-foreground-muted">
                  mydeposits creates the property against the landlord and emails them an
                  invitation, so it requires their full details — not just an email.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label htmlFor="md-ll-first" className="block text-xs font-medium text-foreground">
                      First name
                    </label>
                    <Hint>Must match their mydeposits account</Hint>
                    <Input
                      id="md-ll-first"
                      value={landlord.firstName}
                      onChange={(e) => setLandlord((l) => ({ ...l, firstName: e.target.value }))}
                    />
                    <FieldError message={errors["landlord.firstName"]} />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="md-ll-last" className="block text-xs font-medium text-foreground">
                      Last name
                    </label>
                    <Hint>Must match their mydeposits account</Hint>
                    <Input
                      id="md-ll-last"
                      value={landlord.lastName}
                      onChange={(e) => setLandlord((l) => ({ ...l, lastName: e.target.value }))}
                    />
                    <FieldError message={errors["landlord.lastName"]} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label htmlFor="md-ll-email" className="block text-xs font-medium text-foreground">
                    Email
                  </label>
                  <Hint>Where the scheme sends the landlord invitation</Hint>
                  <Input
                    id="md-ll-email"
                    type="email"
                    value={landlord.email}
                    onChange={(e) => setLandlord((l) => ({ ...l, email: e.target.value }))}
                  />
                  <FieldError message={errors["landlord.email"]} />
                </div>
                <div className="space-y-1">
                  <label htmlFor="md-ll-phone" className="block text-xs font-medium text-foreground">
                    Phone
                  </label>
                  <Hint>Required by the scheme. International format, e.g. +447700900123</Hint>
                  <Input
                    id="md-ll-phone"
                    value={landlord.phone}
                    onChange={(e) => setLandlord((l) => ({ ...l, phone: e.target.value }))}
                  />
                  <FieldError message={errors["landlord.phone"]} />
                </div>
              </div>

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
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label htmlFor={`md-first-${i}`} className="block text-xs font-medium text-foreground">
                          First name
                        </label>
                        <Hint>As it appears on the tenancy agreement</Hint>
                        <Input
                          id={`md-first-${i}`}
                          value={t.firstName}
                          onChange={(e) => updateTenant(i, { firstName: e.target.value })}
                        />
                        <FieldError message={errors[`tenants.${i}.firstName`]} />
                      </div>
                      <div className="space-y-1">
                        <label htmlFor={`md-last-${i}`} className="block text-xs font-medium text-foreground">
                          Last name
                        </label>
                        <Hint>mydeposits stores names split, not combined</Hint>
                        <Input
                          id={`md-last-${i}`}
                          value={t.lastName}
                          onChange={(e) => updateTenant(i, { lastName: e.target.value })}
                        />
                        <FieldError message={errors[`tenants.${i}.lastName`]} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label htmlFor={`md-email-${i}`} className="block text-xs font-medium text-foreground">
                        Email
                      </label>
                      <Hint>The scheme emails this address to invite the tenant</Hint>
                      <Input
                        id={`md-email-${i}`}
                        type="email"
                        value={t.email}
                        onChange={(e) => updateTenant(i, { email: e.target.value })}
                      />
                      <FieldError message={errors[`tenants.${i}.email`]} />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor={`md-phone-${i}`} className="block text-xs font-medium text-foreground">
                        Phone (optional)
                      </label>
                      <Hint>International format, e.g. +447700900123</Hint>
                      <Input
                        id={`md-phone-${i}`}
                        value={t.phone}
                        onChange={(e) => updateTenant(i, { phone: e.target.value })}
                      />
                      <FieldError message={errors[`tenants.${i}.phone`]} />
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
