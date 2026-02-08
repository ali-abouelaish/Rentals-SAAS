import Link from "next/link";
import { PageHero } from "@/components/layout/PageHeader";
import { Card, CardContent, StatCard } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate, formatCurrency } from "@/lib/utils/formatters";
import {
    Users,
    Building2,
    FileText,
    DollarSign,
    ArrowRight,
    TrendingUp,
    Clock,
    CheckCircle
} from "lucide-react";

export default async function DashboardPage() {
    const profile = await requireUserProfile();
    const supabase = createSupabaseServerClient();
    const isAdmin = profile.role.toLowerCase() === "admin";

    // Fetch dashboard stats
    const [
        { count: clientCount },
        { count: rentalCount },
        { count: invoiceCount },
        { data: recentRentals },
        { data: pendingApprovals }
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
            .limit(5)
    ]);

    const quickActions = [
        {
            title: "Clients",
            description: "Manage leads & profiles",
            href: "/clients",
            icon: Users,
            color: "text-blue-600",
            bgColor: "bg-blue-100"
        },
        {
            title: "Rentals",
            description: "View rental codes",
            href: "/rentals",
            icon: Building2,
            color: "text-emerald-600",
            bgColor: "bg-emerald-100"
        },
        {
            title: "Invoices",
            description: "Generate & track",
            href: "/invoices",
            icon: FileText,
            color: "text-purple-600",
            bgColor: "bg-purple-100"
        },
        {
            title: "Earnings",
            description: "View payouts",
            href: "/earnings",
            icon: DollarSign,
            color: "text-amber-600",
            bgColor: "bg-amber-100"
        }
    ];

    return (
        <div className="space-y-6">
            {/* Hero Section */}
            <PageHero
                title={`Welcome back, ${profile.display_name || "User"}`}
                subtitle="Here's an overview of your rental agency"
                badge="Dashboard"
            />

            {/* Stats Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="Total Clients"
                    value={clientCount ?? 0}
                    icon={<Users className="h-5 w-5" />}
                />
                <StatCard
                    label="Active Rentals"
                    value={rentalCount ?? 0}
                    icon={<Building2 className="h-5 w-5" />}
                />
                <StatCard
                    label="Invoices"
                    value={invoiceCount ?? 0}
                    icon={<FileText className="h-5 w-5" />}
                />
                <StatCard
                    label="Pending"
                    value={pendingApprovals?.length ?? 0}
                    icon={<Clock className="h-5 w-5" />}
                />
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {quickActions.map((action) => (
                    <Link key={action.href} href={action.href}>
                        <Card variant="interactive" className="h-full">
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between">
                                    <div className={`p-2.5 rounded-lg ${action.bgColor}`}>
                                        <action.icon className={`h-5 w-5 ${action.color}`} />
                                    </div>
                                    <ArrowRight className="h-4 w-4 text-slate-400" />
                                </div>
                                <h3 className="font-semibold text-brand mt-3">{action.title}</h3>
                                <p className="text-sm text-slate-500">{action.description}</p>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>

            {/* Two Column Layout */}
            <div className="grid lg:grid-cols-2 gap-6">
                {/* Recent Rentals */}
                <Card>
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-brand flex items-center gap-2">
                                <TrendingUp className="h-4 w-4" />
                                Recent Rentals
                            </h3>
                            <Link href="/rentals" className="text-sm text-brand hover:underline">
                                View all
                            </Link>
                        </div>
                        {recentRentals && recentRentals.length > 0 ? (
                            <div className="space-y-3">
                                {recentRentals.map((rental) => (
                                    <Link
                                        key={rental.id}
                                        href={`/rentals/${rental.id}`}
                                        className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-brand-50">
                                                <Building2 className="h-4 w-4 text-brand" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-brand text-sm">{rental.code}</p>
                                                <p className="text-xs text-slate-500">
                                                    {Array.isArray(rental.clients)
                                                        ? rental.clients[0]?.full_name
                                                        : (rental.clients as { full_name?: string })?.full_name ?? "—"}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <StatusBadge status={rental.status} size="sm" />
                                            <span className="text-xs text-slate-400">
                                                {formatDate(rental.created_at)}
                                            </span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-500 text-center py-8">No recent rentals</p>
                        )}
                    </CardContent>
                </Card>

                {/* Pending Approvals */}
                {isAdmin && (
                    <Card accent="left" accentColor="gold">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-semibold text-brand flex items-center gap-2">
                                    <Clock className="h-4 w-4" />
                                    Pending Approvals
                                </h3>
                                <Link href="/rentals?status=pending" className="text-sm text-brand hover:underline">
                                    View all
                                </Link>
                            </div>
                            {pendingApprovals && pendingApprovals.length > 0 ? (
                                <div className="space-y-3">
                                    {pendingApprovals.map((rental) => (
                                        <Link
                                            key={rental.id}
                                            href={`/rentals/${rental.id}`}
                                            className="flex items-center justify-between p-3 rounded-lg hover:bg-amber-50/50 transition-colors border border-transparent hover:border-amber-200/50"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-amber-100">
                                                    <Clock className="h-4 w-4 text-amber-600" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-brand text-sm">{rental.code}</p>
                                                    <p className="text-xs text-slate-500">
                                                        {Array.isArray(rental.clients)
                                                            ? rental.clients[0]?.full_name
                                                            : (rental.clients as { full_name?: string })?.full_name ?? "—"}
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="text-xs text-slate-400">
                                                {formatDate(rental.created_at)}
                                            </span>
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <CheckCircle className="h-10 w-10 text-emerald-300 mx-auto mb-2" />
                                    <p className="text-sm text-slate-500">All caught up!</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
