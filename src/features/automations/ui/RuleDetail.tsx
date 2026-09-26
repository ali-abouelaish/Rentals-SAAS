"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, Play, Save, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DATE_FIELD_REGISTRY, DATE_FIELD_KEYS } from "../domain/dateFields";
import {
  AUTOMATION_EVENTS,
  THRESHOLD_METRICS,
  describeTrigger,
  ruleMode,
  type AutomationEvent,
  type AutomationRuleRow,
  type RuleInput,
  type RuleMode,
  type ThresholdMetric,
  type TriggerConfig,
} from "../domain/rules";
import type {
  MessageEntityType,
  MessageTemplateRow,
  RecipientConfig,
} from "../domain/types";
import type { RuleActivityEntry } from "../data/rules";
import type { RentParityDiff } from "../lib/parity";
import type { StaffOption } from "../actions/reminders";
import { deleteRule, runRuleNow, setRuleMode, updateRule } from "../actions/rules";
import { previewTemplate, type TemplatePreviewResult } from "../actions/templates";

const inputCls =
  "w-full rounded-xl border bg-surface-card px-3 py-2.5 md:py-2 text-base md:text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-brand/50";
const hintCls = "text-[11px] text-foreground-muted mt-1";
const errCls = "text-xs text-red-600 mt-1";

function fieldError(border: boolean) {
  return cn(inputCls, border ? "border-red-400" : "border-border");
}

const EVENT_LABELS: Record<AutomationEvent, string> = {
  works_order_status_changed: "Works order status changes",
  payment_received: "Rent payment recorded",
  tenancy_signed: "Tenancy signed",
};

const METRIC_LABELS: Record<ThresholdMetric, { label: string; unit: string }> = {
  arrears_days: { label: "Rent overdue", unit: "days" },
  arrears_amount: { label: "Arrears amount", unit: "£" },
  works_order_open_days: { label: "Works order open", unit: "days" },
};

/** The entity type a trigger operates on (drives template + recipient options). */
function triggerEntityType(t: TriggerConfig): MessageEntityType {
  if (t.kind === "date_offset") {
    return DATE_FIELD_REGISTRY[t.field]?.entityType ?? "tenancy";
  }
  if (t.kind === "threshold") {
    return t.metric === "works_order_open_days" ? "works_order" : "tenancy";
  }
  return t.event === "works_order_status_changed" ? "works_order" : "tenancy";
}

function defaultResolverFor(entityType: MessageEntityType): RecipientConfig["kind"] extends never
  ? never
  : Extract<RecipientConfig, { kind: "resolver" }>["resolver"] | null {
  switch (entityType) {
    case "tenancy":
    case "pm_tenant":
      return "tenancy_renter";
    case "property":
    case "owner":
      return "property_owner";
    case "works_order":
      return "works_order_contractor";
    case "certificate":
      return "certificate_issuer";
    default:
      return null;
  }
}

const formSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(120, "Max 120 characters"),
    triggerKind: z.enum(["date_offset", "threshold", "event"]),
    dateField: z.string(),
    offsetDays: z.coerce.number().int().min(0, "0–365").max(365, "0–365"),
    direction: z.enum(["before", "after"]),
    metric: z.enum(THRESHOLD_METRICS),
    gte: z.coerce.number().min(1, "At least 1").max(100000),
    event: z.enum(AUTOMATION_EVENTS),
    toStatus: z.string().optional(),
    unpaidOnly: z.boolean(),
    repeatEnabled: z.boolean(),
    repeatEveryDays: z.coerce.number().int().min(1, "1–90").max(90, "1–90"),
    channel: z.enum(["email", "in_app"]),
    recipientMode: z.enum(["resolver", "literal", "staff"]),
    literalAddress: z.string().trim().optional(),
    assigneeUserId: z.string().optional(),
    templateId: z.string().min(1, "Choose a template"),
    sendHour: z.coerce.number().int().min(0).max(23),
  })
  .superRefine((val, ctx) => {
    if (val.triggerKind === "date_offset" && !DATE_FIELD_KEYS.includes(val.dateField)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateField"],
        message: "Choose a date field",
      });
    }
    if (val.channel === "in_app" && !val.assigneeUserId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["assigneeUserId"],
        message: "Choose who receives the reminder",
      });
    }
    if (
      val.channel === "email" &&
      val.recipientMode === "literal" &&
      !z.string().email().safeParse(val.literalAddress ?? "").success
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["literalAddress"],
        message: "Enter a valid email address",
      });
    }
  });

type FormValues = z.infer<typeof formSchema>;

function toFormValues(rule: AutomationRuleRow): FormValues {
  const t = rule.trigger_config;
  return {
    name: rule.name,
    triggerKind: t.kind,
    dateField: t.kind === "date_offset" ? t.field : "tenancy.rent_due_date",
    offsetDays: t.kind === "date_offset" ? t.offset_days : 3,
    direction: t.kind === "date_offset" ? t.direction : "before",
    metric: t.kind === "threshold" ? t.metric : "arrears_days",
    gte: t.kind === "threshold" ? t.gte : 3,
    event: t.kind === "event" ? t.event : "works_order_status_changed",
    toStatus: t.kind === "event" ? (t.to_status ?? "") : "",
    unpaidOnly: rule.conditions.some((c) => c.type === "unpaid_period"),
    repeatEnabled: !!rule.repeat_config,
    repeatEveryDays: rule.repeat_config?.every_days ?? 3,
    channel: rule.channel === "in_app" ? "in_app" : "email",
    recipientMode: rule.recipient_config.kind,
    literalAddress:
      rule.recipient_config.kind === "literal" ? rule.recipient_config.address : "",
    assigneeUserId:
      rule.recipient_config.kind === "staff" ? rule.recipient_config.userId : "",
    templateId: rule.template_id,
    sendHour: rule.send_hour,
  };
}

function toRuleInput(values: FormValues): RuleInput | { error: string } {
  let triggerConfig: TriggerConfig;
  if (values.triggerKind === "date_offset") {
    triggerConfig = {
      kind: "date_offset",
      field: values.dateField,
      offset_days: values.offsetDays,
      direction: values.direction,
    };
  } else if (values.triggerKind === "threshold") {
    triggerConfig = { kind: "threshold", metric: values.metric, gte: values.gte };
  } else {
    triggerConfig = {
      kind: "event",
      event: values.event,
      to_status: values.toStatus || undefined,
    };
  }

  const entityType = triggerEntityType(triggerConfig);
  let recipientConfig: RecipientConfig;
  if (values.channel === "in_app") {
    recipientConfig = { kind: "staff", userId: values.assigneeUserId ?? "" };
  } else if (values.recipientMode === "literal") {
    recipientConfig = { kind: "literal", address: values.literalAddress ?? "" };
  } else {
    const resolver = defaultResolverFor(entityType);
    if (!resolver) return { error: "This trigger has no linked recipient — use a specific address." };
    recipientConfig = { kind: "resolver", resolver };
  }

  return {
    name: values.name,
    triggerConfig,
    conditions: values.unpaidOnly && entityType === "tenancy" ? [{ type: "unpaid_period" }] : [],
    repeatConfig: values.repeatEnabled
      ? { every_days: values.repeatEveryDays, until_cleared: true }
      : null,
    channel: values.channel,
    templateId: values.templateId,
    recipientConfig,
    sendHour: values.sendHour,
  };
}

const MODE_BUTTONS: { mode: RuleMode; label: string; title: string }[] = [
  { mode: "off", label: "Off", title: "Rule does nothing" },
  {
    mode: "dry_run",
    label: "Dry run",
    title: "Evaluates daily and logs what WOULD send — sends nothing",
  },
  { mode: "live", label: "Live", title: "Evaluates daily and really sends" },
];

export function RuleDetail({
  rule,
  activity,
  templates,
  staff,
  parity,
}: {
  rule: AutomationRuleRow;
  activity: RuleActivityEntry[];
  templates: MessageTemplateRow[];
  staff: StaffOption[];
  parity?: RentParityDiff | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [preview, setPreview] = useState<TemplatePreviewResult | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: toFormValues(rule),
  });

  const triggerKind = watch("triggerKind");
  const dateField = watch("dateField");
  const metric = watch("metric");
  const channel = watch("channel");
  const recipientMode = watch("recipientMode");
  const repeatEnabled = watch("repeatEnabled");
  const templateId = watch("templateId");

  const currentTrigger: TriggerConfig =
    triggerKind === "date_offset"
      ? { kind: "date_offset", field: dateField, offset_days: 0, direction: "before" }
      : triggerKind === "threshold"
        ? { kind: "threshold", metric, gte: 1 }
        : { kind: "event", event: watch("event") };
  const entityType = triggerEntityType(currentTrigger);
  const availableTemplates = templates.filter(
    (t) =>
      t.channel === channel && (t.entity_type === entityType || t.entity_type === "none")
  );

  const mode = ruleMode(rule);
  const dryRuns = activity.filter((a) => a.dry_run);
  const liveRuns = activity.filter((a) => !a.dry_run);

  const changeMode = (target: RuleMode) => {
    startTransition(async () => {
      const res = await setRuleMode(rule.id, target);
      if (res.ok) {
        toast.success(
          target === "live"
            ? "Rule is live — it evaluates on the daily sweep"
            : target === "dry_run"
              ? "Dry run enabled — check the would-send list after the next sweep or Run now"
              : "Rule switched off"
        );
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  const runNow = () => {
    startTransition(async () => {
      const res = await runRuleNow(rule.id);
      if (res.ok) {
        toast.success(
          `Evaluated: ${res.candidates} match${res.candidates === 1 ? "" : "es"}, ` +
            `${res.fired} queued, ${res.dryRuns} dry-run, ${res.deduped} already handled`
        );
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  const remove = () => {
    startTransition(async () => {
      const res = await deleteRule(rule.id);
      if (res.ok) {
        toast.success("Rule deleted");
        router.push("/automations");
      } else {
        toast.error(res.error);
      }
    });
  };

  const showPreview = () => {
    startTransition(async () => {
      const res = await previewTemplate(templateId || rule.template_id);
      setPreview(res);
      setPreviewOpen(true);
    });
  };

  const onSubmit = (values: FormValues) => {
    const input = toRuleInput(values);
    if ("error" in input) {
      toast.error(input.error);
      return;
    }
    startTransition(async () => {
      const res = await updateRule(rule.id, input);
      if (res.ok) {
        toast.success("Rule saved");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">{rule.name}</h1>
          <p className="text-xs text-foreground-secondary">
            {describeTrigger(rule.trigger_config)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-border overflow-hidden">
            {MODE_BUTTONS.map((b) => (
              <button
                key={b.mode}
                disabled={isPending}
                title={b.title}
                onClick={() => changeMode(b.mode)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium",
                  mode === b.mode
                    ? b.mode === "live"
                      ? "bg-emerald-100 text-emerald-700"
                      : b.mode === "dry_run"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-surface-inset text-foreground"
                    : "text-foreground-secondary hover:text-foreground"
                )}
              >
                {b.label}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={isPending || mode === "off"}
            onClick={runNow}
            title="Evaluate this rule right now instead of waiting for the daily sweep"
          >
            <Play className="h-3.5 w-3.5" />
            Run now
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={remove}
            className="text-red-600 hover:text-red-700"
            title="Delete this rule (queued messages it already created remain)"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-2xl border border-border bg-surface-card p-4 space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Rule name</label>
          <input {...register("name")} className={fieldError(!!errors.name)} />
          <p className={hintCls}>Shown in the rules list and activity log. Max 120 characters.</p>
          {errors.name && <p className={errCls}>{errors.name.message}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Trigger</label>
            <select
              {...register("triggerKind")}
              className={fieldError(false)}
              title="What makes this rule fire"
            >
              <option value="date_offset">A date approaching</option>
              <option value="threshold">A threshold crossed</option>
              <option value="event">Something happens</option>
            </select>
            <p className={hintCls}>Date and threshold rules run on the daily sweep.</p>
          </div>

          {triggerKind === "date_offset" && (
            <>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Date field
                </label>
                <select {...register("dateField")} className={fieldError(!!errors.dateField)}>
                  {DATE_FIELD_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {DATE_FIELD_REGISTRY[k].label}
                    </option>
                  ))}
                </select>
                <p className={hintCls}>The date column the rule watches.</p>
                {errors.dateField && <p className={errCls}>{errors.dateField.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Days
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={365}
                    {...register("offsetDays")}
                    className={fieldError(!!errors.offsetDays)}
                  />
                  <p className={hintCls}>0–365. 0 = on the day.</p>
                  {errors.offsetDays && <p className={errCls}>{errors.offsetDays.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    When
                  </label>
                  <select {...register("direction")} className={fieldError(false)}>
                    <option value="before">before</option>
                    <option value="after">after</option>
                  </select>
                  <p className={hintCls}>Relative to the date.</p>
                </div>
              </div>
            </>
          )}

          {triggerKind === "threshold" && (
            <>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Metric</label>
                <select {...register("metric")} className={fieldError(false)}>
                  {THRESHOLD_METRICS.map((m) => (
                    <option key={m} value={m}>
                      {METRIC_LABELS[m].label}
                    </option>
                  ))}
                </select>
                <p className={hintCls}>What the rule measures each day.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  At least ({METRIC_LABELS[metric].unit})
                </label>
                <input
                  type="number"
                  min={1}
                  {...register("gte")}
                  className={fieldError(!!errors.gte)}
                />
                <p className={hintCls}>
                  Fires when the metric reaches this value{" "}
                  {metric === "arrears_amount" ? "in whole pounds" : "in days"}.
                </p>
                {errors.gte && <p className={errCls}>{errors.gte.message}</p>}
              </div>
            </>
          )}

          {triggerKind === "event" && (
            <>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Event</label>
                <select {...register("event")} className={fieldError(false)}>
                  {AUTOMATION_EVENTS.map((e) => (
                    <option key={e} value={e}>
                      {EVENT_LABELS[e]}
                    </option>
                  ))}
                </select>
                <p className={hintCls}>Fires immediately when it happens.</p>
              </div>
              {watch("event") === "works_order_status_changed" && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Only when status becomes
                  </label>
                  <input
                    {...register("toStatus")}
                    placeholder="resolved (blank = any)"
                    className={fieldError(false)}
                  />
                  <p className={hintCls}>e.g. resolved, in_progress. Leave blank for any.</p>
                </div>
              )}
            </>
          )}
        </div>

        {entityType === "tenancy" && triggerKind !== "event" && (
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              {...register("unpaidOnly")}
              className="mt-0.5 h-4 w-4 rounded border-border"
            />
            <span>
              <span className="block text-sm font-medium text-foreground">
                Only if that month&apos;s rent is unpaid
              </span>
              <span className={hintCls}>
                Skips tenancies with a recorded rent payment for the trigger month. Also
                re-checked just before sending.
              </span>
            </span>
          </label>
        )}

        <div className="min-h-11 md:min-h-0 rounded-xl border border-border p-3">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              {...register("repeatEnabled")}
              className="mt-0.5 h-4 w-4 rounded border-border"
            />
            <span>
              <span className="block text-sm font-medium text-foreground">
                Repeat until cleared
              </span>
              <span className={hintCls}>
                Fires again every N days while the trigger still applies (arrears chasing,
                works-order chasing). Without this, each occasion fires once.
              </span>
            </span>
          </label>
          {repeatEnabled && (
            <div className="mt-2 max-w-[180px]">
              <label className="block text-xs font-medium text-foreground mb-1">
                Every (days)
              </label>
              <input
                type="number"
                min={1}
                max={90}
                {...register("repeatEveryDays")}
                className={fieldError(!!errors.repeatEveryDays)}
              />
              <p className={hintCls}>1–90 days between repeats.</p>
              {errors.repeatEveryDays && (
                <p className={errCls}>{errors.repeatEveryDays.message}</p>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Channel</label>
            <select {...register("channel")} className={fieldError(false)}>
              <option value="email">Email</option>
              <option value="in_app">Internal reminder (in-app)</option>
            </select>
            <p className={hintCls}>SMS becomes available once an SMS provider is connected.</p>
          </div>

          {channel === "in_app" ? (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Assign to
              </label>
              <select
                {...register("assigneeUserId")}
                className={fieldError(!!errors.assigneeUserId)}
              >
                <option value="">Choose a team member…</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <p className={hintCls}>Reminders land in their inbox.</p>
              {errors.assigneeUserId && (
                <p className={errCls}>{errors.assigneeUserId.message}</p>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Send to</label>
              <select {...register("recipientMode")} className={fieldError(false)}>
                {defaultResolverFor(entityType) && (
                  <option value="resolver">
                    {entityType === "works_order"
                      ? "The contractor"
                      : entityType === "certificate"
                        ? "The contractor who issued it"
                        : entityType === "owner" || entityType === "property"
                          ? "The property owner"
                          : "The tenant (renter)"}
                  </option>
                )}
                <option value="literal">A specific email address</option>
              </select>
              <p className={hintCls}>
                Linked recipients are resolved at send time and respect opt-outs.
              </p>
              {recipientMode === "literal" && (
                <div className="mt-2">
                  <input
                    {...register("literalAddress")}
                    placeholder="name@example.com"
                    className={fieldError(!!errors.literalAddress)}
                  />
                  {errors.literalAddress && (
                    <p className={errCls}>{errors.literalAddress.message}</p>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Send at (hour)
            </label>
            <select {...register("sendHour")} className={fieldError(false)}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")}:00
                </option>
              ))}
            </select>
            <p className={hintCls}>
              Europe/London. Also clamped by the agency send window.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Template</label>
          <div className="flex items-center gap-2">
            <select {...register("templateId")} className={fieldError(!!errors.templateId)}>
              <option value="">Choose a template…</option>
              {availableTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending || !templateId}
              onClick={showPreview}
              title="Render this template with a real record's data"
            >
              <Eye className="h-3.5 w-3.5" />
              Preview
            </Button>
          </div>
          <p className={hintCls}>
            Only templates matching the channel and record type are listed. Edit texts under
            Automations → Templates.
          </p>
          {errors.templateId && <p className={errCls}>{errors.templateId.message}</p>}
        </div>

        <div className="pt-1">
          <Button type="submit" variant="secondary" size="sm" loading={isPending}>
            <Save className="h-3.5 w-3.5" />
            Save rule
          </Button>
        </div>
      </form>

      {mode === "dry_run" && (
        <div className="rounded-2xl border border-amber-300/60 bg-amber-50/50 p-4 space-y-2">
          <h2 className="text-sm font-semibold text-foreground">
            Dry run — what would have been sent
          </h2>
          {dryRuns.length === 0 ? (
            <p className="text-xs text-foreground-muted">
              Nothing logged yet. Use <strong>Run now</strong> or wait for the next daily
              sweep (08:30).
            </p>
          ) : (
            <ul className="space-y-1.5">
              {dryRuns.map((run) => (
                <li key={run.id} className="text-xs text-foreground-secondary">
                  <span className="font-medium text-foreground">{run.run_date}</span>
                  {" — "}
                  {String(run.detail?.entityLabel ?? run.entity_id)}
                  {run.detail?.subject ? ` · "${String(run.detail.subject)}"` : ""}
                  {run.anchor_date ? ` · about ${run.anchor_date}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {parity && (
        <div
          className={cn(
            "rounded-2xl border p-4 space-y-2",
            parity.onlyLegacy.length === 0 && parity.onlyNew.length === 0
              ? "border-emerald-300/60 bg-emerald-50/40"
              : "border-red-300/60 bg-red-50/40"
          )}
        >
          <h2 className="text-sm font-semibold text-foreground">
            Legacy parity check — {parity.date}
          </h2>
          <p className="text-xs text-foreground-secondary">
            Compares today&apos;s evaluation of the rent rules with what the legacy rent
            reminder cron sent. Cut over (switch to Live) once both lists stay empty for a
            full cycle.
          </p>
          <p className="text-xs text-foreground-secondary">
            Matched by both: <span className="font-medium">{parity.both}</span>
          </p>
          {parity.onlyLegacy.length > 0 && (
            <div className="text-xs text-red-700">
              <p className="font-medium">Only legacy sent ({parity.onlyLegacy.length}):</p>
              <ul className="list-disc pl-4">
                {parity.onlyLegacy.map((k) => (
                  <li key={k} className="font-mono">{k}</li>
                ))}
              </ul>
            </div>
          )}
          {parity.onlyNew.length > 0 && (
            <div className="text-xs text-red-700">
              <p className="font-medium">Only the new rule matched ({parity.onlyNew.length}):</p>
              <ul className="list-disc pl-4">
                {parity.onlyNew.map((k) => (
                  <li key={k} className="font-mono">{k}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-surface-card p-4 space-y-2">
        <h2 className="text-sm font-semibold text-foreground">Activity</h2>
        {liveRuns.length === 0 ? (
          <p className="text-xs text-foreground-muted">This rule has not fired yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {liveRuns.map((run) => (
              <li key={run.id} className="text-xs text-foreground-secondary">
                <span className="font-medium text-foreground">{run.run_date}</span>
                {" — "}
                {run.entity_type.replace(/_/g, " ")}
                {run.anchor_date ? ` · about ${run.anchor_date}` : ""}
                {run.message_status ? ` · message ${run.message_status}` : ""}
                {run.message_sent_to ? ` → ${run.message_sent_to}` : ""}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Message preview</DialogTitle>
          </DialogHeader>
          {preview?.ok ? (
            <div className="space-y-3">
              <p className="text-[11px] text-foreground-muted">
                Rendered with real data from: {preview.entityLabel}
              </p>
              {preview.subject && (
                <p className="text-sm font-medium text-foreground">{preview.subject}</p>
              )}
              <pre className="whitespace-pre-wrap rounded-xl border border-border bg-surface-inset p-3 text-xs text-foreground">
                {preview.body}
              </pre>
              {preview.unknownKeys.length > 0 && (
                <p className="text-xs text-amber-700">
                  Unfilled placeholders: {preview.unknownKeys.join(", ")}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-red-600">{preview?.error ?? "Preview failed."}</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
