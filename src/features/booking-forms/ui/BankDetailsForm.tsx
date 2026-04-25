"use client";

import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Landmark,
  ShieldCheck,
  Plus,
  Pencil,
  Trash2,
  Star,
  StarOff,
  Save,
  X,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { bankDetailsSchema, type BankDetailsValues } from "../domain/schemas";
import {
  createPortfolioBankDetails,
  updatePortfolioBankDetails,
  deletePortfolioBankDetails,
  setDefaultPortfolioBankDetails,
} from "../actions/bank-details";
import type { PortfolioBankDetails } from "../domain/types";
import type { Portfolio } from "@/features/properties/domain/types";

const inputCls =
  "w-full rounded-xl border bg-surface-card px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-brand/50";

const selectCls =
  "h-10 w-full rounded-xl border border-border bg-surface-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/50";

interface BankDetailsFormProps {
  portfolios: Portfolio[];
  bankDetails: PortfolioBankDetails[];
}

function emptyValues(): BankDetailsValues {
  return {
    label: "Main account",
    account_holder_name: "",
    account_number: "",
    sort_code: "",
    bank_name: "",
    payment_reference_hint: "",
  };
}

function toValues(d: PortfolioBankDetails): BankDetailsValues {
  return {
    label: d.label,
    account_holder_name: d.account_holder_name ?? "",
    account_number: d.account_number ?? "",
    sort_code: d.sort_code ?? "",
    bank_name: d.bank_name ?? "",
    payment_reference_hint: d.payment_reference_hint ?? "",
  };
}

export function BankDetailsForm({ portfolios, bankDetails }: BankDetailsFormProps) {
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(
    portfolios[0]?.id ?? null
  );
  const [details, setDetails] = useState<PortfolioBankDetails[]>(bankDetails);
  const [editorState, setEditorState] = useState<
    | { mode: "create"; portfolioId: string }
    | { mode: "edit"; row: PortfolioBankDetails }
    | null
  >(null);
  const [isPending, startTransition] = useTransition();

  const detailsForPortfolio = useMemo(
    () =>
      selectedPortfolioId
        ? details
            .filter((d) => d.portfolio_id === selectedPortfolioId)
            .sort((a, b) => {
              if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
              return a.created_at.localeCompare(b.created_at);
            })
        : [],
    [details, selectedPortfolioId]
  );

  const selectedPortfolio = portfolios.find((p) => p.id === selectedPortfolioId) ?? null;

  if (portfolios.length === 0) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading text-foreground">Bank Details</h1>
          <p className="text-sm text-foreground-secondary mt-0.5">
            Each portfolio can hold one or more bank accounts. Booking forms inherit the portfolio&apos;s default account.
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">No portfolios yet</p>
            <p className="mt-0.5 text-amber-800">
              Create a portfolio first, then come back here to attach bank accounts.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-heading text-foreground">Bank Details</h1>
        <p className="text-sm text-foreground-secondary mt-0.5">
          Each portfolio can hold one or more bank accounts. Booking forms inherit the portfolio&apos;s default account.
        </p>
      </div>

      {/* ── Portfolio picker ── */}
      <div className="rounded-bento bg-surface-card shadow-bento p-5">
        <label htmlFor="bank-details-portfolio-picker" className="block text-sm font-medium text-foreground mb-1.5">
          Portfolio
        </label>
        <select
          id="bank-details-portfolio-picker"
          className={selectCls}
          value={selectedPortfolioId ?? ""}
          onChange={(e) => {
            setSelectedPortfolioId(e.target.value || null);
            setEditorState(null);
          }}
        >
          {portfolios.map((p) => {
            const count = details.filter((d) => d.portfolio_id === p.id).length;
            return (
              <option key={p.id} value={p.id}>
                {p.name} {count > 0 ? `· ${count} account${count === 1 ? "" : "s"}` : "· no accounts yet"}
              </option>
            );
          })}
        </select>
      </div>

      {/* ── Account list + actions ── */}
      <div className="rounded-bento bg-surface-card shadow-bento overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
              <Landmark size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">
                Accounts for {selectedPortfolio?.name ?? "portfolio"}
              </p>
              <p className="text-xs text-foreground-secondary mt-0.5">
                The default account appears on every booking form for this portfolio.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              selectedPortfolioId &&
              setEditorState({ mode: "create", portfolioId: selectedPortfolioId })
            }
            disabled={!selectedPortfolioId || editorState !== null}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-inset px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-card disabled:opacity-50"
          >
            <Plus size={14} />
            Add account
          </button>
        </div>

        {detailsForPortfolio.length === 0 && editorState?.mode !== "create" ? (
          <div className="p-8 text-center text-sm text-foreground-muted">
            No accounts yet for this portfolio. Click <span className="font-medium">Add account</span> to set one up.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {detailsForPortfolio.map((row) => {
              const isEditingThis = editorState?.mode === "edit" && editorState.row.id === row.id;
              if (isEditingThis) {
                return (
                  <li key={row.id} className="px-6 py-5 bg-brand/[0.04]">
                    <BankAccountEditor
                      key={`edit-${row.id}`}
                      defaultValues={toValues(row)}
                      submitLabel="Save changes"
                      isPending={isPending}
                      onCancel={() => setEditorState(null)}
                      onSubmit={(values) => {
                        startTransition(async () => {
                          try {
                            await updatePortfolioBankDetails(row.id, values);
                            setDetails((prev) =>
                              prev.map((d) =>
                                d.id === row.id
                                  ? {
                                      ...d,
                                      label: values.label,
                                      account_holder_name: values.account_holder_name ?? null,
                                      account_number: values.account_number ?? null,
                                      sort_code: values.sort_code ?? null,
                                      bank_name: values.bank_name ?? null,
                                      payment_reference_hint: values.payment_reference_hint ?? null,
                                      updated_at: new Date().toISOString(),
                                    }
                                  : d
                              )
                            );
                            toast.success("Account updated");
                            setEditorState(null);
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Failed to update");
                          }
                        });
                      }}
                    />
                  </li>
                );
              }
              return (
                <li key={row.id} className="flex items-start justify-between gap-4 px-6 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground truncate">{row.label}</span>
                      {row.is_default && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-semibold">
                          <ShieldCheck size={10} />
                          Default
                        </span>
                      )}
                    </div>
                    <dl className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-foreground-secondary">
                      {row.account_holder_name && (
                        <div className="flex gap-2">
                          <dt className="text-foreground-muted shrink-0">Holder</dt>
                          <dd className="text-foreground truncate">{row.account_holder_name}</dd>
                        </div>
                      )}
                      {row.bank_name && (
                        <div className="flex gap-2">
                          <dt className="text-foreground-muted shrink-0">Bank</dt>
                          <dd className="text-foreground truncate">{row.bank_name}</dd>
                        </div>
                      )}
                      {row.sort_code && (
                        <div className="flex gap-2">
                          <dt className="text-foreground-muted shrink-0">Sort</dt>
                          <dd className="font-mono text-foreground">{row.sort_code}</dd>
                        </div>
                      )}
                      {row.account_number && (
                        <div className="flex gap-2">
                          <dt className="text-foreground-muted shrink-0">Account</dt>
                          <dd className="font-mono text-foreground">{row.account_number}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!row.is_default && (
                      <button
                        type="button"
                        title="Make default"
                        disabled={isPending}
                        onClick={() => {
                          startTransition(async () => {
                            try {
                              await setDefaultPortfolioBankDetails(row.id);
                              setDetails((prev) =>
                                prev.map((d) =>
                                  d.portfolio_id === row.portfolio_id
                                    ? { ...d, is_default: d.id === row.id }
                                    : d
                                )
                              );
                              toast.success("Default account updated");
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : "Failed");
                            }
                          });
                        }}
                        className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-inset"
                      >
                        <StarOff size={14} />
                      </button>
                    )}
                    {row.is_default && (
                      <span
                        title="Default account"
                        className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-amber-500"
                      >
                        <Star size={14} fill="currentColor" />
                      </span>
                    )}
                    <button
                      type="button"
                      title="Edit"
                      disabled={editorState !== null}
                      onClick={() => setEditorState({ mode: "edit", row })}
                      className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-inset disabled:opacity-50"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      disabled={isPending}
                      onClick={() => {
                        if (!confirm(`Delete the "${row.label}" account?`)) return;
                        startTransition(async () => {
                          try {
                            await deletePortfolioBankDetails(row.id);
                            setDetails((prev) => {
                              const removed = prev.find((d) => d.id === row.id);
                              const filtered = prev.filter((d) => d.id !== row.id);
                              if (removed?.is_default) {
                                const next = filtered
                                  .filter((d) => d.portfolio_id === removed.portfolio_id)
                                  .sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
                                if (next) {
                                  return filtered.map((d) =>
                                    d.id === next.id ? { ...d, is_default: true } : d
                                  );
                                }
                              }
                              return filtered;
                            });
                            toast.success("Account deleted");
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Failed to delete");
                          }
                        });
                      }}
                      className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {editorState?.mode === "create" && selectedPortfolioId && (
          <div className="px-6 py-5 bg-brand/[0.04] border-t border-border">
            <BankAccountEditor
              defaultValues={emptyValues()}
              submitLabel="Add account"
              isPending={isPending}
              onCancel={() => setEditorState(null)}
              onSubmit={(values) => {
                startTransition(async () => {
                  try {
                    const created = await createPortfolioBankDetails(selectedPortfolioId, values);
                    if (!created) throw new Error("Create failed");
                    const portfolioHasDefault = details.some(
                      (d) => d.portfolio_id === selectedPortfolioId && d.is_default
                    );
                    setDetails((prev) => [
                      ...prev,
                      {
                        id: created.id,
                        tenant_id: "",
                        portfolio_id: selectedPortfolioId,
                        label: values.label,
                        account_holder_name: values.account_holder_name ?? null,
                        account_number: values.account_number ?? null,
                        sort_code: values.sort_code ?? null,
                        bank_name: values.bank_name ?? null,
                        payment_reference_hint: values.payment_reference_hint ?? null,
                        is_default: !portfolioHasDefault,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                      },
                    ]);
                    toast.success("Account added");
                    setEditorState(null);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Failed to add");
                  }
                });
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

interface BankAccountEditorProps {
  defaultValues: BankDetailsValues;
  submitLabel: string;
  isPending: boolean;
  onSubmit: (values: BankDetailsValues) => void;
  onCancel: () => void;
}

function BankAccountEditor({
  defaultValues,
  submitLabel,
  isPending,
  onSubmit,
  onCancel,
}: BankAccountEditorProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BankDetailsValues>({
    resolver: zodResolver(bankDetailsSchema),
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">Account label</label>
        <input
          {...register("label")}
          placeholder="Main account"
          className={cn(inputCls, errors.label ? "border-red-400" : "border-border")}
        />
        {errors.label && <p className="text-xs text-red-600 mt-1">{errors.label.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">Account holder name</label>
        <input
          {...register("account_holder_name")}
          placeholder="Harbor Ops Ltd"
          className={cn(inputCls, errors.account_holder_name ? "border-red-400" : "border-border")}
        />
        {errors.account_holder_name && (
          <p className="text-xs text-red-600 mt-1">{errors.account_holder_name.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Bank name</label>
          <input
            {...register("bank_name")}
            placeholder="Barclays"
            className={cn(inputCls, errors.bank_name ? "border-red-400" : "border-border")}
          />
          {errors.bank_name && <p className="text-xs text-red-600 mt-1">{errors.bank_name.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Sort code</label>
          <input
            {...register("sort_code")}
            placeholder="12-34-56"
            inputMode="numeric"
            className={cn(inputCls, "font-mono", errors.sort_code ? "border-red-400" : "border-border")}
          />
          {errors.sort_code && <p className="text-xs text-red-600 mt-1">{errors.sort_code.message}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">Account number</label>
        <input
          {...register("account_number")}
          placeholder="12345678"
          inputMode="numeric"
          className={cn(inputCls, "font-mono", errors.account_number ? "border-red-400" : "border-border")}
        />
        {errors.account_number && (
          <p className="text-xs text-red-600 mt-1">{errors.account_number.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">Payment reference hint</label>
        <input
          {...register("payment_reference_hint")}
          placeholder="e.g. Use your full name + room number"
          className={cn(inputCls, errors.payment_reference_hint ? "border-red-400" : "border-border")}
        />
        {errors.payment_reference_hint && (
          <p className="text-xs text-red-600 mt-1">{errors.payment_reference_hint.message}</p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm text-foreground hover:bg-surface-inset"
        >
          <X size={14} />
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:opacity-90 disabled:opacity-60"
        >
          <Save size={14} />
          {isPending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
