"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { FileText, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteContractTemplate } from "../actions/templates";
import type { ContractTemplate } from "../domain/types";
import type { Portfolio } from "@/features/properties/domain/types";

interface Props {
  templates: ContractTemplate[];
  portfolios: Portfolio[];
}

export function TemplatesListPage({ templates, portfolios }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const portfolioMap = new Map(portfolios.map((p) => [p.id, p]));

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Delete template "${name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      try {
        await deleteContractTemplate(id);
        toast.success("Template deleted");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Delete failed");
      }
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Contract Templates</h1>
          <p className="text-sm text-foreground-secondary mt-1">
            Upload contract PDFs, mark dynamic fields once, and re-stamp them with booking data on demand.
          </p>
        </div>
        <Link href="/contracts/templates/new">
          <Button variant="secondary">
            <Plus size={16} /> New template
          </Button>
        </Link>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-card py-16 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 mb-4">
            <FileText className="h-7 w-7 text-brand" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-2">No templates yet</p>
          <p className="text-xs text-foreground-secondary max-w-sm mx-auto leading-relaxed mb-4">
            Upload a tenancy contract PDF, mark the parts that change per tenant (name, rent, dates), and we&apos;ll
            stamp those fields automatically from each approved booking.
          </p>
          <Link href="/contracts/templates/new">
            <Button variant="secondary">
              <Plus size={16} /> Upload your first template
            </Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface-card divide-y divide-border overflow-hidden">
          {templates.map((t) => {
            const portfolio = t.portfolio_id ? portfolioMap.get(t.portfolio_id) : null;
            return (
              <div key={t.id} className="flex items-center justify-between p-4 hover:bg-surface-inset transition">
                <Link href={`/contracts/templates/${t.id}`} className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-brand/10 text-brand flex items-center justify-center shrink-0">
                      <FileText size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground text-sm truncate">{t.name}</p>
                      <p className="text-xs text-foreground-secondary">
                        {t.page_count} page{t.page_count === 1 ? "" : "s"}
                        {portfolio && (
                          <>
                            {" · "}
                            <span style={{ color: portfolio.color }}>{portfolio.name}</span>
                          </>
                        )}
                        {!t.is_active && " · Inactive"}
                      </p>
                    </div>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(t.id, t.name)}
                  disabled={isPending}
                  className="ml-3 inline-flex items-center justify-center h-8 w-8 rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-50"
                  aria-label="Delete template"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
