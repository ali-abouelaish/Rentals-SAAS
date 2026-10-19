"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { uploadContractTemplate } from "../actions/templates";
import { TEMPLATE_MAX_BYTES, uploadTemplateMetaSchema } from "../domain/schemas";
import { FieldError } from "./ContractGenerationFields";
import type { Portfolio } from "@/features/properties/domain/types";

interface Props {
  portfolios: Portfolio[];
}

// FileList doesn't exist during server rendering.
const isFileList = (v: unknown): v is FileList => typeof FileList !== "undefined" && v instanceof FileList;

// The metadata rules are the server's own; the file rules mirror its checks.
const uploadFormSchema = uploadTemplateMetaSchema.extend({
  file: z
    .custom<FileList>()
    .refine((files) => isFileList(files) && files.length === 1, "Choose your contract PDF")
    .refine(
      (files) => !isFileList(files) || !files[0] || files[0].type.includes("pdf") || files[0].name.toLowerCase().endsWith(".pdf"),
      "Only PDF files are accepted",
    )
    .refine(
      (files) => !isFileList(files) || !files[0] || files[0].size <= TEMPLATE_MAX_BYTES,
      `File too large (max ${TEMPLATE_MAX_BYTES / 1024 / 1024}MB)`,
    ),
});
type UploadFormValues = z.infer<typeof uploadFormSchema>;

const inputCls = (hasError: boolean) =>
  `w-full rounded-lg border bg-surface-inset px-3 py-2.5 md:py-2 text-base md:text-sm focus:outline-none focus:ring-2 ${
    hasError ? "border-red-400 focus:ring-red-500/20" : "border-border focus:ring-accent/30 focus:border-accent"
  }`;

export function UploadTemplateForm({ portfolios }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UploadFormValues>({
    resolver: zodResolver(uploadFormSchema),
    defaultValues: { name: "", description: "", portfolio_id: "" },
  });

  const onSubmit = handleSubmit(
    (values) => {
      const formData = new FormData();
      formData.set("name", values.name.trim());
      formData.set("description", values.description.trim());
      formData.set("portfolio_id", values.portfolio_id);
      formData.set("file", values.file[0]);

      startTransition(async () => {
        const res = await uploadContractTemplate(formData);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success("Template uploaded — add fields next");
        router.push(`/contracts/templates/${res.templateId}`);
      });
    },
    () => toast.error("Please fix the highlighted fields."),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5 rounded-xl border border-border bg-surface-card p-6 max-w-2xl">
      <div className="space-y-1.5">
        <label htmlFor="tmpl-name" className="text-sm font-medium text-foreground">
          Template name *
        </label>
        <p id="tmpl-name-hint" className="text-xs text-foreground-secondary">
          How it appears when picking a template. Max 120 characters.
        </p>
        <input
          id="tmpl-name"
          placeholder="e.g. AST — 12 month, Acton portfolio"
          aria-invalid={!!errors.name}
          aria-describedby="tmpl-name-hint tmpl-name-error"
          className={inputCls(!!errors.name)}
          {...register("name")}
        />
        <FieldError id="tmpl-name-error" message={errors.name?.message} />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="tmpl-desc" className="text-sm font-medium text-foreground">
          Description
        </label>
        <p id="tmpl-desc-hint" className="text-xs text-foreground-secondary">
          Optional note for your team, e.g. which tenancies it&apos;s for. Max 2000 characters.
        </p>
        <textarea
          id="tmpl-desc"
          rows={2}
          aria-invalid={!!errors.description}
          aria-describedby="tmpl-desc-hint tmpl-desc-error"
          className={`${inputCls(!!errors.description)} resize-none`}
          {...register("description")}
        />
        <FieldError id="tmpl-desc-error" message={errors.description?.message} />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="tmpl-portfolio" className="text-sm font-medium text-foreground">
          Default portfolio
        </label>
        <p id="tmpl-portfolio-hint" className="text-xs text-foreground-secondary">
          Restrict this template to bookings from a specific portfolio. Leave blank to make it available everywhere.
        </p>
        <select
          id="tmpl-portfolio"
          aria-invalid={!!errors.portfolio_id}
          aria-describedby="tmpl-portfolio-hint tmpl-portfolio-error"
          className={inputCls(!!errors.portfolio_id)}
          {...register("portfolio_id")}
        >
          <option value="">All portfolios</option>
          {portfolios.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <FieldError id="tmpl-portfolio-error" message={errors.portfolio_id?.message} />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="tmpl-file" className="text-sm font-medium text-foreground">
          Contract PDF *
        </label>
        <p id="tmpl-file-hint" className="text-xs text-foreground-secondary">
          Max 20 pages, up to 10MB. No rotated pages or password protection.
        </p>
        <input
          id="tmpl-file"
          type="file"
          accept="application/pdf,.pdf"
          aria-invalid={!!errors.file}
          aria-describedby="tmpl-file-hint tmpl-file-error"
          className="min-h-11 sm:min-h-0 block w-full text-sm text-foreground-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-surface-inset file:px-4 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-surface-card"
          {...register("file")}
        />
        <FieldError id="tmpl-file-error" message={errors.file?.message as string | undefined} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Tooltip content="Uploads the PDF and opens the editor, where you mark the fields that change per tenancy.">
          <Button type="submit" variant="secondary" loading={isPending}>
            Upload &amp; continue
          </Button>
        </Tooltip>
      </div>
    </form>
  );
}
