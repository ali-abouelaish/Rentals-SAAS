"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { DepositsPage } from "@/features/mydeposits/ui/DepositsPage";
import { TdsDepositsPanel } from "@/features/tds/ui/TdsDepositsPanel";
import { DpsDepositsPanel } from "@/features/dps/ui/DpsDepositsPanel";
import type {
  MdProtection,
  MdReleaseRequest,
  MydepositsConnection,
} from "@/features/mydeposits/domain/types";
import type { TdsDeposit } from "@/features/tds/domain/deposit-types";
import type { TdsConnectionSummary } from "@/features/tds/data/deposits";
import type { DpsDeposit } from "@/features/dps/domain/deposit-types";
import type { DpsConnectionSummary } from "@/features/dps/data/deposits";

export type ProviderError = { message: string; missingTable: boolean };

export type MdProviderData =
  | {
      ok: true;
      connection: MydepositsConnection | null;
      protections: MdProtection[];
      releaseRequests: MdReleaseRequest[];
    }
  | { ok: false; error: ProviderError };

export type TdsProviderData =
  | { ok: true; deposits: TdsDeposit[]; connection: TdsConnectionSummary }
  | { ok: false; error: ProviderError };

export type DpsProviderData =
  | { ok: true; deposits: DpsDeposit[]; connection: DpsConnectionSummary }
  | { ok: false; error: ProviderError };

function ErrorState({ error }: { error: ProviderError }) {
  return (
    <div className="rounded-xl border border-border bg-surface-card py-16 text-center">
      <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 mb-4">
        <ShieldCheck className="h-7 w-7 text-brand" />
      </div>
      <p className="text-sm font-semibold text-foreground mb-2">
        {error.missingTable ? "Database migrations pending" : "Failed to load deposits"}
      </p>
      <p className="text-xs text-foreground-secondary max-w-sm mx-auto leading-relaxed">
        {error.missingTable
          ? "Apply the latest migrations in supabase/migrations/ to your Supabase database, then reload."
          : error.message}
      </p>
    </div>
  );
}

function TdsSection({ data }: { data: TdsProviderData }) {
  if (!data.ok) return <ErrorState error={data.error} />;
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10">
          <ShieldCheck className="h-5 w-5 text-brand" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">TDS Deposit Protection</h1>
          <p className="text-xs text-foreground-secondary">
            Register and manage tenancy deposits via the Tenancy Deposit Scheme (Custodial).
          </p>
        </div>
      </div>
      <TdsDepositsPanel deposits={data.deposits} connection={data.connection} />
    </div>
  );
}

function DpsSection({ data }: { data: DpsProviderData }) {
  if (!data.ok) return <ErrorState error={data.error} />;
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10">
          <ShieldCheck className="h-5 w-5 text-brand" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">DPS Deposit Protection</h1>
          <p className="text-xs text-foreground-secondary">
            Register tenancies with the Deposit Protection Service, then pay by bank transfer or
            via the DPS portal.
          </p>
        </div>
      </div>
      <DpsDepositsPanel deposits={data.deposits} connection={data.connection} />
    </div>
  );
}

function MdSection({ data }: { data: MdProviderData }) {
  if (!data.ok) return <ErrorState error={data.error} />;
  return (
    <DepositsPage
      connection={data.connection}
      protections={data.protections}
      releaseRequests={data.releaseRequests}
    />
  );
}

/**
 * Deposits area shell. When a tenant is entitled to both providers a subtab bar
 * lets them switch; with a single provider its panel is rendered directly.
 */
export function DepositsHub({
  md,
  tds,
  dps,
}: {
  md: MdProviderData | null;
  tds: TdsProviderData | null;
  dps: DpsProviderData | null;
}) {
  const providers = [
    md ? ({ key: "mydeposits", label: "MyDeposits" } as const) : null,
    tds ? ({ key: "tds", label: "TDS" } as const) : null,
    dps ? ({ key: "dps", label: "DPS" } as const) : null,
  ].filter(Boolean) as { key: "mydeposits" | "tds" | "dps"; label: string }[];

  const [active, setActive] = useState<"mydeposits" | "tds" | "dps">(
    providers[0]?.key ?? "mydeposits"
  );

  if (providers.length <= 1) {
    if (md) return <MdSection data={md} />;
    if (tds) return <TdsSection data={tds} />;
    if (dps) return <DpsSection data={dps} />;
    return null;
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-1 border-b border-border">
        {providers.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setActive(p.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              active === p.key
                ? "border-brand text-foreground"
                : "border-transparent text-foreground-muted hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {active === "mydeposits" && md ? <MdSection data={md} /> : null}
      {active === "tds" && tds ? <TdsSection data={tds} /> : null}
      {active === "dps" && dps ? <DpsSection data={dps} /> : null}
    </div>
  );
}
