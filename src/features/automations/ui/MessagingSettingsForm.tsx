"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { messagingSettingsSchema, type MessagingSettings } from "../domain/types";
import { updateMessagingSettings } from "../actions/settings";

const inputCls =
  "w-full rounded-xl border bg-surface-card px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-brand/50";
const hintCls = "text-[11px] text-foreground-muted mt-1";
const errCls = "text-xs text-red-600 mt-1";

function fieldError(border: boolean) {
  return cn(inputCls, border ? "border-red-400" : "border-border");
}

function hourLabel(h: number): string {
  return `${String(h % 24).padStart(2, "0")}:00`;
}

export function MessagingSettingsForm({ initial }: { initial: MessagingSettings }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MessagingSettings>({
    resolver: zodResolver(messagingSettingsSchema),
    defaultValues: initial,
  });

  const onSubmit = (values: MessagingSettings) => {
    startTransition(async () => {
      const res = await updateMessagingSettings(values);
      if (res.ok) {
        toast.success("Messaging settings saved");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Send window opens
          </label>
          <select
            {...register("windowStart", { valueAsNumber: true })}
            className={fieldError(!!errors.windowStart)}
            title="Emails and texts queued for earlier than this are held until the window opens"
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {hourLabel(h)}
              </option>
            ))}
          </select>
          <p className={hintCls}>
            Europe/London time. No email or SMS is sent before this hour — reminders queued
            overnight wait for the window.
          </p>
          {errors.windowStart && <p className={errCls}>{errors.windowStart.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Send window closes
          </label>
          <select
            {...register("windowEnd", { valueAsNumber: true })}
            className={fieldError(!!errors.windowEnd)}
            title="Messages due after this hour are deferred to the next morning"
          >
            {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
              <option key={h} value={h}>
                {hourLabel(h)}
              </option>
            ))}
          </select>
          <p className={hintCls}>
            Must be after the opening hour. Messages due later are deferred to the next
            day&apos;s opening.
          </p>
          {errors.windowEnd && <p className={errCls}>{errors.windowEnd.message}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Daily send limit
        </label>
        <input
          {...register("dailyLimit", { valueAsNumber: true })}
          type="number"
          inputMode="numeric"
          min={1}
          max={10000}
          className={cn(fieldError(!!errors.dailyLimit), "font-mono")}
          title="Blast-radius guard: caps how many emails/texts can go out per day even if an automation rule matches everything"
        />
        <p className={hintCls}>
          1–10,000. Safety cap on outbound emails/SMS per day — if an automation rule
          misfires and matches every tenancy, sending stops here and you get an alert.
          In-app reminders don&apos;t count.
        </p>
        {errors.dailyLimit && <p className={errCls}>{errors.dailyLimit.message}</p>}
      </div>

      <div className="pt-1">
        <Button type="submit" variant="secondary" size="sm" loading={isPending}>
          <Save className="h-3.5 w-3.5" />
          Save settings
        </Button>
      </div>
    </form>
  );
}
