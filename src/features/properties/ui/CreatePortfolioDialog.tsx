"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FolderPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createPortfolio, deletePortfolio } from "../actions/portfolios";
import { portfolioSchema, type PortfolioFormValues } from "../domain/schemas";
import type { Portfolio } from "../domain/types";

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#64748b",
];

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-surface-inset px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

interface ManagePortfoliosDialogProps {
  portfolios: Portfolio[];
  onCreated: (portfolio: Portfolio) => void;
  onDeleted: (id: string) => void;
}

export function ManagePortfoliosDialog({ portfolios, onCreated, onDeleted }: ManagePortfoliosDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<PortfolioFormValues>({
    resolver: zodResolver(portfolioSchema),
    defaultValues: { name: "", color: PRESET_COLORS[0] },
  });

  const selectedColor = watch("color");

  const onSubmit = (values: PortfolioFormValues) => {
    startTransition(async () => {
      try {
        const portfolio = await createPortfolio(values);
        toast.success("Portfolio created");
        onCreated(portfolio);
        reset({ name: "", color: PRESET_COLORS[0] });
      } catch (err) {
        toast.error("Failed to create portfolio", {
          description: err instanceof Error ? err.message : "Something went wrong.",
        });
      }
    });
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    startTransition(async () => {
      try {
        await deletePortfolio(id);
        toast.success("Portfolio deleted");
        onDeleted(id);
        setConfirmDeleteId(null);
      } catch (err) {
        toast.error("Failed to delete portfolio", {
          description: err instanceof Error ? err.message : "Something went wrong.",
        });
      } finally {
        setDeletingId(null);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FolderPlus className="h-4 w-4 mr-1.5" />
          Portfolios
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage portfolios</DialogTitle>
        </DialogHeader>

        {/* Existing portfolios */}
        {portfolios.length > 0 && (
          <div className="space-y-1 border border-border rounded-lg overflow-hidden">
            {portfolios.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between px-3 py-2 hover:bg-surface-inset transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="text-sm text-foreground">{p.name}</span>
                </div>

                {confirmDeleteId === p.id ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-foreground-muted">Delete?</span>
                    <button
                      type="button"
                      onClick={() => handleDelete(p.id)}
                      disabled={deletingId === p.id}
                      className="rounded px-2 py-0.5 text-xs font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
                    >
                      {deletingId === p.id ? "…" : "Yes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="rounded px-2 py-0.5 text-xs font-medium border border-border text-foreground-muted hover:text-foreground transition-colors"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(p.id)}
                    className="flex items-center justify-center h-7 w-7 rounded-md text-red-500 hover:bg-red-50 transition-colors"
                    title="Delete portfolio"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {portfolios.length === 0 && (
          <p className="text-sm text-foreground-muted text-center py-3">No portfolios yet.</p>
        )}

        {/* Create new */}
        <div className="border-t border-border pt-4 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">Create new</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Field label="Portfolio name" error={errors.name?.message}>
              <input
                {...register("name")}
                className={inputCls}
                placeholder="e.g. North London HMOs"
              />
            </Field>

            <Field label="Colour" error={errors.color?.message}>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setValue("color", hex)}
                    className="h-7 w-7 rounded-full border-2 transition-all"
                    style={{
                      backgroundColor: hex,
                      borderColor: selectedColor === hex ? hex : "transparent",
                      boxShadow: selectedColor === hex ? `0 0 0 2px white, 0 0 0 4px ${hex}` : "none",
                    }}
                    title={hex}
                  />
                ))}
              </div>

              {selectedColor && (
                <div className="mt-2">
                  <span
                    className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wide"
                    style={{
                      backgroundColor: `${selectedColor}22`,
                      color: selectedColor,
                      border: `1px solid ${selectedColor}44`,
                    }}
                  >
                    {watch("name") || "Preview"}
                  </span>
                </div>
              )}
            </Field>

            <div className="flex justify-end">
              <Button type="submit" variant="secondary" size="sm" loading={isPending}>
                Create portfolio
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
