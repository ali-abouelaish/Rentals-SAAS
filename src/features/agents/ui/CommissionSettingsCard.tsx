"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/features/helpdesk/ui/Field";
import { updateCommissionVatSetting } from "../actions/agents";
import { commissionVatSettingSchema, type CommissionVatSettingValues } from "../domain/schemas";

/** Agency-wide commission settings, shown to admins above the agents list. */
export function CommissionSettingsCard({
  vatEnabled,
  available,
}: {
  vatEnabled: boolean;
  /** False until the VAT-setting migration has been applied. */
  available: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    reset,
  } = useForm<CommissionVatSettingValues>({
    resolver: zodResolver(commissionVatSettingSchema),
    defaultValues: { vat_enabled: vatEnabled },
  });
  const current = watch("vat_enabled");

  const onSubmit = (values: CommissionVatSettingValues) => {
    startTransition(async () => {
      const result = await updateCommissionVatSetting(values);
      if (!result.ok) {
        toast.error("Couldn't save commission settings", { description: result.error });
        return;
      }
      reset(values);
      toast.success(
        values.vat_enabled
          ? "VAT will be deducted from new rentals before commission"
          : "New rentals will no longer have VAT deducted before commission"
      );
      router.refresh();
    });
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-brand" />
            <p className="text-sm font-medium text-brand">Commission settings</p>
          </div>

          <Field
            id="commission-vat"
            label="VAT on rentals"
            hint="Applies to new rentals and any still awaiting approval, card and transfer only. Bonuses never have VAT deducted."
            tooltip="Approving a rental locks in the setting at that moment, so switching this never changes approved or paid earnings. It affects agent and manager commission alike."
            error={errors.vat_enabled?.message}
          >
            <label
              htmlFor="commission-vat"
              className="flex items-start gap-2.5 rounded-lg border border-border px-3 py-2.5 text-sm cursor-pointer hover:bg-surface-inset"
            >
              <input
                id="commission-vat"
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-border"
                disabled={!available || isPending}
                {...register("vat_enabled")}
              />
              <span>
                <span className="block font-medium text-foreground">
                  Deduct VAT from rentals before commission
                </span>
                <span className="block text-xs text-foreground-muted">
                  {current
                    ? "On: a £600 transfer rental is £500 after VAT, and commission is worked out on £500."
                    : "Off: a £600 transfer rental stays £600, and commission is worked out on £600."}
                </span>
              </span>
            </label>
          </Field>

          {!available && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              This setting becomes editable once the latest database update has been applied. Until then VAT is
              always deducted.
            </p>
          )}

          <div className="flex justify-end">
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              loading={isPending}
              disabled={!available || isPending}
            >
              Save settings
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
