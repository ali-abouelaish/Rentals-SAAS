"use client";

import { useEffect, useState, useTransition } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import {
  convertBookingToTenancy,
  getBookingContractSetup,
  type ConvertContractInput,
} from "../actions/bookings";
import { getTemplateManualFieldsAction } from "@/features/contracts/templates/actions/templates";
import {
  contractGenerationFormSchema,
  type ContractGenerationFormValues,
} from "@/features/contracts/templates/domain/schemas";
import {
  ContractTermsFields,
  Hint,
  ManualFieldsSection,
  fieldCls,
  manualRowsFor,
  manualValuesFrom,
} from "@/features/contracts/templates/ui/ContractGenerationFields";
import type { Booking } from "../domain/types";

type TemplateOption = { id: string; name: string; page_count: number; portfolio_id: string | null };

interface Props {
  open: boolean;
  onClose: () => void;
  booking: Booking;
  onConverted: (patch: Partial<Booking>) => void;
}

const ID_PREFIX = "convert-tenancy";

function emptyValues(): ContractGenerationFormValues {
  return {
    template_id: "",
    start_date: format(new Date(), "yyyy-MM-dd"),
    expiry_date: "",
    rent_pcm: "",
    deposit: "",
    manual: [],
  };
}

export function ConvertToTenancyDialog({ open, onClose, booking, onConverted }: Props) {
  const [isPending, startTransition] = useTransition();
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);

  const form = useForm<ContractGenerationFormValues>({
    resolver: zodResolver(contractGenerationFormSchema),
    defaultValues: emptyValues(),
  });

  useEffect(() => {
    if (!open) return;
    form.reset(emptyValues());
    setLoadingSetup(true);
    getBookingContractSetup(booking.id)
      .then(({ templates: t, defaults }) => {
        setTemplates(t);
        if (defaults.rent_pcm != null) form.setValue("rent_pcm", String(defaults.rent_pcm));
        if (defaults.deposit != null) form.setValue("deposit", String(defaults.deposit));
      })
      .catch(() => toast.error("Couldn't load the contract setup. Close this and try again."))
      .finally(() => setLoadingSetup(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, booking.id]);

  const handlePickTemplate = async (id: string) => {
    form.setValue("template_id", id);
    form.setValue("manual", []);
    form.clearErrors("manual");
    if (!id) return;
    setLoadingTemplate(true);
    try {
      const prompts = await getTemplateManualFieldsAction(id);
      // Ignore a late answer for a template the user has since switched away from.
      if (form.getValues("template_id") === id) form.setValue("manual", manualRowsFor(prompts));
    } catch {
      toast.error("Couldn't load that template. Please try again.");
    } finally {
      setLoadingTemplate(false);
    }
  };

  const convert = (signedAndPaid: boolean) =>
    form.handleSubmit(
      (values) => {
        const contract: ConvertContractInput = {
          templateId: values.template_id || null,
          start_date: values.start_date,
          expiry_date: values.expiry_date || null,
          rent_pcm: Number(values.rent_pcm),
          deposit: Number(values.deposit),
          manualValues: manualValuesFrom(values.manual),
        };

        startTransition(async () => {
          const res = await convertBookingToTenancy(booking.id, { signedAndPaid, contract });
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          // Converted either way; the booking state must reflect that even if
          // the PDF step failed, or a retry would hit "already approved".
          onConverted({ status: "approved", converted_pm_tenant_id: res.pmTenantId });
          if (res.generateError) {
            toast.warning(
              `Converted, but the contract PDF couldn't be generated: ${res.generateError} Generate it from the booking's Actions tab.`,
              { duration: 10000 },
            );
          } else if (res.generated) {
            toast.success(
              res.warnings.length
                ? `Converted — contract generated. Check it before sending: ${res.warnings.join(" ")}`
                : "Converted — contract generated and attached.",
              res.warnings.length ? { duration: 10000 } : undefined,
            );
          } else {
            toast.success(
              signedAndPaid
                ? "Tenancy is active — room marked occupied."
                : "Booking approved — contract draft created, room marked booked.",
            );
          }
          onClose();
        });
      },
      () => toast.error("Please complete the required contract fields."),
    )();

  const templateId = form.watch("template_id");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Convert to tenancy</DialogTitle>
        </DialogHeader>

        <FormProvider {...form}>
          <form noValidate onSubmit={(e) => e.preventDefault()} className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="space-y-3">
              <div className="space-y-1">
                <label htmlFor={`${ID_PREFIX}-template`} className="text-xs font-medium text-foreground">
                  Contract template
                </label>
                <Hint id={`${ID_PREFIX}-template-hint`}>
                  {templates.length === 0 && !loadingSetup ? (
                    <>No templates yet — the contract will be created without a PDF. Add one at /contracts/templates.</>
                  ) : (
                    <>
                      Pick the tenancy agreement to stamp with these details, or leave as{" "}
                      <span className="font-medium">Generate later</span> to convert now and create the PDF afterwards.
                    </>
                  )}
                </Hint>
                <select
                  id={`${ID_PREFIX}-template`}
                  aria-describedby={`${ID_PREFIX}-template-hint`}
                  value={templateId}
                  onChange={(e) => void handlePickTemplate(e.target.value)}
                  disabled={loadingSetup || isPending}
                  className={fieldCls(false)}
                >
                  <option value="">{loadingSetup ? "Loading templates…" : "Generate later (no PDF now)"}</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                {loadingTemplate && <Hint>Loading the template&apos;s fields…</Hint>}
              </div>

              <ContractTermsFields idPrefix={ID_PREFIX} disabled={isPending} />
              <ManualFieldsSection idPrefix={ID_PREFIX} disabled={isPending} />
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
              <Tooltip content="Use this while you're still waiting on signatures or the holding deposit. The room is held as booked.">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={isPending}
                  disabled={loadingTemplate}
                  onClick={() => void convert(false)}
                >
                  Not yet — keep as draft
                </Button>
              </Tooltip>
              <Tooltip content="Use this once the contract is signed and the holding deposit is in. The tenancy starts counting for rent collection.">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  loading={isPending}
                  disabled={loadingTemplate}
                  onClick={() => void convert(true)}
                >
                  <Check className="h-3.5 w-3.5 mr-1" />
                  Yes — activate now
                </Button>
              </Tooltip>
            </div>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
