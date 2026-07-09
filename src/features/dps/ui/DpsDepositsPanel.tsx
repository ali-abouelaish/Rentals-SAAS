import Link from "next/link";
import { ShieldCheck, AlertCircle, Plug } from "lucide-react";
import { DpsStatusBadge } from "./DpsStatusBadge";
import { DpsMarkForTransferDialog, DpsConfirmProtectedButton } from "./DpsDepositActions";
import type { DpsDeposit } from "../domain/deposit-types";
import type { DpsConnectionSummary } from "../data/deposits";

function DepositCard({ deposit }: { deposit: DpsDeposit }) {
  const contract = deposit.contract;
  const propertyName =
    contract?.unit?.property?.name ?? contract?.unit?.property?.address_line_1 ?? "—";
  const room = contract?.unit?.room_number;
  const tenantName = contract?.pm_tenant?.full_name ?? "—";

  return (
    <div className="rounded-xl border border-border bg-surface-card overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground truncate">
              {propertyName}
              {room ? ` · Room ${room}` : ""}
            </p>
            <DpsStatusBadge status={deposit.status} />
          </div>
          <p className="text-xs text-foreground-secondary truncate">
            {tenantName}
            {deposit.deposit_amount_pence != null &&
              ` · £${(deposit.deposit_amount_pence / 100).toLocaleString()}`}
            {deposit.deposit_id ? ` · DPS ID ${deposit.deposit_id}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {deposit.status === "created" ? (
            <DpsMarkForTransferDialog depositRowId={deposit.id} />
          ) : null}
          {deposit.status === "created" || deposit.status === "marked_for_transfer" ? (
            <DpsConfirmProtectedButton depositRowId={deposit.id} />
          ) : null}
        </div>
      </div>

      {deposit.status === "marked_for_transfer" && deposit.payment_reference ? (
        <div className="border-t border-border bg-surface-inset px-4 py-2 text-xs text-foreground-secondary">
          Awaiting bank transfer — payment reference{" "}
          <span className="font-mono font-semibold">{deposit.payment_reference}</span>
          {deposit.allocation_reference ? (
            <>
              {" "}
              (allocation <span className="font-mono">{deposit.allocation_reference}</span>)
            </>
          ) : null}
          . Put this reference on the bank payment so DPS can auto-allocate it.
        </div>
      ) : null}

      {deposit.status === "created" ? (
        <div className="border-t border-border bg-surface-inset px-4 py-2 text-xs text-foreground-secondary">
          Registered with DPS — the deposit money has not been sent yet. Pay it from the DPS
          portal, or mark it for bank transfer here.
        </div>
      ) : null}

      {deposit.last_error ? (
        <div className="flex items-start gap-2 border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span className="break-words">{deposit.last_error}</span>
        </div>
      ) : null}
    </div>
  );
}

export function DpsDepositsPanel({
  deposits,
  connection,
}: {
  deposits: DpsDeposit[];
  connection: DpsConnectionSummary;
}) {
  if (!connection) {
    return (
      <div className="rounded-xl border border-border bg-surface-card py-16 text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 mb-4">
          <Plug className="h-7 w-7 text-brand" />
        </div>
        <p className="text-sm font-semibold text-foreground mb-2">DPS is not configured</p>
        <p className="text-xs text-foreground-secondary max-w-sm mx-auto leading-relaxed">
          Your agency&apos;s DPS API credentials have not been set up yet. Ask your Harbor Ops
          administrator to add them, then set a contract&apos;s deposit scheme to DPS to register a
          deposit.
        </p>
      </div>
    );
  }

  if (deposits.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface-card py-16 text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 mb-4">
          <ShieldCheck className="h-7 w-7 text-brand" />
        </div>
        <p className="text-sm font-semibold text-foreground mb-2">No DPS deposits yet</p>
        <p className="text-xs text-foreground-secondary max-w-sm mx-auto leading-relaxed">
          Open a{" "}
          <Link href="/contracts" className="text-foreground-link underline underline-offset-2">
            contract
          </Link>{" "}
          with its deposit scheme set to DPS and choose &ldquo;Register with DPS&rdquo; to protect
          the deposit.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {deposits.map((d) => (
        <DepositCard key={d.id} deposit={d} />
      ))}
    </div>
  );
}
