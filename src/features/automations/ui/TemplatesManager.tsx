"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, Pencil, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useCursorInsert } from "@/lib/hooks/useCursorInsert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  TEMPLATE_ENTITY_TYPES,
  type MessageTemplateRow,
  type TemplateEntityType,
} from "../domain/types";
import { mergeFieldsFor, RULE_MERGE_FIELDS, WELCOME_TEMPLATE_KEY } from "../domain/mergeFields";
import { smsSegments } from "../lib/render";
import {
  createTemplate,
  deleteTemplate,
  previewTemplate,
  resetTemplate,
  updateTemplate,
  type TemplatePreviewResult,
} from "../actions/templates";

const inputCls =
  "w-full rounded-xl border bg-surface-card px-3 py-2.5 md:py-2 text-base md:text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-brand/50";
const hintCls = "text-[11px] text-foreground-muted mt-1";
const errCls = "text-xs text-red-600 mt-1";

function fieldError(border: boolean) {
  return cn(inputCls, border ? "border-red-400" : "border-border");
}

const ENTITY_LABELS: Record<TemplateEntityType, string> = {
  tenancy: "Tenancy",
  pm_tenant: "Tenant",
  property: "Property",
  unit: "Unit",
  works_order: "Works order",
  owner: "Owner",
  certificate: "Certificate",
  none: "General",
};

const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  sms: "SMS",
  in_app: "In-app",
};

const editSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120, "Max 120 characters"),
  subject: z.string().trim().max(200, "Max 200 characters").optional(),
  body: z.string().trim().min(1, "Body is required").max(10000, "Max 10,000 characters"),
});
type EditValues = z.infer<typeof editSchema>;

const createSchema = editSchema.extend({
  channel: z.enum(["email", "sms", "in_app"]),
  entityType: z.enum(TEMPLATE_ENTITY_TYPES),
});
type CreateValues = z.infer<typeof createSchema>;

function MergeChips({
  entityType,
  templateKey,
  onInsert,
  onPreventBlur,
}: {
  entityType: TemplateEntityType;
  /** Unlocks the welcome-only fields on the welcome template. */
  templateKey?: string | null;
  onInsert: (key: string) => void;
  /** Stops the click stealing focus, so the caret stays where it was. */
  onPreventBlur: (event: React.MouseEvent) => void;
}) {
  const isWelcome = templateKey === WELCOME_TEMPLATE_KEY;
  // The welcome email is sent by hand, never by a rule, so there is no trigger
  // date to offer — showing {{anchor_date}} here would only ever render blank.
  const fields = [
    ...mergeFieldsFor(entityType, templateKey),
    ...(isWelcome ? [] : RULE_MERGE_FIELDS),
  ];
  return (
    <>
      <div className="flex flex-wrap gap-1 mt-1.5">
        {fields.map((f) => (
          <button
            key={f.key}
            type="button"
            title={`Insert ${f.label} (e.g. ${f.example}) at the cursor`}
            className="inline-flex min-h-11 items-center rounded-full border border-border px-2.5 py-0.5 text-[10px] text-foreground-secondary hover:bg-surface-inset md:min-h-0"
            onMouseDown={onPreventBlur}
            onClick={() => onInsert(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>
      {isWelcome && (
        <div className={hintCls}>
          <p>
            Staff send this one by hand from a tenant&apos;s drawer, and can tweak the
            wording for a single send. {"{{portal_link}}"} becomes a fresh sign-in link,
            valid 20 minutes, at the moment it is sent.
          </p>
          <p className="mt-1">
            This one is laid out as a designed HTML email — your logo, colours and the
            property/rent panel are applied for you. Write plain text and use{" "}
            <code>{"# Headline"}</code> on the first line,{" "}
            <code>{"## Section"}</code>, <code>{"- bullet"}</code>,{" "}
            <code>{"**bold**"}</code>, <code>{"---"}</code> for a divider, and{" "}
            <code>{"[Label](link)"}</code> alone on a line for a button.
          </p>
        </div>
      )}
    </>
  );
}

function EditTemplateDialog({
  template,
  open,
  onClose,
}: {
  template: MessageTemplateRow;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: template.name,
      subject: template.subject ?? "",
      body: template.body,
    },
  });
  const body = watch("body");
  const { bindRef, insert, preventBlur } = useCursorInsert<HTMLTextAreaElement>();
  // Pull RHF's ref out so it can be forwarded alongside our own.
  const { ref: bodyRef, ...bodyField } = register("body");
  const sms = template.channel === "sms" ? smsSegments(body ?? "") : null;

  const onSubmit = (values: EditValues) => {
    startTransition(async () => {
      const res = await updateTemplate({
        id: template.id,
        name: values.name,
        subject: values.subject || null,
        body: values.body,
      });
      if (res.ok) {
        toast.success("Template saved");
        onClose();
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Edit template — {CHANNEL_LABELS[template.channel]},{" "}
            {ENTITY_LABELS[template.entity_type]}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Name</label>
            <input {...register("name")} className={fieldError(!!errors.name)} />
            <p className={hintCls}>Shown when picking templates. Max 120 characters.</p>
            {errors.name && <p className={errCls}>{errors.name.message}</p>}
          </div>
          {template.channel !== "sms" && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Subject / title
              </label>
              <input {...register("subject")} className={fieldError(!!errors.subject)} />
              <p className={hintCls}>Placeholders work here too. Max 200 characters.</p>
              {errors.subject && <p className={errCls}>{errors.subject.message}</p>}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Body</label>
            <textarea
              {...bodyField}
              ref={(el) => bindRef(el, bodyRef)}
              rows={8}
              className={fieldError(!!errors.body)}
            />
            <p className={hintCls}>
              Plain text with {"{{placeholders}}"}. Blank lines start new paragraphs in
              emails. Max 10,000 characters.
            </p>
            {sms && (
              <p
                className={cn(
                  "text-[11px] mt-1",
                  sms.segments > 1 ? "text-amber-700" : "text-foreground-muted"
                )}
              >
                {sms.chars} characters · {sms.segments} SMS segment
                {sms.segments === 1 ? "" : "s"}
                {sms.segments > 1 &&
                  " — long texts cost more and may be split; consider trimming"}
              </p>
            )}
            {errors.body && <p className={errCls}>{errors.body.message}</p>}
            <MergeChips
              entityType={template.entity_type}
              templateKey={template.key}
              onPreventBlur={preventBlur}
              onInsert={(key) =>
                insert(body ?? "", `{{${key}}}`, (next) =>
                  setValue("body", next, { shouldDirty: true, shouldValidate: true })
                )
              }
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="secondary" size="sm" loading={isPending}>
              <Save className="h-3.5 w-3.5" />
              Save template
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateTemplateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", subject: "", body: "", channel: "email", entityType: "tenancy" },
  });
  const body = watch("body");
  const { bindRef, insert, preventBlur } = useCursorInsert<HTMLTextAreaElement>();
  // Pull RHF's ref out so it can be forwarded alongside our own.
  const { ref: bodyRef, ...bodyField } = register("body");
  const channel = watch("channel");
  const entityType = watch("entityType");

  const onSubmit = (values: CreateValues) => {
    startTransition(async () => {
      const res = await createTemplate({
        name: values.name,
        channel: values.channel,
        entityType: values.entityType,
        subject: values.subject || null,
        body: values.body,
      });
      if (res.ok) {
        toast.success("Template created");
        onClose();
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New template</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Name</label>
            <input {...register("name")} className={fieldError(!!errors.name)} />
            <p className={hintCls}>e.g. &quot;Inspection notice&quot;. Max 120 characters.</p>
            {errors.name && <p className={errCls}>{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Channel</label>
              <select {...register("channel")} className={fieldError(false)}>
                <option value="email">Email</option>
                <option value="in_app">In-app</option>
                <option value="sms">SMS</option>
              </select>
              <p className={hintCls}>How messages using it are delivered.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">About</label>
              <select {...register("entityType")} className={fieldError(false)}>
                {TEMPLATE_ENTITY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ENTITY_LABELS[t]}
                  </option>
                ))}
              </select>
              <p className={hintCls}>Decides which placeholders are available.</p>
            </div>
          </div>
          {channel !== "sms" && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Subject / title
              </label>
              <input {...register("subject")} className={fieldError(!!errors.subject)} />
              <p className={hintCls}>Placeholders work here too. Max 200 characters.</p>
              {errors.subject && <p className={errCls}>{errors.subject.message}</p>}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Body</label>
            <textarea
              {...bodyField}
              ref={(el) => bindRef(el, bodyRef)}
              rows={8}
              className={fieldError(!!errors.body)}
            />
            <p className={hintCls}>
              Plain text with {"{{placeholders}}"}. Max 10,000 characters.
            </p>
            {errors.body && <p className={errCls}>{errors.body.message}</p>}
            <MergeChips
              entityType={entityType}
              onPreventBlur={preventBlur}
              onInsert={(key) =>
                insert(body ?? "", `{{${key}}}`, (next) =>
                  setValue("body", next, { shouldDirty: true, shouldValidate: true })
                )
              }
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="secondary" size="sm" loading={isPending}>
              <Save className="h-3.5 w-3.5" />
              Create template
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TemplatesManager({ templates }: { templates: MessageTemplateRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState<MessageTemplateRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [preview, setPreview] = useState<TemplatePreviewResult | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const doReset = (id: string) => {
    startTransition(async () => {
      const res = await resetTemplate(id);
      if (res.ok) toast.success("Template restored to the default copy");
      else toast.error(res.error);
      router.refresh();
    });
  };

  const doDelete = (id: string) => {
    startTransition(async () => {
      const res = await deleteTemplate(id);
      if (res.ok) toast.success("Template deleted");
      else toast.error(res.error);
      router.refresh();
    });
  };

  const doPreview = (id: string) => {
    startTransition(async () => {
      const res = await previewTemplate(id);
      setPreview(res);
      setPreviewOpen(true);
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setCreating(true)}
          title="Create a custom template for ad-hoc reminders or rules"
        >
          <Plus className="h-3.5 w-3.5" />
          New template
        </Button>
      </div>

      <ul className="space-y-2">
        {templates.map((t) => (
          <li
            key={t.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-surface-card p-3"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground truncate">{t.name}</span>
                <span className="rounded-full bg-surface-inset px-2 py-0.5 text-[10px] text-foreground-secondary">
                  {CHANNEL_LABELS[t.channel]}
                </span>
                <span className="rounded-full bg-surface-inset px-2 py-0.5 text-[10px] text-foreground-secondary">
                  {ENTITY_LABELS[t.entity_type]}
                </span>
              </div>
              <p className="text-[11px] text-foreground-muted mt-0.5 line-clamp-1">
                {t.subject || t.body}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => doPreview(t.id)}
                title="Render with real data from your latest matching record"
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditing(t)}>
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
              {t.is_default ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onClick={() => doReset(t.id)}
                  title="Restore the built-in default copy"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  className="text-red-600 hover:text-red-700"
                  onClick={() => doDelete(t.id)}
                  title="Delete this custom template"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {editing && (
        <EditTemplateDialog template={editing} open onClose={() => setEditing(null)} />
      )}
      <CreateTemplateDialog open={creating} onClose={() => setCreating(false)} />

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Template preview</DialogTitle>
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
