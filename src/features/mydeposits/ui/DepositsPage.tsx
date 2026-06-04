import Link from "next/link";
import { ShieldCheck, Plug, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProtectionCard } from "./ProtectionCard";
import type { MdProtection, MdReleaseRequest, MydepositsConnection } from "../domain/types";

export function DepositsPage({
  connection,
  protections,
  releaseRequests,
}: {
  connection: MydepositsConnection | null;
  protections: MdProtection[];
  releaseRequests: MdReleaseRequest[];
}) {
  const byProtection = new Map<string, MdReleaseRequest[]>();
  for (const rr of releaseRequests) {
    const list = byProtection.get(rr.protection_id) ?? [];
    list.push(rr);
    byProtection.set(rr.protection_id, list);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10">
          <ShieldCheck className="h-5 w-5 text-brand" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Deposit Protection</h1>
          <p className="text-xs text-foreground-secondary">
            Secure and release tenancy deposits via mydeposits.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/settings/deposits">
            <Settings className="h-3.5 w-3.5" />
            Connection
          </Link>
        </Button>
      </div>

      {!connection ? (
        <div className="rounded-xl border border-border bg-surface-card py-16 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 mb-4">
            <Plug className="h-7 w-7 text-brand" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-2">Not connected to mydeposits</p>
          <p className="text-xs text-foreground-secondary max-w-sm mx-auto leading-relaxed mb-4">
            Connect your mydeposits account to secure and release deposits straight from your contracts.
          </p>
          <Button asChild variant="secondary" size="sm">
            <Link href="/settings/deposits">Go to connection settings</Link>
          </Button>
        </div>
      ) : protections.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-card py-16 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 mb-4">
            <ShieldCheck className="h-7 w-7 text-brand" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-2">No deposits secured yet</p>
          <p className="text-xs text-foreground-secondary max-w-sm mx-auto leading-relaxed">
            Open a contract with its deposit scheme set to mydeposits and choose &ldquo;Secure with
            mydeposits&rdquo; to protect the deposit.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {protections.map((p) => (
            <ProtectionCard
              key={p.id}
              protection={p}
              releaseRequests={byProtection.get(p.id) ?? []}
            />
          ))}
        </div>
      )}
    </div>
  );
}
