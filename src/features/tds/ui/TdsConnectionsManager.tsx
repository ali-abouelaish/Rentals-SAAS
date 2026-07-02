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
  saveTdsConnectionAction,
  verifyTdsConnectionAction,
  deleteTdsConnectionAction,
} from "../actions/connection";
import type { TdsAgencyRow } from "../domain/types";

type FormState = {
  environment: string;
  memberId: string;
  branchId: string;
  apiKey: string;
  region: string;
  schemeType: string;
  accountLabel: string;
};

function blankForm(): FormState {
  return {
    environment: "sandbox",
    memberId: "",
    branchId: "0",
    apiKey: "",
    region: "EW",
    schemeType: "Custodial",
    accountLabel: "",
  };
}

function ConnectionBadge({ row }: { row: TdsAgencyRow }) {
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

export function TdsConnectionsManager({ agencies }: { agencies: TdsAgencyRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState<TdsAgencyRow | null>(null);
  const [form, setForm] = useState<FormState>(blankForm());

  const openDialog = (row: TdsAgencyRow) => {
    const conn = row.connection;
    setForm(
      conn
        ? {
            environment: conn.environment,
            memberId: conn.member_id,
            branchId: conn.branch_id,
            apiKey: "", // blank = keep existing key
            region: conn.region,
            schemeType: conn.scheme_type,
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
      const result = await saveTdsConnectionAction({
        tenantId: editing.tenant.id,
        environment: form.environment,
        memberId: form.memberId,
        branchId: form.branchId,
        apiKey: form.apiKey,
        region: form.region,
        schemeType: form.schemeType,
        accountLabel: form.accountLabel,
      });
      if (!result.ok) {
        toast.error("Could not save credentials", { description: result.error });
        return;
      }
      toast.success("TDS credentials verified and saved");
      closeDialog();
      router.refresh();
    });
  };

  const onVerify = (row: TdsAgencyRow) => {
    startTransition(async () => {
      const result = await verifyTdsConnectionAction({ tenantId: row.tenant.id });
      if (!result.ok) {
        toast.error("Verification failed", { description: result.error });
        router.refresh();
        return;
      }
      toast.success("Credentials verified");
      router.refresh();
    });
  };

  const onDelete = (row: TdsAgencyRow) => {
    if (
      !window.confirm(
        `Remove TDS credentials for ${row.tenant.name}? This cannot be undone.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await deleteTdsConnectionAction({ tenantId: row.tenant.id });
      if (!result.ok) {
        toast.error("Could not remove credentials", { description: result.error });
        return;
      }
      toast.success("TDS credentials removed");
      router.refresh();
    });
  };

  if (agencies.length === 0) {
    return (
      <p className="text-sm text-foreground-muted">No agencies found.</p>
    );
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
                      <span className="text-foreground-muted">Environment:</span> {conn.environment}
                      {" · "}
                      <span className="text-foreground-muted">Region:</span> {conn.region}
                      {" · "}
                      <span className="text-foreground-muted">Scheme:</span> {conn.scheme_type}
                    </p>
                    <p>
                      <span className="text-foreground-muted">Member ID:</span> {conn.member_id}
                      {" · "}
                      <span className="text-foreground-muted">Branch ID:</span> {conn.branch_id}
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
                    No TDS credentials stored for this agency yet.
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
                      title="Re-check the stored credentials against the TDS API"
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
                      title="Remove the stored TDS credentials for this agency"
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
              {isEdit ? "Edit TDS credentials" : "Add TDS credentials"}
            </DialogTitle>
            <DialogDescription>
              {editing ? `For ${editing.tenant.name}.` : ""} Credentials are verified against
              the TDS API before they are saved.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Select
              label="Environment"
              value={form.environment}
              onChange={(v: string) => setField("environment", v)}
              disabled={isPending}
              options={[
                { label: "Sandbox", value: "sandbox" },
                { label: "Production", value: "production" },
              ]}
            />

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Member ID</label>
              <Input
                value={form.memberId}
                onChange={(e) => setField("memberId", e.target.value)}
                placeholder="e.g. 188832"
                disabled={isPending}
              />
              <p className="text-xs text-foreground-muted">
                The agency&apos;s TDS member ID, supplied by TDS Custodial (1–6 characters).
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Branch ID</label>
              <Input
                value={form.branchId}
                onChange={(e) => setField("branchId", e.target.value)}
                placeholder="0"
                disabled={isPending}
              />
              <p className="text-xs text-foreground-muted">
                Use <span className="font-mono">0</span> for single-branch members; multi-branch
                members have a distinct branch ID from TDS.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">API key</label>
              <Input
                type="password"
                value={form.apiKey}
                onChange={(e) => setField("apiKey", e.target.value)}
                placeholder={isEdit ? "Leave blank to keep existing key" : "ABCDE-12345-FGHIJ-67890-KLMNO"}
                disabled={isPending}
                autoComplete="off"
              />
              <p className="text-xs text-foreground-muted">
                The agency&apos;s secret TDS API key. Stored encrypted; never shown again after
                saving.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Region"
                value={form.region}
                onChange={(v: string) => setField("region", v)}
                disabled={isPending}
                options={[
                  { label: "England & Wales", value: "EW" },
                  { label: "Northern Ireland", value: "NI" },
                ]}
              />
              <Select
                label="Scheme type"
                value={form.schemeType}
                onChange={(v: string) => setField("schemeType", v)}
                disabled={isPending}
                options={[
                  { label: "Custodial", value: "Custodial" },
                  { label: "Insured", value: "Insured" },
                ]}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Label (optional)</label>
              <Input
                value={form.accountLabel}
                onChange={(e) => setField("accountLabel", e.target.value)}
                placeholder="Internal note, e.g. 'Head office account'"
                disabled={isPending}
              />
            </div>

            <Button
              variant="secondary"
              onClick={onSave}
              disabled={isPending || !form.memberId.trim()}
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
