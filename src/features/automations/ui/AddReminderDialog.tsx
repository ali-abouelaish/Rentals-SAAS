"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { BellPlus } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { MessageEntityType, RecipientConfig } from "../domain/types";
import { mergeFieldsFor } from "../domain/mergeFields";
import {
  createAdHocReminder,
  listStaffForAssignment,
  type StaffOption,
} from "../actions/reminders";

const inputCls =
  "w-full rounded-xl border bg-surface-card px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-brand/50";
const hintCls = "text-[11px] text-foreground-muted mt-1";
const errCls = "text-xs text-red-600 mt-1";

function fieldError(border: boolean) {
  return cn(inputCls, border ? "border-red-400" : "border-border");
}

export type ReminderEntity = {
  type: MessageEntityType;
  id: string;
  label: string;
};

/** The resolver that makes sense for an entity type (null = literal only). */
function resolverFor(entityType: MessageEntityType): RecipientConfig | null {
  switch (entityType) {
    case "tenancy":
    case "pm_tenant":
      return { kind: "resolver", resolver: "tenancy_renter" };
    case "property":
    case "owner":
      return { kind: "resolver", resolver: "property_owner" };
    case "works_order":
      return { kind: "resolver", resolver: "works_order_contractor" };
    case "certificate":
      return { kind: "resolver", resolver: "certificate_issuer" };
    case "unit":
      return null;
  }
}

function resolverLabel(entityType: MessageEntityType): string {
  switch (entityType) {
    case "tenancy":
    case "pm_tenant":
      return "The tenant (renter)";
    case "property":
    case "owner":
      return "The property owner";
    case "works_order":
      return "The contractor";
    case "certificate":
      return "The contractor who issued it";
    case "unit":
      return "";
  }
}

const formSchema = z
  .object({
    channel: z.enum(["email", "in_app"]),
    recipientMode: z.enum(["resolver", "literal", "staff"]),
    literalAddress: z.string().trim().optional(),
    assigneeUserId: z.string().optional(),
    subject: z.string().trim().max(200, "Max 200 characters").optional(),
    body: z.string().trim().min(1, "Message body is required").max(5000, "Max 5000 characters"),
    sendAtLocal: z.string().min(1, "Pick a date and time"),
    recurEnabled: z.boolean(),
    recurEvery: z.coerce.number().int().min(1).max(52).optional(),
    recurUnit: z.enum(["weeks", "months"]).optional(),
    recurUntil: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.channel === "email" && !val.subject) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["subject"],
        message: "Email reminders need a subject",
      });
    }
    if (val.channel === "email" && val.recipientMode === "literal") {
      if (!z.string().email().safeParse(val.literalAddress ?? "").success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["literalAddress"],
          message: "Enter a valid email address",
        });
      }
    }
    if (val.channel === "in_app" && !val.assigneeUserId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["assigneeUserId"],
        message: "Choose who this reminder is for",
      });
    }
    if (val.recurEnabled && !val.recurEvery) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recurEvery"],
        message: "Set how often it repeats",
      });
    }
  });

type FormValues = z.infer<typeof formSchema>;

/** Default send time: tomorrow 09:00 local, as a datetime-local value. */
function defaultSendAtLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AddReminderDialog({
  entity,
  triggerLabel = "Add reminder",
}: {
  entity?: ReminderEntity | null;
  triggerLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [staff, setStaff] = useState<StaffOption[] | null>(null);

  const entityResolver = entity ? resolverFor(entity.type) : null;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      channel: "in_app",
      recipientMode: "staff",
      body: "",
      sendAtLocal: defaultSendAtLocal(),
      recurEnabled: false,
      recurUnit: "weeks",
    },
  });

  const channel = watch("channel");
  const recipientMode = watch("recipientMode");
  const recurEnabled = watch("recurEnabled");
  const body = watch("body");

  // Channel drives the recipient mode: in_app → staff; email → resolver/literal.
  useEffect(() => {
    if (channel === "in_app") {
      setValue("recipientMode", "staff");
    } else if (recipientMode === "staff") {
      setValue("recipientMode", entityResolver ? "resolver" : "literal");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);

  // Load staff options once the dialog opens (needed for in_app assignment).
  useEffect(() => {
    if (open && staff === null) {
      listStaffForAssignment()
        .then(setStaff)
        .catch(() => setStaff([]));
    }
  }, [open, staff]);

  const mergeFields = mergeFieldsFor(entity?.type ?? "none");

  const onSubmit = (values: FormValues) => {
    let recipient: RecipientConfig;
    if (values.channel === "in_app") {
      recipient = { kind: "staff", userId: values.assigneeUserId ?? "" };
    } else if (values.recipientMode === "resolver" && entityResolver) {
      recipient = entityResolver;
    } else {
      recipient = { kind: "literal", address: values.literalAddress ?? "" };
    }

    startTransition(async () => {
      const res = await createAdHocReminder({
        channel: values.channel,
        recipient,
        subject: values.subject ?? null,
        body: values.body,
        relatedEntityType: entity?.type ?? null,
        relatedEntityId: entity?.id ?? null,
        sendAtISO: new Date(values.sendAtLocal).toISOString(),
        recurrence: values.recurEnabled
          ? {
              every: values.recurEvery ?? 1,
              unit: values.recurUnit ?? "weeks",
              until: values.recurUntil || null,
            }
          : null,
      });
      if (res.ok) {
        toast.success(
          res.clamped
            ? "Reminder scheduled — moved into your send window (quiet hours)"
            : "Reminder scheduled"
        );
        reset();
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" title="Schedule a one-off or repeating reminder">
          <BellPlus className="h-3.5 w-3.5" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add reminder{entity ? ` — ${entity.label}` : ""}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Type</label>
            <select
              {...register("channel")}
              className={fieldError(!!errors.channel)}
              title="Internal reminders appear in your team's reminders inbox; email goes out to the recipient"
            >
              <option value="in_app">Internal reminder (in-app)</option>
              <option value="email">Email</option>
              <option value="sms" disabled>
                SMS (not configured)
              </option>
            </select>
            <p className={hintCls}>
              Internal reminders stay in the team inbox. Emails send via your agency&apos;s
              connected mailbox.
            </p>
          </div>

          {channel === "in_app" ? (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Assign to</label>
              <select
                {...register("assigneeUserId")}
                className={fieldError(!!errors.assigneeUserId)}
              >
                <option value="">Choose a team member…</option>
                {(staff ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <p className={hintCls}>
                The reminder appears in their inbox on the scheduled date until acknowledged.
              </p>
              {errors.assigneeUserId && <p className={errCls}>{errors.assigneeUserId.message}</p>}
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Send to</label>
              <select {...register("recipientMode")} className={fieldError(false)}>
                {entityResolver && entity && (
                  <option value="resolver">{resolverLabel(entity.type)}</option>
                )}
                <option value="literal">A specific email address</option>
              </select>
              <p className={hintCls}>
                Linked recipients are looked up when the message sends, so contact changes and
                opt-outs are always respected.
              </p>
              {recipientMode === "literal" && (
                <div className="mt-2">
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Email address
                  </label>
                  <input
                    {...register("literalAddress")}
                    placeholder="name@example.com"
                    className={fieldError(!!errors.literalAddress)}
                  />
                  <p className={hintCls}>Full email address including the domain.</p>
                  {errors.literalAddress && (
                    <p className={errCls}>{errors.literalAddress.message}</p>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              {channel === "email" ? "Subject" : "Title (optional)"}
            </label>
            <input
              {...register("subject")}
              placeholder={channel === "email" ? "Rent inspection next week" : "Chase gas certificate"}
              className={fieldError(!!errors.subject)}
            />
            <p className={hintCls}>Max 200 characters.</p>
            {errors.subject && <p className={errCls}>{errors.subject.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Message</label>
            <textarea
              {...register("body")}
              rows={5}
              className={fieldError(!!errors.body)}
              placeholder="What should the reminder say?"
            />
            <p className={hintCls}>
              Max 5000 characters. Curly placeholders like {"{{renter_name}}"} are filled in from
              the linked record when the reminder is created.
            </p>
            {errors.body && <p className={errCls}>{errors.body.message}</p>}
            {mergeFields.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {mergeFields.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    title={`Insert ${f.label} (e.g. ${f.example})`}
                    className="text-[10px] rounded-full border border-border px-2 py-0.5 text-foreground-secondary hover:bg-surface-inset"
                    onClick={() => setValue("body", `${body}${body ? " " : ""}{{${f.key}}}`)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Send at</label>
            <input
              type="datetime-local"
              {...register("sendAtLocal")}
              className={fieldError(!!errors.sendAtLocal)}
            />
            <p className={hintCls}>
              Emails outside your agency&apos;s send window are held until it opens (see
              Settings → Messaging).
            </p>
            {errors.sendAtLocal && <p className={errCls}>{errors.sendAtLocal.message}</p>}
          </div>

          <div className="rounded-xl border border-border p-3 space-y-2">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                {...register("recurEnabled")}
                className="mt-0.5 h-4 w-4 rounded border-border"
              />
              <span>
                <span className="block text-sm font-medium text-foreground">Repeat</span>
                <span className={hintCls}>
                  Re-sends on a schedule after each send, until the end date.
                </span>
              </span>
            </label>
            {recurEnabled && (
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Every</label>
                  <input
                    type="number"
                    min={1}
                    max={52}
                    {...register("recurEvery")}
                    className={fieldError(!!errors.recurEvery)}
                  />
                  <p className={hintCls}>1–52.</p>
                  {errors.recurEvery && <p className={errCls}>{errors.recurEvery.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Unit</label>
                  <select {...register("recurUnit")} className={fieldError(false)}>
                    <option value="weeks">weeks</option>
                    <option value="months">months</option>
                  </select>
                  <p className={hintCls}>Weeks or months.</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Until (optional)
                  </label>
                  <input type="date" {...register("recurUntil")} className={fieldError(false)} />
                  <p className={hintCls}>Last possible date.</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" variant="secondary" size="sm" loading={isPending}>
              <BellPlus className="h-3.5 w-3.5" />
              Schedule reminder
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
