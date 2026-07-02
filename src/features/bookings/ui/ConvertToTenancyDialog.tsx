"use client";

import { useEffect, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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

const inputCls =
  "w-full rounded-lg border border-border bg-surface-inset px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";

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

  useEffect(() => {
    if (!open) return;
    setTemplateId("");
    setManualFields([]);
    setManualValues({});
    setStartDate(today);
    setExpiryDate("");
    setRentPcm("");
    setDeposit("");
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

  const handlePickTemplate = (id: string) => {
    setTemplateId(id);
    setManualFields([]);
    setManualValues({});
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

  const handleConvert = (signedAndPaid: boolean) => {
    let contract: ConvertContractInput | undefined;
    if (templateId) {
      const rentNum = Number(rentPcm);
      const depositNum = Number(deposit);
      if (!Number.isFinite(rentNum) || rentNum < 0) {
        toast.error("Rent PCM must be a positive number");
        return;
      }
      if (!Number.isFinite(depositNum) || depositNum < 0) {
        toast.error("Deposit must be a positive number");
        return;
      }
      if (!startDate) {
        toast.error("Start date is required");
        return;
      }
      contract = {
        templateId,
        start_date: startDate,
        expiry_date: expiryDate || null,
        rent_pcm: Math.round(rentNum),
        deposit: Math.round(depositNum),
        manualValues,
      };
    }

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
                className={inputCls}
                title="Pick a template and we'll stamp the tenancy details onto a PDF and attach it to the new contract"
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
              {templates.length === 0 && !loadingSetup && (
                <p className="text-[11px] text-foreground-muted">
                  No templates yet — the contract will be created without a PDF. Add one at /contracts/templates.
                </p>
              )}
            </div>

            {templateId && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">Start date *</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">Expiry date</label>
                    <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className={inputCls} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">Rent PCM (£) *</label>
                    <input type="number" min={0} value={rentPcm} onChange={(e) => setRentPcm(e.target.value)} className={inputCls} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">Deposit (£) *</label>
                    <input type="number" min={0} value={deposit} onChange={(e) => setDeposit(e.target.value)} className={inputCls} />
                  </div>
                </div>

                {manualFields.length > 0 && (
                  <div className="space-y-3 pt-2 border-t border-border">
                    <p className="text-xs font-semibold text-foreground-secondary uppercase tracking-wide">
                      Template-specific fields
                    </p>
                    {manualFields.map((f) => {
                      const key = f.manual_key ?? "";
                      return (
                        <div key={f.id} className="space-y-1">
                          <label className="text-xs font-medium text-foreground">{f.label}</label>
                          <input
                            value={manualValues[key] ?? ""}
                            onChange={(e) => setManualValues((p) => ({ ...p, [key]: e.target.value }))}
                            className={inputCls}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
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
