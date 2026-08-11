"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Save, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { smtpProviderSchema, type SmtpProviderValues } from "../domain/schemas";
import { saveSmtpProvider } from "../actions/smtp";
import type { SmtpConfigForEdit } from "../data/provider";

const inputCls =
  "w-full rounded-xl border bg-surface-card px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-brand/50";
const hintCls = "text-[11px] text-foreground-muted mt-1";
const errCls = "text-xs text-red-600 mt-1";

function fieldError(border: boolean) {
  return cn(inputCls, border ? "border-red-400" : "border-border");
}

export function SmtpForm({
  initial,
  onCancel,
}: {
  initial?: SmtpConfigForEdit | null;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SmtpProviderValues>({
    resolver: zodResolver(smtpProviderSchema),
    defaultValues: {
      fromAddress: initial?.fromAddress ?? "",
      fromName: initial?.fromName ?? "",
      replyTo: initial?.replyTo ?? "",
      host: initial?.host ?? "",
      port: initial?.port ?? 587,
      secure: initial?.secure ?? false,
      username: initial?.username ?? "",
      password: "",
    },
  });

  const onSubmit = (values: SmtpProviderValues) => {
    startTransition(async () => {
      const res = await saveSmtpProvider(values);
      if (res.ok) {
        toast.success("SMTP connection verified and saved");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">From address</label>
          <input
            {...register("fromAddress")}
            placeholder="lettings@youragency.co.uk"
            className={fieldError(!!errors.fromAddress)}
          />
          <p className={hintCls}>The address emails are sent from. Must be allowed by your SMTP server.</p>
          {errors.fromAddress && <p className={errCls}>{errors.fromAddress.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">From name</label>
          <input
            {...register("fromName")}
            placeholder="Your Agency"
            className={fieldError(!!errors.fromName)}
          />
          <p className={hintCls}>Optional display name shown to recipients. Max 120 characters.</p>
          {errors.fromName && <p className={errCls}>{errors.fromName.message}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">Reply-to</label>
        <input
          {...register("replyTo")}
          placeholder="replies@youragency.co.uk"
          className={fieldError(!!errors.replyTo)}
        />
        <p className={hintCls}>Optional. Where replies should go if different from the from address.</p>
        {errors.replyTo && <p className={errCls}>{errors.replyTo.message}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-foreground mb-1.5">SMTP host</label>
          <input
            {...register("host")}
            placeholder="smtp.youragency.co.uk"
            className={fieldError(!!errors.host)}
          />
          <p className={hintCls}>Your mail server hostname.</p>
          {errors.host && <p className={errCls}>{errors.host.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Port</label>
          <input
            {...register("port")}
            type="number"
            inputMode="numeric"
            placeholder="587"
            className={cn(fieldError(!!errors.port), "font-mono")}
          />
          <p className={hintCls}>587 (STARTTLS) or 465 (SSL).</p>
          {errors.port && <p className={errCls}>{errors.port.message}</p>}
        </div>
      </div>

      <label className="flex items-start gap-2">
        <input type="checkbox" {...register("secure")} className="mt-0.5 h-4 w-4 rounded border-border" />
        <span>
          <span className="block text-sm font-medium text-foreground">Use SSL/TLS (implicit)</span>
          <span className={hintCls}>Tick for port 465. Leave unticked for 587 (STARTTLS).</span>
        </span>
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Username</label>
          <input
            {...register("username")}
            placeholder="lettings@youragency.co.uk"
            autoComplete="off"
            className={fieldError(!!errors.username)}
          />
          <p className={hintCls}>Usually the full email address.</p>
          {errors.username && <p className={errCls}>{errors.username.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
          <input
            {...register("password")}
            type="password"
            autoComplete="new-password"
            placeholder={initial ? "•••••••• (leave blank to keep current)" : ""}
            className={fieldError(!!errors.password)}
          />
          <p className={hintCls}>
            {initial ? "Leave blank to keep the stored password." : "Stored encrypted; never shown again."}
          </p>
          {errors.password && <p className={errCls}>{errors.password.message}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" variant="secondary" size="sm" loading={isPending}>
          <Save className="h-3.5 w-3.5" />
          Test &amp; save
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isPending}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
