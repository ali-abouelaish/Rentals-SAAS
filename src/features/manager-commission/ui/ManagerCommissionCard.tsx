"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Pencil, UserCheck, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { Field } from "@/features/helpdesk/ui/Field";
import { endManagerPlan } from "../actions/manager-commission";
import { endManagerPlanSchema, type EndManagerPlanValues } from "../domain/schemas";
import { APPLIES_TO_LABELS, type ManagerPlanWithAgents, type PoolCandidate } from "../domain/types";
import { ManagerPlanDialog } from "./ManagerPlanDialog";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function ukDate(iso: string) {
  return iso.split("-").reverse().join("/");
}

function EndManagerDialog({ managerId, managerName }: { managerId: string; managerName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EndManagerPlanValues>({
    resolver: zodResolver(endManagerPlanSchema),
    defaultValues: { end_date: today() },
  });

  const onSubmit = (values: EndManagerPlanValues) => {
    startTransition(async () => {
      const result = await endManagerPlan(managerId, values);
      if (!result.ok) {
        toast.error("Couldn't end manager role", { description: result.error, duration: 6000 });
        return;
      }
      toast.success(`${managerName} stops earning manager commission after ${ukDate(values.end_date)}`);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset({ end_date: today() });
      }}
    >
      <Tooltip content="Stops future earnings. Everything earned up to the last day stays, including unpaid lines.">
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <UserMinus className="h-4 w-4" />
            End manager role
          </Button>
        </DialogTrigger>
      </Tooltip>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>End manager role</DialogTitle>
          <DialogDescription>
            {managerName} keeps what they earned up to the last day. Their agents are freed up to join another
            manager&apos;s pool from the day after.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field
            id="mgr-end"
            label="Last day of manager commission"
            hint="Deals dated after this day earn nothing. A date before the current terms started cancels them."
            error={errors.end_date?.message}
          >
            <Input
              id="mgr-end"
              type="date"
              disabled={isPending}
              aria-invalid={Boolean(errors.end_date)}
              aria-describedby={errors.end_date ? "mgr-end-error" : undefined}
              className="max-w-[12rem]"
              {...register("end_date")}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="secondary" loading={isPending} disabled={isPending}>
              End manager role
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Admin card on an agent's profile: make them a manager, change their
 * percentage / scope / pool from a date, or end the role.
 */
export function ManagerCommissionCard({
  managerId,
  managerName,
  history,
  candidates,
}: {
  managerId: string;
  managerName: string;
  /** Every version, newest first. */
  history: ManagerPlanWithAgents[];
  candidates: PoolCandidate[];
}) {
  const [showHistory, setShowHistory] = useState(false);
  const now = today();
  // The version in force today or, failing that, one starting in the future.
  const current =
    history.find((p) => p.effective_from <= now && (p.effective_to === null || p.effective_to >= now)) ??
    history.find((p) => p.effective_from > now) ??
    null;
  const isOpen = current !== null && current.effective_to === null;
  const past = history.filter((p) => p.id !== current?.id);

  // Default start for a change: today, but never inside terms that are
  // already fixed (a future start, or an end date still to come).
  const fixedUntil = !current
    ? null
    : isOpen
      ? current.effective_from > now
        ? current.effective_from
        : null
      : addDays(current.effective_to as string, 1);
  const minStart = fixedUntil && fixedUntil > now ? fixedUntil : now;
  const initial = {
    commission_percent: current?.commission_percent ?? 10,
    applies_to: current?.applies_to ?? ("rentals" as const),
    agent_ids: current?.agent_ids ?? [],
    agent_percents: Object.fromEntries(
      (current?.agents ?? [])
        .filter((a) => a.commission_percent !== null)
        .map((a) => [a.id, String(a.commission_percent)])
    ),
    effective_from: minStart,
  };

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-brand" />
              <p className="text-sm font-medium text-brand">Manager commission</p>
            </div>
            <p className="mt-1 text-xs text-foreground-muted">
              A percentage of the deals closed by a pool of agents, paid from the agency&apos;s share.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ManagerPlanDialog
              managerId={managerId}
              managerName={managerName}
              candidates={candidates}
              initial={initial}
              minStartDate={isOpen && current ? current.effective_from : null}
              trigger={
                <Button variant="secondary" size="sm" className="gap-1.5">
                  <Pencil className="h-4 w-4" />
                  {isOpen ? "Change terms" : "Set up as manager"}
                </Button>
              }
            />
            {isOpen && <EndManagerDialog managerId={managerId} managerName={managerName} />}
          </div>
        </div>

        {current ? (
          <div className="rounded-xl border border-border bg-surface-inset p-4 space-y-3 text-sm">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-foreground-muted mb-1">Default percentage</p>
                <p className="font-semibold text-foreground">{current.commission_percent}%</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-foreground-muted mb-1">Applies to</p>
                <p className="text-foreground">{APPLIES_TO_LABELS[current.applies_to]}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-foreground-muted mb-1">In force</p>
                <p className="text-foreground">
                  {current.effective_from > now ? "Starts " : "Since "}
                  {ukDate(current.effective_from)}
                  {current.effective_to && ` · ends ${ukDate(current.effective_to)}`}
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-foreground-muted mb-1.5">
                Pool ({current.agents.length})
              </p>
              {current.agents.length === 0 ? (
                <p className="text-xs text-foreground-muted">
                  No agents in the pool. Add some with &ldquo;Change terms&rdquo;.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {current.agents.map((a) => (
                    <span
                      key={a.id}
                      className="inline-flex items-center gap-1 rounded-full bg-surface-card border border-border px-2.5 py-1 text-xs font-medium text-foreground"
                    >
                      {a.name}
                      <span
                        className={
                          a.commission_percent !== null
                            ? "rounded-full bg-teal-50 px-1.5 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300"
                            : "text-foreground-muted"
                        }
                      >
                        {a.commission_percent ?? current.commission_percent}%
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-foreground-muted">{managerName} isn&apos;t a manager.</p>
        )}

        {past.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              aria-expanded={showHistory}
              className="inline-flex items-center gap-1 text-xs font-medium text-foreground-secondary hover:text-foreground min-h-11 md:min-h-0"
            >
              {showHistory ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              Earlier terms ({past.length})
            </button>
            {showHistory && (
              <ul className="mt-2 space-y-2 text-xs">
                {past.map((p) => (
                  <li key={p.id} className="rounded-lg border border-border px-3 py-2">
                    <p className="font-medium text-foreground">
                      {ukDate(p.effective_from)} – {p.effective_to ? ukDate(p.effective_to) : "open"} ·{" "}
                      {p.commission_percent}% · {APPLIES_TO_LABELS[p.applies_to]}
                    </p>
                    <p className="text-foreground-muted mt-0.5">
                      {p.agents.length > 0
                        ? p.agents
                            .map((a) => (a.commission_percent !== null ? `${a.name} (${a.commission_percent}%)` : a.name))
                            .join(", ")
                        : "No agents"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
