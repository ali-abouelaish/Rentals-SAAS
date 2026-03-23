"use client";

import { useState, useTransition } from "react";
import { Trash2, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { platformConfigSchema, type PlatformConfigValues } from "../domain/schemas";
import { createPlatformConfig, updatePlatformConfig, deletePlatformConfig } from "../actions/platforms";
import type { TenantPlatformConfig } from "../domain/types";

interface Props {
  configs: TenantPlatformConfig[];
}

export function PlatformConfigsCard({ configs }: Props) {
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<PlatformConfigValues>({
    resolver: zodResolver(platformConfigSchema),
    defaultValues: { platform_name: "", sender_domain: "", is_active: true },
  });

  const handleCreate = (values: PlatformConfigValues) => {
    startTransition(async () => {
      try {
        await createPlatformConfig(values);
        toast.success("Platform added");
        form.reset();
        setIsAddingNew(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to add platform");
      }
    });
  };

  const handleToggle = (config: TenantPlatformConfig) => {
    startTransition(async () => {
      try {
        await updatePlatformConfig(config.id, { is_active: !config.is_active });
        toast.success(`${config.platform_name} ${config.is_active ? "disabled" : "enabled"}`);
      } catch {
        toast.error("Failed to update platform");
      }
    });
  };

  const handleDelete = (config: TenantPlatformConfig) => {
    startTransition(async () => {
      try {
        await deletePlatformConfig(config.id);
        toast.success(`${config.platform_name} removed`);
      } catch {
        toast.error("Failed to remove platform");
      }
    });
  };

  return (
    <div className="rounded-bento bg-surface-card shadow-bento p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Platform Sources</h2>
        <button
          type="button"
          onClick={() => setIsAddingNew(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg hover:opacity-90 transition-opacity"
        >
          <Plus className="h-3.5 w-3.5" />
          Add platform
        </button>
      </div>

      {configs.length === 0 && !isAddingNew && (
        <p className="text-sm text-foreground-muted text-center py-4">
          No platforms configured. Add Zoopla or Rightmove to start capturing leads.
        </p>
      )}

      {configs.length > 0 && (
        <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
          {configs.map((config) => (
            <div key={config.id} className="flex items-center justify-between px-4 py-3 bg-surface-inset">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground capitalize">{config.platform_name}</p>
                <p className="text-xs text-foreground-muted font-mono">{config.sender_domain}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <button
                  type="button"
                  onClick={() => handleToggle(config)}
                  disabled={isPending}
                  className={`text-xs rounded-full px-2.5 py-1 border font-medium transition-colors ${
                    config.is_active
                      ? "bg-success-bg text-success-fg border-success-border"
                      : "bg-surface-card text-foreground-muted border-border"
                  }`}
                >
                  {config.is_active ? "Active" : "Inactive"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(config)}
                  disabled={isPending}
                  className="rounded-lg p-1.5 text-status-error-fg hover:bg-status-error-bg transition-colors disabled:opacity-50"
                  aria-label={`Remove ${config.platform_name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isAddingNew && (
        <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-3 pt-2 border-t border-border">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground-muted">Platform name</label>
              <input
                {...form.register("platform_name")}
                placeholder="e.g. zoopla"
                className="w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent"
              />
              {form.formState.errors.platform_name && (
                <p className="text-xs text-status-error-fg">{form.formState.errors.platform_name.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground-muted">Sender domain</label>
              <input
                {...form.register("sender_domain")}
                placeholder="e.g. zoopla.co.uk"
                className="w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent"
              />
              {form.formState.errors.sender_domain && (
                <p className="text-xs text-status-error-fg">{form.formState.errors.sender_domain.message}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => { setIsAddingNew(false); form.reset(); }}
              className="rounded-lg px-3 py-1.5 text-sm text-foreground-muted hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {isPending ? "Saving…" : "Add platform"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
