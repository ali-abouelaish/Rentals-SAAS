"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RULE_PRESETS } from "../domain/presets";
import { createRuleFromPreset } from "../actions/rules";

export function PresetLibrary({ existingPresetKeys }: { existingPresetKeys: string[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const existing = new Set(existingPresetKeys);

  const add = (key: string) => {
    startTransition(async () => {
      const res = await createRuleFromPreset(key);
      if (res.ok) {
        toast.success("Rule created (switched off) — review it, then try a dry run");
        router.push(`/automations/rules/${res.id}`);
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Preset library</h2>
        <p className="text-[11px] text-foreground-muted">
          Ready-made rules. Adding one creates it switched off so you can review and dry-run
          it first.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {RULE_PRESETS.map((preset) => {
          const added = existing.has(preset.key);
          return (
            <div
              key={preset.key}
              className="rounded-2xl border border-border bg-surface-card p-3 flex flex-col gap-2"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{preset.name}</p>
                <p className="text-[11px] text-foreground-muted mt-0.5">{preset.description}</p>
              </div>
              <div className="mt-auto">
                {added ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
                    <Check className="h-3 w-3" /> Added
                  </span>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => add(preset.key)}
                    title="Creates this rule switched off, ready to review"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add rule
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
