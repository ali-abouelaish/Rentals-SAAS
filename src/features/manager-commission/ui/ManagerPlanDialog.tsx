"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/features/helpdesk/ui/Field";
import { saveManagerPlan } from "../actions/manager-commission";
import { managerPlanSchema, type ManagerPlanValues } from "../domain/schemas";
import { APPLIES_TO_LABELS, type ManagerAppliesTo, type PoolCandidate } from "../domain/types";

const APPLIES_TO_HINTS: Record<ManagerAppliesTo, string> = {
  rentals: "Only rentals closed by the pool count.",
  bonuses: "Only bonuses earned by the pool count.",
  both: "Rentals and bonuses both count.",
};

export function ManagerPlanDialog({
  managerId,
  managerName,
  candidates,
  initial,
  minStartDate,
  trigger,
}: {
  managerId: string;
  managerName: string;
  candidates: PoolCandidate[];
  initial: ManagerPlanValues;
  /** The current version's start — a change can't start before it. */
  minStartDate: string | null;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();

  const form = useForm<ManagerPlanValues>({
    resolver: zodResolver(managerPlanSchema),
    defaultValues: initial,
  });
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = form;

  const picked = watch("agent_ids");
  const defaultPercent = watch("commission_percent");
  const pickedAgents = candidates.filter((c) => picked.includes(c.id));
  const moving = candidates.filter((c) => picked.includes(c.id) && c.current_manager_name);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? candidates.filter((c) => c.name.toLowerCase().includes(term)) : candidates;
  }, [candidates, search]);

  const onSubmit = (values: ManagerPlanValues) => {
    startTransition(async () => {
      const result = await saveManagerPlan(managerId, values);
      if (!result.ok) {
        toast.error("Couldn't save manager settings", { description: result.error, duration: 6000 });
        return;
      }
      toast.success("Manager settings saved", {
        description: `Applies to deals dated ${values.effective_from.split("-").reverse().join("/")} onwards.`,
      });
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          reset(initial);
          setSearch("");
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manager commission — {managerName}</DialogTitle>
          <DialogDescription>
            {managerName} earns this percentage on deals closed by the agents you pick. It&apos;s paid from the
            agency&apos;s share; the agents&apos; own commission doesn&apos;t change.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <Field
            id="mgr-percent"
            label="Manager percentage"
            hint="The default for every agent in the pool. Between 0.01 and 100, up to 2 decimals. Taken on each rental's net (after card fee and VAT) or each bonus amount."
            tooltip="Not capped by the agency's share: if an agent's commission is high, the agency can end up losing money on a deal. Admins see this as a red 'Company keeps' figure."
            error={errors.commission_percent?.message}
          >
            <div className="relative max-w-[10rem]">
              <Input
                id="mgr-percent"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                max="100"
                disabled={isPending}
                aria-invalid={Boolean(errors.commission_percent)}
                aria-describedby={errors.commission_percent ? "mgr-percent-error" : undefined}
                className="pr-8"
                {...register("commission_percent")}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-foreground-muted">
                %
              </span>
            </div>
          </Field>

          <Field
            id="mgr-applies-to"
            label="Applies to"
            hint="Which of the pool's deals the percentage is taken on."
            tooltip="Pick 'Rentals only' if the manager shouldn't share in landlord bonuses, or 'Bonuses only' for the reverse."
            error={errors.applies_to?.message}
          >
            <div id="mgr-applies-to" role="radiogroup" className="space-y-2">
              {(Object.keys(APPLIES_TO_LABELS) as ManagerAppliesTo[]).map((value) => (
                <label
                  key={value}
                  className="flex items-start gap-2.5 rounded-lg border border-border px-3 py-2.5 text-sm cursor-pointer hover:bg-surface-inset has-[:checked]:border-accent has-[:checked]:bg-surface-inset"
                >
                  <input
                    type="radio"
                    value={value}
                    disabled={isPending}
                    className="mt-0.5 h-4 w-4"
                    {...register("applies_to")}
                  />
                  <span>
                    <span className="block font-medium text-foreground">{APPLIES_TO_LABELS[value]}</span>
                    <span className="block text-xs text-foreground-muted">{APPLIES_TO_HINTS[value]}</span>
                  </span>
                </label>
              ))}
            </div>
          </Field>

          <Field
            id="mgr-pool"
            label="Agents in the pool"
            hint="Pick at least one. An agent can only be in one manager's pool at a time."
            tooltip="Picking an agent who is already in another manager's pool moves them here from the start date. Their earlier deals stay with the old manager."
            error={errors.agent_ids?.message}
          >
            <div className="space-y-2">
              <div>
                <label htmlFor="mgr-pool-search" className="block text-xs font-medium text-foreground-secondary">
                  Find an agent
                </label>
                <p className="text-xs text-foreground-muted mb-1">Filters the list by name; it isn&apos;t saved.</p>
                <Input
                  id="mgr-pool-search"
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoComplete="off"
                  disabled={isPending}
                />
              </div>
              <Controller
                control={control}
                name="agent_ids"
                render={({ field }) => (
                  <div
                    id="mgr-pool"
                    role="group"
                    aria-invalid={Boolean(errors.agent_ids)}
                    className="max-h-60 overflow-y-auto rounded-lg border border-border divide-y divide-border/60"
                  >
                    {visible.length === 0 ? (
                      <p className="px-3 py-4 text-center text-xs text-foreground-muted">
                        {candidates.length === 0 ? "No other agents in this agency yet." : "No agents match."}
                      </p>
                    ) : (
                      visible.map((c) => {
                        const checked = field.value.includes(c.id);
                        return (
                          <label
                            key={c.id}
                            className="flex items-center gap-2.5 px-3 py-2.5 md:py-2 text-sm cursor-pointer hover:bg-surface-inset"
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-border"
                              checked={checked}
                              disabled={isPending}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  field.onChange([...field.value, c.id]);
                                } else {
                                  field.onChange(field.value.filter((id) => id !== c.id));
                                  // Drop their own rate too, so a hidden value can't block saving.
                                  setValue(`agent_percents.${c.id}`, "");
                                }
                              }}
                              onBlur={field.onBlur}
                            />
                            <span className="flex-1 min-w-0 truncate text-foreground">{c.name}</span>
                            {c.is_disabled && (
                              <span className="text-xs text-foreground-muted">Disabled</span>
                            )}
                            {c.current_manager_name && (
                              <span className="text-xs text-amber-700 dark:text-amber-300 truncate max-w-[45%]">
                                Under {c.current_manager_name}
                              </span>
                            )}
                          </label>
                        );
                      })
                    )}
                  </div>
                )}
              />
              <p className="text-xs text-foreground-muted">{picked.length} selected</p>
              {moving.length > 0 && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                  {moving.map((m) => m.name).join(", ")} will move from their current manager on the start date.
                </p>
              )}
            </div>
          </Field>

          {pickedAgents.length > 0 && (
            <Field
              id="mgr-agent-rates"
              label="Percentage per agent"
              hint={`Optional. Leave an agent blank to use the manager percentage${
                defaultPercent ? ` (${defaultPercent}%)` : ""
              }, or enter a different rate for that agent.`}
              tooltip="Use this when the manager should take a bigger or smaller cut on certain agents, e.g. 10% on most of the team but 5% on a senior agent."
            >
              <div id="mgr-agent-rates" className="grid gap-3 sm:grid-cols-2">
                {pickedAgents.map((c) => {
                  const inputId = `mgr-rate-${c.id}`;
                  const error = errors.agent_percents?.[c.id]?.message;
                  return (
                    <div key={c.id}>
                      <label htmlFor={inputId} className="block text-sm font-medium text-foreground truncate">
                        {c.name}
                      </label>
                      <div className="relative mt-1 max-w-[9rem]">
                        <Input
                          id={inputId}
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          disabled={isPending}
                          aria-invalid={Boolean(error)}
                          aria-describedby={error ? `${inputId}-error` : `${inputId}-hint`}
                          className="pr-8"
                          {...register(`agent_percents.${c.id}`)}
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-foreground-muted">
                          %
                        </span>
                      </div>
                      <p id={`${inputId}-hint`} className="mt-1 text-xs text-foreground-muted">
                        Blank = {defaultPercent ? `${defaultPercent}%` : "manager percentage"}
                      </p>
                      {error && (
                        <p id={`${inputId}-error`} className="mt-1 text-xs text-red-600">
                          {error}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </Field>
          )}

          <Field
            id="mgr-from"
            label="Start date"
            hint={
              minStartDate
                ? `Deals dated on or after this day use these settings; earlier deals keep the old ones. Can't be before ${minStartDate.split("-").reverse().join("/")}.`
                : "Deals dated on or after this day earn the manager commission."
            }
            tooltip="Changes are dated so past earnings never get rewritten. Pick the first of next month to change terms from then."
            error={errors.effective_from?.message}
          >
            <Input
              id="mgr-from"
              type="date"
              min={minStartDate ?? undefined}
              disabled={isPending}
              aria-invalid={Boolean(errors.effective_from)}
              aria-describedby={errors.effective_from ? "mgr-from-error" : undefined}
              className="max-w-[12rem]"
              {...register("effective_from")}
            />
          </Field>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="secondary" loading={isPending} disabled={isPending}>
              Save manager settings
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
