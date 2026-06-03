"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { uploadContractTemplate } from "../actions/templates";
import type { Portfolio } from "@/features/properties/domain/types";

interface Props {
  portfolios: Portfolio[];
}

export function UploadTemplateForm({ portfolios }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [portfolioId, setPortfolioId] = useState<string>("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error("Please select a PDF file");
      return;
    }
    if (!name.trim()) {
      toast.error("Template name is required");
      return;
    }

    const formData = new FormData();
    formData.set("name", name.trim());
    formData.set("description", description.trim());
    if (portfolioId) formData.set("portfolio_id", portfolioId);
    formData.set("file", file);

    startTransition(async () => {
      try {
        const { templateId } = await uploadContractTemplate(formData);
        toast.success("Template uploaded — add fields next");
        router.push(`/contracts/templates/${templateId}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-border bg-surface-card p-6 max-w-2xl">
      <div className="space-y-2">
        <label htmlFor="tmpl-name" className="text-sm font-medium text-foreground">
          Template name *
        </label>
        <input
          id="tmpl-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. AST — 12 month, Acton portfolio"
          className="w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          required
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="tmpl-desc" className="text-sm font-medium text-foreground">
          Description
        </label>
        <textarea
          id="tmpl-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent resize-none"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="tmpl-portfolio" className="text-sm font-medium text-foreground">
          Default portfolio
        </label>
        <select
          id="tmpl-portfolio"
          value={portfolioId}
          onChange={(e) => setPortfolioId(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
        >
          <option value="">All portfolios</option>
          {portfolios.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-foreground-secondary">
          Restrict this template to bookings from a specific portfolio. Leave blank to make it available everywhere.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="tmpl-file" className="text-sm font-medium text-foreground">
          Contract PDF *
        </label>
        <input
          id="tmpl-file"
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-foreground-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-surface-inset file:px-4 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-surface-card"
          required
        />
        <p className="text-xs text-foreground-secondary">
          Max 20 pages, up to 10MB. Avoid rotated pages.
        </p>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" variant="secondary" loading={isPending}>
          Upload &amp; continue
        </Button>
      </div>
    </form>
  );
}
