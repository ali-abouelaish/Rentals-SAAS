"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Banknote, CheckCircle2, Landmark, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils/cn";

export type OpenBankingConnection = {
  id: string;
  aspsp_name: string | null;
  aspsp_country: string | null;
  status: "pending" | "authorized" | "expired";
  valid_until: string | null;
  created_at: string;
  portfolio_id: string | null;
};

export type Portfolio = {
  id: string;
  name: string;
  color: string | null;
};

export type OpenBankingAccount = {
  id: string;
  connection_id: string;
  eb_account_uid: string;
  iban: string | null;
  account_name: string | null;
  currency: string | null;
  last_synced_at: string | null;
};

type Bank = { name: string; country: string; logo: string | null };

type Transaction = {
  id: string;
  booking_date: string | null;
  amount_pence: number | null;
  currency: string | null;
  credit_debit: "CRDT" | "DBIT" | null;
  debtor_name: string | null;
  remittance_info: string | null;
  match_status: "unmatched" | "matched" | "flagged";
  matched_payment_id: string | null;
};

const GBP = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

function formatAmount(pence: number | null, currency: string | null): string {
  if (pence == null) return "—";
  if (!currency || currency === "GBP") return GBP.format(pence / 100);
  return `${(pence / 100).toFixed(2)} ${currency}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function OpenBankingDemoView({
  portfolios,
  connections,
  accounts,
  connectedFlag,
  errorFlag
}: {
  portfolios: Portfolio[];
  connections: OpenBankingConnection[];
  accounts: OpenBankingAccount[];
  connectedFlag: boolean;
  errorFlag: string | null;
}) {
  const [selectedPortfolio, setSelectedPortfolio] = useState<string>("");
  const [banks, setBanks] = useState<Bank[]>([]);
  const [banksLoading, setBanksLoading] = useState(true);
  const [banksError, setBanksError] = useState<string | null>(null);
  const [banksSource, setBanksSource] = useState<string | null>(null);
  const [selectedBank, setSelectedBank] = useState<string>("");
  const [connecting, setConnecting] = useState(false);

  const portfolioById = useMemo(() => {
    const map = new Map<string, Portfolio>();
    for (const p of portfolios) map.set(p.id, p);
    return map;
  }, [portfolios]);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [syncingConnectionId, setSyncingConnectionId] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const authorizedConnections = useMemo(
    () => connections.filter((c) => c.status === "authorized"),
    [connections]
  );

  const refreshTransactions = useCallback(async () => {
    setTransactionsLoading(true);
    try {
      const res = await fetch("/api/open-banking/transactions", { cache: "no-store" });
      const json = await res.json();
      if (res.ok) setTransactions(json.transactions ?? []);
    } finally {
      setTransactionsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/open-banking/banks", { cache: "no-store" });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setBanksError(json.error ?? "Could not load banks");
        } else {
          setBanks(json.banks ?? []);
          setBanksSource(json.source ?? null);
        }
      } catch (err) {
        if (!cancelled) setBanksError(err instanceof Error ? err.message : "Network error");
      } finally {
        if (!cancelled) setBanksLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    refreshTransactions();
  }, [refreshTransactions]);

  const handleConnect = async () => {
    if (!selectedBank || !selectedPortfolio) return;
    const bank = banks.find((b) => `${b.name}::${b.country}` === selectedBank);
    if (!bank) return;
    setConnecting(true);
    try {
      const res = await fetch("/api/open-banking/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aspsp_name: bank.name,
          aspsp_country: bank.country,
          portfolio_id: selectedPortfolio
        })
      });
      const json = await res.json();
      if (res.ok && json.url) {
        window.location.href = json.url;
      } else {
        alert(json.error ?? "Failed to start connection");
        setConnecting(false);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Network error");
      setConnecting(false);
    }
  };

  const handleSync = async (connectionId: string) => {
    setSyncingConnectionId(connectionId);
    setSyncResult(null);
    try {
      const res = await fetch("/api/open-banking/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connection_id: connectionId })
      });
      const json = await res.json();
      if (res.ok) {
        setSyncResult(
          `Synced ${json.accounts} account(s) — ${json.inserted} transaction(s) pulled, ${json.matched} auto-matched.`
        );
        await refreshTransactions();
      } else {
        setSyncResult(json.error ?? "Sync failed");
      }
    } catch (err) {
      setSyncResult(err instanceof Error ? err.message : "Network error");
    } finally {
      setSyncingConnectionId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Open Banking — AIS Demo</h1>
          <p className="mt-1 text-sm text-foreground-secondary">
            Connect a sandbox bank via Enable Banking, pull booked credit transactions, and preview
            auto-matching against active rent contracts.
          </p>
        </div>
        <Badge className="bg-amber-100 text-amber-900 border-amber-200 hover:bg-amber-100">
          SANDBOX DEMO
        </Badge>
      </div>

      {connectedFlag && (
        <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-sm text-foreground">
          <CheckCircle2 className="h-4 w-4 text-success" />
          Bank connected. Pick the connection below and click <strong className="mx-1">Sync transactions</strong>.
        </div>
      )}
      {errorFlag && (
        <div className="flex items-center gap-2 rounded-lg border border-error/40 bg-error/10 px-4 py-3 text-sm text-foreground">
          <AlertTriangle className="h-4 w-4 text-error" />
          Connection failed: {decodeURIComponent(errorFlag)}
        </div>
      )}

      {/* Section A — Connect a bank */}
      <section className="rounded-xl border border-border bg-surface-card p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Landmark className="h-4 w-4 text-brand" /> Connect a bank
        </h2>
        <p className="mt-1 text-xs text-foreground-secondary">
          Pick the portfolio whose rent will be reconciled, then choose a sandbox bank to authorize.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="w-full max-w-xs">
            <label
              htmlFor="ob-portfolio-select"
              className="mb-1.5 block text-xs font-medium text-foreground-muted"
            >
              Portfolio
            </label>
            <select
              id="ob-portfolio-select"
              className="h-9 w-full rounded-lg border border-border/70 bg-surface-card px-3 text-sm text-foreground-secondary shadow-sm disabled:opacity-60"
              disabled={portfolios.length === 0}
              value={selectedPortfolio}
              onChange={(e) => setSelectedPortfolio(e.target.value)}
            >
              <option value="">
                {portfolios.length === 0 ? "No portfolios" : "Select a portfolio"}
              </option>
              {portfolios.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {portfolios.length === 0 && (
              <p className="mt-1 text-xs text-foreground-muted">
                Create a portfolio under Properties first.
              </p>
            )}
          </div>

          <div className="flex-1 min-w-[16rem] max-w-md">
            <label
              htmlFor="ob-bank-select"
              className="mb-1.5 block text-xs font-medium text-foreground-muted"
            >
              Bank
            </label>
            <select
              id="ob-bank-select"
              className="h-9 w-full rounded-lg border border-border/70 bg-surface-card px-3 text-sm text-foreground-secondary shadow-sm disabled:opacity-60"
              disabled={banksLoading || !!banksError}
              value={selectedBank}
              onChange={(e) => setSelectedBank(e.target.value)}
            >
              <option value="">
                {banksLoading
                  ? "Loading banks…"
                  : banksError
                  ? "Failed to load"
                  : banks.length === 0
                  ? "No banks returned by Enable Banking"
                  : "Select a bank"}
              </option>
              {banks.map((b) => (
                <option
                  key={`${b.name}-${b.country}`}
                  value={`${b.name}::${b.country}`}
                >
                  {b.name} ({b.country})
                </option>
              ))}
            </select>
            {banksError && <p className="mt-1 text-xs text-error">{banksError}</p>}
            {!banksError && !banksLoading && banks.length === 0 && (
              <p className="mt-1 text-xs text-foreground-muted">
                Check <code>EB_PRIVATE_KEY</code> and <code>EB_APP_ID</code> in <code>.env.local</code>,
                then restart <code>npm run dev</code>.
              </p>
            )}
            {!banksError && !banksLoading && banks.length > 0 && banksSource && banksSource !== "GB business" && (
              <p className="mt-1 text-xs text-foreground-muted">
                Sandbox fallback: showing <strong>{banksSource}</strong> banks (no GB business sandbox ASPSPs available).
              </p>
            )}
          </div>
          <Button
            variant="secondary"
            disabled={!selectedBank || !selectedPortfolio || connecting}
            loading={connecting}
            onClick={handleConnect}
          >
            Connect bank
          </Button>
        </div>
      </section>

      {/* Section B — Linked accounts */}
      <section className="rounded-xl border border-border bg-surface-card p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Banknote className="h-4 w-4 text-brand" /> Linked accounts
        </h2>

        {authorizedConnections.length === 0 ? (
          <p className="mt-3 text-sm text-foreground-secondary">
            No authorized connections yet. Connect a bank above to see its accounts here.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {authorizedConnections.map((conn) => {
              const connAccounts = accounts.filter((a) => a.connection_id === conn.id);
              const isSyncing = syncingConnectionId === conn.id;
              return (
                <div key={conn.id} className="rounded-lg border border-border bg-surface-app/40 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-foreground">{conn.aspsp_name}</div>
                      <div className="text-xs text-foreground-muted">
                        Authorized · valid until {formatDate(conn.valid_until)}
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleSync(conn.id)}
                      loading={isSyncing}
                      disabled={isSyncing || connAccounts.length === 0}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Sync transactions
                    </Button>
                  </div>

                  {connAccounts.length === 0 ? (
                    <p className="mt-3 text-xs text-foreground-secondary">No accounts on this connection.</p>
                  ) : (
                    <ul className="mt-3 divide-y divide-border-border-muted">
                      {connAccounts.map((a) => (
                        <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                          <div>
                            <div className="font-medium text-foreground">{a.account_name ?? a.eb_account_uid}</div>
                            <div className="text-xs text-foreground-muted">
                              {a.iban ?? "No IBAN"} · {a.currency ?? "—"}
                            </div>
                          </div>
                          <div className="text-xs text-foreground-muted">
                            {a.last_synced_at ? `Synced ${formatDate(a.last_synced_at)}` : "Never synced"}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
            {syncResult && (
              <p className="text-xs text-foreground-secondary">{syncResult}</p>
            )}
          </div>
        )}
      </section>

      {/* Section C — Transaction feed */}
      <section className="rounded-xl border border-border bg-surface-card p-5">
        <h2 className="text-base font-semibold text-foreground">Transaction feed</h2>
        <p className="mt-1 text-xs text-foreground-secondary">
          Credit transactions only. Auto-match flags amounts within ±£5 of a single active contract&apos;s monthly rent.
        </p>

        <div className="mt-4">
          {transactionsLoading ? (
            <p className="text-sm text-foreground-secondary">Loading transactions…</p>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-foreground-secondary">
              No transactions yet. Connect a bank and sync to populate this feed.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Match status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>{formatDate(tx.booking_date)}</TableCell>
                    <TableCell className="font-medium text-foreground">
                      {formatAmount(tx.amount_pence, tx.currency)}
                    </TableCell>
                    <TableCell>{tx.debtor_name ?? "—"}</TableCell>
                    <TableCell className="max-w-[18rem] truncate">{tx.remittance_info ?? "—"}</TableCell>
                    <TableCell>
                      <MatchStatusBadge status={tx.match_status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>
    </div>
  );
}

function MatchStatusBadge({ status }: { status: Transaction["match_status"] }) {
  const styles: Record<Transaction["match_status"], string> = {
    matched: "bg-success/15 text-success border-success/30 hover:bg-success/15",
    unmatched: "bg-amber-100 text-amber-900 border-amber-200 hover:bg-amber-100",
    flagged: "bg-error/15 text-error border-error/30 hover:bg-error/15"
  };
  const label: Record<Transaction["match_status"], string> = {
    matched: "Matched",
    unmatched: "Unmatched",
    flagged: "Flagged"
  };
  return <Badge className={cn(styles[status])}>{label[status]}</Badge>;
}
