import Link from "next/link";
import { ShieldCheck, AlertCircle, Plug } from "lucide-react";
import { TdsStatusBadge } from "./TdsStatusBadge";
import { TdsCertificateButton } from "./TdsCertificateButton";
import { TdsRepaymentDialog } from "./TdsRepaymentDialog";
import type { TdsDeposit } from "../domain/deposit-types";
import type { TdsConnectionSummary } from "../data/deposits";

function DepositCard({ deposit }: { deposit: TdsDeposit }) {
  const contract = deposit.contract;
  const propertyName = contract?.unit?.property?.name ?? contract?.unit?.property?.address_line_1 ?? "—";
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
            <TdsStatusBadge status={deposit.status} />
          </div>
          <p className="text-xs text-foreground-secondary truncate">
            {tenantName}
            {deposit.deposit_amount_pence != null &&
              ` · £${(deposit.deposit_amount_pence / 100).toLocaleString()}`}
            {deposit.dan ? ` · DAN ${deposit.dan}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {deposit.status === "created" && deposit.dan ? (
            <>
              <TdsCertificateButton depositId={deposit.id} />
              <TdsRepaymentDialog depositId={deposit.id} dan={deposit.dan} />
            </>
          ) : null}
        </div>
      </div>

      {deposit.repayment_requested_at ? (
        <div className="border-t border-border bg-surface-inset px-4 py-2 text-xs text-foreground-secondary">
          Repayment requested {new Date(deposit.repayment_requested_at).toLocaleDateString("en-GB")}.
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

export function TdsDepositsPanel({
  deposits,
  connection,
}: {
  deposits: TdsDeposit[];
  connection: TdsConnectionSummary;
}) {
  if (!connection) {
    return (
      <div className="rounded-xl border border-border bg-surface-card py-16 text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 mb-4">
          <Plug className="h-7 w-7 text-brand" />
        </div>
        <p className="text-sm font-semibold text-foreground mb-2">TDS is not configured</p>
        <p className="text-xs text-foreground-secondary max-w-sm mx-auto leading-relaxed">
          Your agency&apos;s TDS Custodial credentials have not been set up yet. Ask your Harbor Ops
          administrator to add them, then set a contract&apos;s deposit scheme to TDS to register a
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
        <p className="text-sm font-semibold text-foreground mb-2">No TDS deposits yet</p>
        <p className="text-xs text-foreground-secondary max-w-sm mx-auto leading-relaxed">
          Open a{" "}
          <Link href="/contracts" className="text-foreground-link underline underline-offset-2">
            contract
          </Link>{" "}
          with its deposit scheme set to TDS and choose &ldquo;Register with TDS&rdquo; to protect the
          deposit.
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
