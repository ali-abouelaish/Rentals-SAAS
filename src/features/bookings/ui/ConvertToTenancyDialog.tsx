"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertCircle, Check } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import {
  convertBookingToTenancy,
  getBookingContractSetup,
  type ConvertContractInput,
} from "../actions/bookings";
import { getTemplateManualFieldsAction } from "@/features/contracts/templates/actions/templates";
import type { Booking } from "../domain/types";

type TemplateOption = { id: string; name: string; page_count: number; portfolio_id: string | null };
type ManualField = {
  id: string;
  label: string;
  manual_key: string | null;
  manual_default: string | null;
  sort_order: number;
};

interface Props {
  open: boolean;
  onClose: () => void;
  booking: Booking;
  onConverted: (patch: Partial<Booking>) => void;
}

const fieldCls = (hasError: boolean) =>
  cn(
    "w-full rounded-lg border bg-surface-inset px-2 py-1.5 text-sm focus:outline-none focus:ring-2",
    hasError
      ? "border-red-400 focus:ring-red-500/20 focus:border-red-500"
      : "border-border focus:ring-brand/20 focus:border-brand"
  );

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] leading-snug text-foreground-muted">{children}</p>;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="flex items-center gap-1 text-[11px] text-red-500">
      <AlertCircle className="h-3 w-3 shrink-0" />
      {message}
    </p>
  );
}

export function ConvertToTenancyDialog({ open, onClose, booking, onConverted }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [isPending, startTransition] = useTransition();
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [manualFields, setManualFields] = useState<ManualField[]>([]);
  const [manualValues, setManualValues] = useState<Record<string, string>>({});
  const [startDate, setStartDate] = useState(today);
  const [expiryDate, setExpiryDate] = useState("");
  const [rentPcm, setRentPcm] = useState("");
  const [deposit, setDeposit] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setTemplateId("");
    setManualFields([]);
    setManualValues({});
    setStartDate(today);
    setExpiryDate("");
    setRentPcm("");
    setDeposit("");
    setErrors({});
    setLoadingSetup(true);
    getBookingContractSetup(booking.id)
      .then(({ templates: t, defaults }) => {
        setTemplates(t);
        if (defaults.rent_pcm != null) setRentPcm(String(defaults.rent_pcm));
        if (defaults.deposit != null) setDeposit(String(defaults.deposit));
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load contract setup"))
      .finally(() => setLoadingSetup(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, booking.id]);

  // Clear a single field's error as the user corrects it.
  const clearError = (key: string) =>
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const handlePickTemplate = (id: string) => {
    setTemplateId(id);
    setManualFields([]);
    setManualValues({});
    setErrors({});
    if (!id) return;
    startTransition(async () => {
      try {
        const manuals = await getTemplateManualFieldsAction(id);
        setManualFields(manuals);
        const defaults: Record<string, string> = {};
        for (const m of manuals) if (m.manual_key) defaults[m.manual_key] = m.manual_default ?? "";
        setManualValues(defaults);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load template");
      }
    });
  };

  // Required-field validation for the contract details. These apply whether or
  // not a template is chosen — without one we skip the PDF but still record the
  // agreed terms on the contract.
  const validateContract = (): Record<string, string> => {
    const errs: Record<string, string> = {};

    if (!startDate) errs.startDate = "Start date is required";
    if (expiryDate && startDate && expiryDate <= startDate) {
      errs.expiryDate = "Expiry must be after the start date";
    }

    if (rentPcm.trim() === "") {
      errs.rentPcm = "Rent is required";
    } else if (!Number.isFinite(Number(rentPcm)) || Number(rentPcm) <= 0) {
      errs.rentPcm = "Enter a rent amount greater than 0";
    }

    if (deposit.trim() === "") {
      errs.deposit = "Deposit is required";
    } else if (!Number.isFinite(Number(deposit)) || Number(deposit) < 0) {
      errs.deposit = "Enter a valid deposit (0 or more)";
    }

    for (const f of manualFields) {
      const key = f.manual_key ?? "";
      if (!key) continue;
      if (!(manualValues[key] ?? "").trim()) errs[`manual_${key}`] = `${f.label} is required`;
    }

    return errs;
  };

  const handleConvert = (signedAndPaid: boolean) => {
    const errs = validateContract();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast.error("Please complete the required contract fields");
      return;
    }
    const contract: ConvertContractInput = {
      templateId: templateId || null,
      start_date: startDate,
      expiry_date: expiryDate || null,
      rent_pcm: Math.round(Number(rentPcm)),
      deposit: Math.round(Number(deposit)),
      manualValues,
    };

    startTransition(async () => {
      try {
        const res = await convertBookingToTenancy(booking.id, { signedAndPaid, contract });
        toast.success(
          res.generated
            ? "Converted — contract generated and attached."
            : signedAndPaid
              ? "Tenancy is active — room marked occupied."
              : "Booking approved — contract draft created, room marked booked."
        );
        onConverted({ status: "approved", converted_pm_tenant_id: res.pmTenantId });
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to convert booking");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Convert to tenancy</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Contract */}
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Contract template</label>
              <select
                value={templateId}
                onChange={(e) => handlePickTemplate(e.target.value)}
                disabled={loadingSetup || isPending}
                className={fieldCls(false)}
              >
                <option value="">
                  {loadingSetup ? "Loading templates…" : "Generate later (no PDF now)"}
                </option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {templates.length === 0 && !loadingSetup ? (
                <Hint>
                  No templates yet — the contract will be created without a PDF. Add one at
                  /contracts/templates.
                </Hint>
              ) : (
                <Hint>
                  Pick the tenancy agreement to stamp with these details, or leave as{" "}
                  <span className="font-medium">Generate later</span> to convert now and create the PDF
                  afterwards.
                </Hint>
              )}
            </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">Start date *</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        clearError("startDate");
                        clearError("expiryDate");
                      }}
                      className={fieldCls(!!errors.startDate)}
                    />
                    <FieldError message={errors.startDate} />
                    {!errors.startDate && <Hint>First day of the tenancy.</Hint>}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">Expiry date (optional)</label>
                    <input
                      type="date"
                      value={expiryDate}
                      onChange={(e) => {
                        setExpiryDate(e.target.value);
                        clearError("expiryDate");
                      }}
                      className={fieldCls(!!errors.expiryDate)}
                    />
                    <FieldError message={errors.expiryDate} />
                    {!errors.expiryDate && <Hint>Tenancies are rolling — leave blank.</Hint>}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">Rent PCM (£) *</label>
                    <input
                      type="number"
                      min={0}
                      value={rentPcm}
                      onChange={(e) => {
                        setRentPcm(e.target.value);
                        clearError("rentPcm");
                      }}
                      className={fieldCls(!!errors.rentPcm)}
                    />
                    <FieldError message={errors.rentPcm} />
                    {!errors.rentPcm && <Hint>Monthly rent in pounds.</Hint>}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">Deposit (£) *</label>
                    <input
                      type="number"
                      min={0}
                      value={deposit}
                      onChange={(e) => {
                        setDeposit(e.target.value);
                        clearError("deposit");
                      }}
                      className={fieldCls(!!errors.deposit)}
                    />
                    <FieldError message={errors.deposit} />
                    {!errors.deposit && <Hint>Deposit amount in pounds.</Hint>}
                  </div>
                </div>

                {manualFields.length > 0 && (
                  <div className="space-y-3 pt-2 border-t border-border">
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-foreground-secondary uppercase tracking-wide">
                        Template-specific fields
                      </p>
                      <Hint>These are stamped onto the contract PDF, so all are required.</Hint>
                    </div>
                    {manualFields.map((f) => {
                      const key = f.manual_key ?? "";
                      const errKey = `manual_${key}`;
                      return (
                        <div key={f.id} className="space-y-1">
                          <label className="text-xs font-medium text-foreground">{f.label} *</label>
                          <input
                            value={manualValues[key] ?? ""}
                            onChange={(e) => {
                              setManualValues((p) => ({ ...p, [key]: e.target.value }));
                              clearError(errKey);
                            }}
                            className={fieldCls(!!errors[errKey])}
                          />
                          <FieldError message={errors[errKey]} />
                        </div>
                      );
                    })}
                  </div>
                )}
          </div>

          {/* Signed & paid */}
          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-sm text-foreground-secondary">
              Has the tenant signed the contract and paid the holding deposit?
            </p>
            <ul className="rounded-lg bg-surface-inset px-3 py-2.5 text-xs text-foreground-muted space-y-1">
              <li>
                <span className="font-medium text-foreground">Yes</span> — contract becomes{" "}
                <span className="font-medium">active</span> and the room is marked{" "}
                <span className="font-medium">occupied</span>.
              </li>
              <li>
                <span className="font-medium text-foreground">Not yet</span> — contract stays a{" "}
                <span className="font-medium">draft</span> and the room is held as{" "}
                <span className="font-medium">booked</span> until activated later.
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="button" variant="outline" size="sm" loading={isPending} onClick={() => handleConvert(false)}>
              Not yet — keep as draft
            </Button>
            <Button type="button" variant="secondary" size="sm" loading={isPending} onClick={() => handleConvert(true)}>
              <Check className="h-3.5 w-3.5 mr-1" />
              Yes — activate now
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
