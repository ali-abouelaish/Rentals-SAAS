import Link from "next/link";
import { Banknote, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RentCollectionList } from "./RentCollectionList";
import type { RentCollectionRow } from "../data/queries";

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "default" | "danger" | "success";
}) {
  const valueClass =
    tone === "danger"
      ? "text-red-600"
      : tone === "success"
        ? "text-emerald-600"
        : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-surface-card p-4">
      <p className="text-[11px] uppercase tracking-wider text-foreground-muted font-semibold">
        {label}
      </p>
      <p className={`text-2xl font-bold tracking-tight mt-1 tabular-nums ${valueClass}`}>
        {value}
      </p>
    </div>
  );
}

export function RentCollectionPage({ rows }: { rows: RentCollectionRow[] }) {
  const totalExpected = rows.reduce((s, r) => s + r.expected, 0);
  const totalPaid = rows.reduce((s, r) => s + r.paid, 0);
  const totalArrears = rows.reduce((s, r) => s + r.arrears, 0);
  const tenanciesOwing = rows.filter((r) => r.arrears > 0).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10">
          <Banknote className="h-5 w-5 text-brand" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Rent Collection
          </h1>
          <p className="text-xs text-foreground-secondary">
            {rows.length} active tenanc{rows.length === 1 ? "y" : "ies"} · Lifetime arrears across the portfolio.
          </p>
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link href="/rent-collection/statements">
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Bank Statements
          </Link>
        </Button>
      </div>

      {rows.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Expected (lifetime)" value={`£${totalExpected.toLocaleString()}`} />
          <StatCard label="Paid" value={`£${totalPaid.toLocaleString()}`} />
          <StatCard
            label="Arrears"
            value={`£${totalArrears.toLocaleString()}`}
            tone={totalArrears > 0 ? "danger" : "success"}
          />
          <StatCard
            label="Tenancies owing"
            value={`${tenanciesOwing}`}
            tone={tenanciesOwing > 0 ? "danger" : "success"}
          />
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-card py-16 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 mb-4">
            <Banknote className="h-7 w-7 text-brand" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-1">No active tenancies</p>
          <p className="text-xs text-foreground-secondary max-w-sm mx-auto">
            Once you have signed or active contracts, they&apos;ll appear here so you can record
            payments and watch arrears.
          </p>
        </div>
      ) : (
        <RentCollectionList rows={rows} />
      )}
    </div>
  );
}
