"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/formatters";
import {
  saveDpsConnectionAction,
  verifyDpsConnectionAction,
  deleteDpsConnectionAction,
} from "../actions/connection";
import type { DpsAgencyRow } from "../domain/types";

type FormState = {
  environment: string;
  agentLandlordId: string;
  clientId: string;
  clientSecret: string;
  accountLabel: string;
};

function blankForm(): FormState {
  return {
    environment: "uat",
    agentLandlordId: "",
    clientId: "",
    clientSecret: "",
    accountLabel: "",
  };
}

function ConnectionBadge({ row }: { row: DpsAgencyRow }) {
  const conn = row.connection;
  let label = "Not connected";
  let className = "bg-surface-inset text-foreground-muted border-border";
  let Icon = KeyRound;

  if (conn) {
    if (conn.last_error) {
      label = "Error";
      className = "bg-error-bg text-error-fg border-error-border";
      Icon = AlertCircle;
    } else if (conn.last_verified_at) {
      label = "Connected";
      className = "bg-success-bg text-success-fg border-success-border";
      Icon = CheckCircle2;
    } else {
      label = "Saved";
      className = "bg-info-bg text-info-fg border-info-border";
      Icon = KeyRound;
    }
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

export function DpsConnectionsManager({ agencies }: { agencies: DpsAgencyRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState<DpsAgencyRow | null>(null);
  const [form, setForm] = useState<FormState>(blankForm());

  const openDialog = (row: DpsAgencyRow) => {
    const conn = row.connection;
    setForm(
      conn
        ? {
            environment: conn.environment,
            agentLandlordId: conn.agent_landlord_id,
            clientId: conn.client_id,
            clientSecret: "", // blank = keep existing secret
            accountLabel: conn.account_label ?? "",
          }
        : blankForm()
    );
    setEditing(row);
  };

  const closeDialog = () => setEditing(null);

  const setField = (key: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const onSave = () => {
    if (!editing) return;
    startTransition(async () => {
      const result = await saveDpsConnectionAction({
        tenantId: editing.tenant.id,
        environment: form.environment,
        agentLandlordId: form.agentLandlordId,
        clientId: form.clientId,
        clientSecret: form.clientSecret,
        accountLabel: form.accountLabel,
      });
      if (!result.ok) {
        toast.error("Could not save credentials", { description: result.error });
        return;
      }
      toast.success("DPS credentials verified and saved");
      closeDialog();
      router.refresh();
    });
  };

  const onVerify = (row: DpsAgencyRow) => {
    startTransition(async () => {
      const result = await verifyDpsConnectionAction({ tenantId: row.tenant.id });
      if (!result.ok) {
        toast.error("Verification failed", { description: result.error });
        router.refresh();
        return;
      }
      toast.success("Credentials verified");
      router.refresh();
    });
  };

  const onDelete = (row: DpsAgencyRow) => {
    if (
      !window.confirm(
        `Remove DPS credentials for ${row.tenant.name}? This cannot be undone.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await deleteDpsConnectionAction({ tenantId: row.tenant.id });
      if (!result.ok) {
        toast.error("Could not remove credentials", { description: result.error });
        return;
      }
      toast.success("DPS credentials removed");
      router.refresh();
    });
  };

  if (agencies.length === 0) {
    return <p className="text-sm text-foreground-muted">No agencies found.</p>;
  }

  const isEdit = Boolean(editing?.connection);

  return (
    <div className="space-y-3">
      {agencies.map((row) => {
        const conn = row.connection;
        return (
          <div
            key={row.tenant.id}
            className="rounded-xl border border-border bg-surface-card p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{row.tenant.name}</p>
                  <ConnectionBadge row={row} />
                </div>
                <p className="text-xs text-foreground-muted mt-0.5 font-mono">{row.tenant.slug}</p>

                {conn ? (
                  <div className="text-xs text-foreground-secondary mt-2 space-y-0.5">
                    <p>
                      <span className="text-foreground-muted">Environment:</span>{" "}
                      {conn.environment === "uat" ? "Test (UAT)" : "Production"}
                      {" · "}
                      <span className="text-foreground-muted">Agent/Landlord ID:</span>{" "}
                      {conn.agent_landlord_id}
                    </p>
                    <p>
                      <span className="text-foreground-muted">Client ID:</span> {conn.client_id}
                    </p>
                    {conn.account_label && (
                      <p>
                        <span className="text-foreground-muted">Label:</span> {conn.account_label}
                      </p>
                    )}
                    {conn.last_verified_at && !conn.last_error && (
                      <p className="text-success-fg">
                        Last verified {formatDate(conn.last_verified_at)}
                      </p>
                    )}
                    {conn.last_error && (
                      <p className="text-error-fg">Error: {conn.last_error}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-foreground-muted mt-2">
                    No DPS credentials stored for this agency yet.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {conn ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onVerify(row)}
                      disabled={isPending}
                      title="Re-check the stored credentials by requesting a fresh DPS access token"
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                      Re-test
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openDialog(row)}
                      disabled={isPending}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1.5" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => onDelete(row)}
                      disabled={isPending}
                      title="Remove the stored DPS credentials for this agency"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      Remove
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => openDialog(row)}
                    disabled={isPending}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Add credentials
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Edit DPS credentials" : "Add DPS credentials"}
            </DialogTitle>
            <DialogDescription>
              {editing ? `For ${editing.tenant.name}.` : ""} Credentials are verified against
              the DPS token endpoint before they are saved.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Select
              label="Environment"
              value={form.environment}
              onChange={(v: string) => setField("environment", v)}
              disabled={isPending}
              options={[
                { label: "Test (UAT)", value: "uat" },
                { label: "Production", value: "production" },
              ]}
            />

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Agent/Landlord ID</label>
              <Input
                value={form.agentLandlordId}
                onChange={(e) => setField("agentLandlordId", e.target.value)}
                placeholder="e.g. 4251118"
                disabled={isPending}
                inputMode="numeric"
                maxLength={7}
              />
              <p className="text-xs text-foreground-muted">
                The agency&apos;s 7-digit DPS account number. Exactly 7 digits — note it is
                only checked by DPS when the first tenancy is submitted, not at save time.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Client ID</label>
              <Input
                value={form.clientId}
                onChange={(e) => setField("clientId", e.target.value)}
                placeholder="From the first DPS keys email"
                disabled={isPending}
              />
              <p className="text-xs text-foreground-muted">
                Sent by DPS in its own email when the agency requests API access from
                their account manager.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Client secret</label>
              <Input
                type="password"
                value={form.clientSecret}
                onChange={(e) => setField("clientSecret", e.target.value)}
                placeholder={isEdit ? "Leave blank to keep existing secret" : "From the second DPS keys email"}
                disabled={isPending}
                autoComplete="off"
              />
              <p className="text-xs text-foreground-muted">
                Use the secret matching the environment above (DPS issues separate test and
                live secrets). Stored encrypted; never shown again after saving.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Label (optional)</label>
              <Input
                value={form.accountLabel}
                onChange={(e) => setField("accountLabel", e.target.value)}
                placeholder="Internal note, e.g. 'Head office account'"
                disabled={isPending}
              />
              <p className="text-xs text-foreground-muted">
                Free-text note for super admins; not sent to DPS.
              </p>
            </div>

            <Button
              variant="secondary"
              onClick={onSave}
              disabled={
                isPending || !form.clientId.trim() || !/^\d{7}$/.test(form.agentLandlordId.trim())
              }
              loading={isPending}
              className="w-full"
            >
              Verify &amp; save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
