import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate, formatGBP } from "@/lib/utils/formatters";
import {
    Users,
    Building2,
    FileText,
    DollarSign,
    ArrowRight,
    TrendingUp,
    Clock,
    CheckCircle,
    Gift,
    BarChart3,
    AlertCircle,
    Send,
} from "lucide-react";
import { getInvoicesNeedingApproval, getInvoicesSentOverSevenDaysAgo } from "@/features/invoices/data/queries";

export default async function DashboardPage() {
    const profile = await requireUserProfile();
    const supabase = createSupabaseServerClient();
    const isAdmin = profile.role.toLowerCase() === "admin";

    const [
        { count: clientCount },
        { count: rentalCount },
        { count: invoiceCount },
        { data: recentRentals },
        { data: pendingApprovals },
        invoicesNeedingApproval,
        invoicesSentOver7Days,
    ] = await Promise.all([
        supabase.from("clients").select("*", { count: "exact", head: true }),
        supabase.from("rental_codes").select("*", { count: "exact", head: true }),
        supabase.from("invoices").select("*", { count: "exact", head: true }),
        supabase
            .from("rental_codes")
            .select("id, code, status, created_at, clients(full_name)")
            .order("created_at", { ascending: false })
            .limit(5),
        supabase
            .from("rental_codes")
            .select("id, code, created_at, clients(full_name)")
            .eq("status", "pending")
            .order("created_at", { ascending: false })
            .limit(5),
        isAdmin ? getInvoicesNeedingApproval() : Promise.resolve([]),
        isAdmin ? getInvoicesSentOverSevenDaysAgo() : Promise.resolve([]),
    ]);

    const quickActions = [
        {
            title: "Clients",
            description: "Manage leads & profiles",
            href: "/clients",
            icon: Users,
            gradient: "from-blue-500/10 to-blue-600/5",
            iconColor: "text-blue-600",
        },
        {
            title: "Rentals",
            description: "View rental codes",
            href: "/rentals",
            icon: Building2,
            gradient: "from-emerald-500/10 to-emerald-600/5",
            iconColor: "text-emerald-600",
        },
        {
            title: "Invoices",
            description: "Generate & track",
            href: "/invoices",
            icon: FileText,
            gradient: "from-violet-500/10 to-violet-600/5",
            iconColor: "text-violet-600",
        },
        {
            title: "Earnings",
            description: "View payouts",
            href: "/earnings",
            icon: DollarSign,
            gradient: "from-amber-500/10 to-amber-600/5",
            iconColor: "text-amber-600",
        },
    ];

    const today = new Date().toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
    });

    return (
        <div className="space-y-6">
            {/* ── Greeting Bar ─────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
                <div>
                    <p className="text-foreground-secondary text-sm">{today}</p>
                    <h1 className="text-2xl font-bold tracking-tight font-heading text-foreground">
                        Welcome back, {profile.display_name || "User"}
                    </h1>
                </div>
                <p className="text-[13px] text-foreground-muted">Here&apos;s your overview</p>
            </div>

            {/* ── Stat Tiles — Bento Row 1 ─────────── */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-[var(--gap-bento)]">
                {[
                    { label: "Total Clients", value: clientCount ?? 0, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
                    { label: "Active Rentals", value: rentalCount ?? 0, icon: Building2, color: "text-emerald-600", bg: "bg-emerald-50" },
                    { label: "Invoices", value: invoiceCount ?? 0, icon: FileText, color: "text-violet-600", bg: "bg-violet-50" },
                    { label: "Pending", value: pendingApprovals?.length ?? 0, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
                ].map((stat) => (
                    <div
                        key={stat.label}
                        className="group rounded-bento bg-surface-card p-5 shadow-bento transition-all duration-base hover:shadow-bento-hover hover:-translate-y-0.5"
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs font-medium text-foreground-muted uppercase tracking-wider">
                                    {stat.label}
                                </p>
                                <p className="text-3xl font-bold text-foreground mt-2 tabular-nums">
                                    {stat.value}
                                </p>
                            </div>
                            <div className={`p-3 rounded-xl ${stat.bg}`}>
                                <stat.icon className={`h-5 w-5 ${stat.color}`} strokeWidth={1.8} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Bento Row 2: Activity + Quick Actions ─── */}
            <div className="grid lg:grid-cols-5 gap-[var(--gap-bento)]">
                {/* Recent Activity — spans 3 cols */}
                <div className="lg:col-span-3 rounded-bento bg-surface-card shadow-bento p-6">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-lg bg-brand-subtle">
                                <TrendingUp className="h-4 w-4 text-brand" strokeWidth={2} />
                            </div>
                            <h2 className="text-base font-semibold text-foreground">Recent Activity</h2>
                        </div>
                        <Link
                            href="/rentals"
                            className="text-[13px] font-medium text-foreground-muted hover:text-brand transition-colors flex items-center gap-1"
                        >
                            View all <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    </div>

                    {recentRentals && recentRentals.length > 0 ? (
                        <div className="space-y-1">
                            {recentRentals.map((rental) => (
                                <Link
                                    key={rental.id}
                                    href={`/rentals/${rental.id}`}
                                    className="flex items-center justify-between p-3 rounded-xl hover:bg-surface-inset transition-colors duration-base group/item"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="h-9 w-9 rounded-lg bg-surface-inset flex items-center justify-center group-hover/item:bg-brand-subtle transition-colors">
                                            <Building2 className="h-4 w-4 text-foreground-muted group-hover/item:text-brand transition-colors" strokeWidth={1.8} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-foreground">{rental.code}</p>
                                            <p className="text-xs text-foreground-muted">
                                                {Array.isArray(rental.clients)
                                                    ? rental.clients[0]?.full_name
                                                    : (rental.clients as { full_name?: string })?.full_name ?? "—"}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <StatusBadge status={rental.status} size="sm" />
                                        <span className="text-xs text-foreground-muted hidden sm:block">
                                            {formatDate(rental.created_at)}
                                        </span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <BarChart3 className="h-10 w-10 text-foreground-muted mb-3" strokeWidth={1.5} />
                            <p className="text-sm text-foreground-secondary">No recent activity</p>
                        </div>
                    )}
                </div>

                {/* Quick Actions — spans 2 cols */}
                <div className="lg:col-span-2 rounded-bento bg-surface-card shadow-bento p-6">
                    <h2 className="text-base font-semibold text-foreground mb-5">Quick Actions</h2>
                    <div className="grid grid-cols-2 gap-3">
                        {quickActions.map((action) => (
                            <Link key={action.href} href={action.href}>
                                <div className={`group rounded-xl bg-gradient-to-br ${action.gradient} p-4 h-full transition-all duration-base hover:shadow-md hover:-translate-y-0.5`}>
                                    <action.icon className={`h-6 w-6 ${action.iconColor} mb-3`} strokeWidth={1.8} />
                                    <h3 className="text-sm font-semibold text-foreground">{action.title}</h3>
                                    <p className="text-xs text-foreground-secondary mt-0.5">{action.description}</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Bento Row 3: Pending Approvals (Admin) ─── */}
            {isAdmin && (
                <div className="rounded-bento bg-surface-card shadow-bento p-6">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-lg bg-warning-bg">
                                <Clock className="h-4 w-4 text-warning" strokeWidth={2} />
                            </div>
                            <h2 className="text-base font-semibold text-foreground">Pending Approvals</h2>
                            {(pendingApprovals?.length ?? 0) > 0 && (
                                <span className="text-xs font-medium text-warning bg-warning-bg px-2 py-0.5 rounded-full">
                                    {pendingApprovals?.length}
                                </span>
                            )}
                        </div>
                        <Link
                            href="/rentals?status=pending"
                            className="text-[13px] font-medium text-foreground-muted hover:text-brand transition-colors flex items-center gap-1"
                        >
                            View all <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    </div>

                    {pendingApprovals && pendingApprovals.length > 0 ? (
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {pendingApprovals.map((rental) => (
                                <Link
                                    key={rental.id}
                                    href={`/rentals/${rental.id}`}
                                    className="flex items-center gap-3 p-3 rounded-xl bg-surface-inset hover:bg-warning-bg/50 transition-colors border border-transparent hover:border-warning-border group"
                                >
                                    <div className="p-2 rounded-lg bg-warning-bg">
                                        <Clock className="h-4 w-4 text-warning" strokeWidth={1.8} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-foreground truncate">{rental.code}</p>
                                        <p className="text-xs text-foreground-muted truncate">
                                            {Array.isArray(rental.clients)
                                                ? rental.clients[0]?.full_name
                                                : (rental.clients as { full_name?: string })?.full_name ?? "—"}
                                        </p>
                                    </div>
                                    <ArrowRight className="h-4 w-4 text-foreground-muted group-hover:text-warning shrink-0 transition-colors" />
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div className="flex items-center gap-4 p-4 rounded-xl bg-success-bg/50">
                            <CheckCircle className="h-8 w-8 text-success" strokeWidth={1.5} />
                            <div>
                                <p className="text-sm font-medium text-foreground">All caught up!</p>
                                <p className="text-xs text-foreground-secondary">No pending approvals right now</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Bento Row 4: Invoices needing approval (Admin) ─── */}
            {isAdmin && (
                <div className="rounded-bento bg-surface-card shadow-bento p-6">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-lg bg-amber-100">
                                <AlertCircle className="h-4 w-4 text-amber-600" strokeWidth={2} />
                            </div>
                            <h2 className="text-base font-semibold text-foreground">Invoices needing approval</h2>
                            {(invoicesNeedingApproval?.length ?? 0) > 0 && (
                                <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                    {invoicesNeedingApproval?.length}
                                </span>
                            )}
                        </div>
                        <Link
                            href="/invoices?status=submitted"
                            className="text-[13px] font-medium text-foreground-muted hover:text-brand transition-colors flex items-center gap-1"
                        >
                            View all <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    </div>

                    {invoicesNeedingApproval && invoicesNeedingApproval.length > 0 ? (
                        <div className="space-y-1">
                            {invoicesNeedingApproval.slice(0, 5).map((inv) => (
                                <Link
                                    key={inv.id}
                                    href={`/invoices/${inv.id}`}
                                    className="flex items-center justify-between p-3 rounded-xl hover:bg-surface-inset transition-colors duration-base group/item"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center">
                                            <FileText className="h-4 w-4 text-amber-600" strokeWidth={1.8} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-foreground">{inv.invoice_number}</p>
                                            <p className="text-xs text-foreground-muted">
                                                {(inv.landlords as { name?: string })?.name ?? "—"}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-medium tabular-nums">{formatGBP(Number(inv.total))}</span>
                                        <ArrowRight className="h-4 w-4 text-foreground-muted group-hover/item:text-brand transition-colors" />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div className="flex items-center gap-4 p-4 rounded-xl bg-success-bg/50">
                            <CheckCircle className="h-8 w-8 text-success" strokeWidth={1.5} />
                            <div>
                                <p className="text-sm font-medium text-foreground">All caught up!</p>
                                <p className="text-xs text-foreground-secondary">No invoices waiting for approval</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Bento Row 5: Payment reminders — sent 7+ days ago (Admin) ─── */}
            {isAdmin && (
                <div className="rounded-bento bg-surface-card shadow-bento p-6">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-lg bg-violet-100">
                                <Send className="h-4 w-4 text-violet-600" strokeWidth={2} />
                            </div>
                            <h2 className="text-base font-semibold text-foreground">Payment reminders</h2>
                            {(invoicesSentOver7Days?.length ?? 0) > 0 && (
                                <span className="text-xs font-medium text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full">
                                    {invoicesSentOver7Days?.length}
                                </span>
                            )}
                        </div>
                        <Link
                            href="/invoices?status=sent"
                            className="text-[13px] font-medium text-foreground-muted hover:text-brand transition-colors flex items-center gap-1"
                        >
                            View sent <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    </div>
                    <p className="text-xs text-foreground-muted mb-3">Invoices sent 7+ days ago — open to remind payer or mark as received</p>

                    {invoicesSentOver7Days && invoicesSentOver7Days.length > 0 ? (
                        <div className="space-y-1">
                            {invoicesSentOver7Days.slice(0, 5).map((inv) => (
                                <Link
                                    key={inv.id}
                                    href={`/invoices/${inv.id}`}
                                    className="flex items-center justify-between p-3 rounded-xl hover:bg-surface-inset transition-colors duration-base group/item"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="h-9 w-9 rounded-lg bg-violet-100 flex items-center justify-center">
                                            <FileText className="h-4 w-4 text-violet-600" strokeWidth={1.8} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-foreground">{inv.invoice_number}</p>
                                            <p className="text-xs text-foreground-muted">
                                                {(inv.landlords as { name?: string })?.name ?? "—"} · Sent {inv.sent_at ? formatDate(inv.sent_at) : "—"}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-medium tabular-nums">{formatGBP(Number(inv.total))}</span>
                                        <ArrowRight className="h-4 w-4 text-foreground-muted group-hover/item:text-brand transition-colors" />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div className="flex items-center gap-4 p-4 rounded-xl bg-success-bg/50">
                            <CheckCircle className="h-8 w-8 text-success" strokeWidth={1.5} />
                            <div>
                                <p className="text-sm font-medium text-foreground">No reminders needed</p>
                                <p className="text-xs text-foreground-secondary">No invoices sent over 7 days ago awaiting payment</p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
