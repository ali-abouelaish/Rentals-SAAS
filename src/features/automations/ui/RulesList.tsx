"use client";

import Link from "next/link";
import { Mail, Bell, MessageSquare, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { describeTrigger, ruleMode, type RuleMode } from "../domain/rules";
import type { RuleListItem } from "../data/rules";

const MODE_BADGE: Record<RuleMode, { label: string; cls: string }> = {
  off: { label: "Off", cls: "bg-surface-inset text-foreground-muted" },
  dry_run: { label: "Dry run", cls: "bg-amber-100 text-amber-700" },
  live: { label: "Live", cls: "bg-emerald-100 text-emerald-700" },
};

export function RulesList({ rules }: { rules: RuleListItem[] }) {
  if (rules.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface-card p-8 text-center text-sm text-foreground-muted">
        No rules yet — add one from the preset library below to get started.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {rules.map((rule) => {
        const mode = MODE_BADGE[ruleMode(rule)];
        return (
          <li key={rule.id}>
            <Link
              href={`/automations/rules/${rule.id}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface-card p-3 sm:p-4 hover:bg-surface-inset transition-colors"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {rule.channel === "email" ? (
                    <Mail className="h-3.5 w-3.5 text-foreground-secondary" />
                  ) : rule.channel === "sms" ? (
                    <MessageSquare className="h-3.5 w-3.5 text-foreground-secondary" />
                  ) : (
                    <Bell className="h-3.5 w-3.5 text-foreground-secondary" />
                  )}
                  <span className="text-sm font-medium text-foreground truncate">
                    {rule.name}
                  </span>
                  <span
                    className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", mode.cls)}
                  >
                    {mode.label}
                  </span>
                </div>
                <p className="text-[11px] text-foreground-muted mt-1">
                  {describeTrigger(rule.trigger_config)}
                  {rule.repeat_config &&
                    ` · repeats every ${rule.repeat_config.every_days} day${rule.repeat_config.every_days === 1 ? "" : "s"} until cleared`}
                  {rule.template_name && ` · template: ${rule.template_name}`}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-foreground-muted shrink-0" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
