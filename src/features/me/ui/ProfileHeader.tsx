"use client";

import Link from "next/link";
import { useState } from "react";
import { AvatarCircle } from "@/components/shared/AvatarCircle";
import { Button } from "@/components/ui/button";
import { BusinessCardModal } from "./BusinessCardModal";
import { cn } from "@/lib/utils/cn";
import {
  Pencil,
  Share2,
  FileDown,
  UserPlus,
  Copy,
  Check,
  CalendarDays,
  ClipboardList,
  TrendingUp,
  BarChart2,
} from "lucide-react";

function formatJoinDate(iso?: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function formatGBPShort(n: number) {
  if (n >= 1000) return `£${(n / 1000).toFixed(1)}k`;
  return `£${n.toFixed(0)}`;
}

function QuickStat({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-surface-inset border border-border min-w-0">
      <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg shrink-0", color)}>
        <Icon className="h-4 w-4" strokeWidth={1.8} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-foreground-muted uppercase tracking-wide leading-none mb-0.5">
          {label}
        </p>
        <p className="text-base font-bold text-foreground tabular-nums leading-none">{value}</p>
      </div>
    </div>
  );
}

type ProfileHeaderProps = {
  displayName: string;
  role: string;
  avatarUrl?: string | null;
  joinedAt?: string | null;
  editSupported?: boolean;
  // Enhanced props
  totalRentals?: number;
  totalEarnings?: number;
  avgPerRental?: number;
  cardUrl?: string;
  hasBusinessCard?: boolean;
};

export function ProfileHeader({
  displayName,
  role,
  avatarUrl,
  joinedAt,
  editSupported = false,
  totalRentals = 0,
  totalEarnings = 0,
  avgPerRental = 0,
  cardUrl,
  hasBusinessCard,
}: ProfileHeaderProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    if (!cardUrl) return;
    await navigator.clipboard.writeText(cardUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const roleLabel = role?.replace(/_/g, " ") ?? "Agent";

  return (
    <div className="rounded-bento bg-surface-card shadow-bento overflow-hidden">
      {/* Brand accent stripe */}
      <div className="h-1.5 w-full bg-brand" />

      <div className="p-6">
        {/* Main row: avatar + info + CTAs */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="h-20 w-20 ring-4 ring-brand/20 rounded-full overflow-hidden">
              <AvatarCircle name={displayName} url={avatarUrl ?? undefined} size={80} />
            </div>
            <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-green-400 border-2 border-surface-card" title="Active" />
          </div>

          {/* Name + role + joined */}
          <div className="flex-1 min-w-0 pt-1">
            <div className="flex items-center gap-2.5 flex-wrap mb-1">
              <h1 className="text-2xl font-bold text-foreground tracking-tight leading-none">
                {displayName}
              </h1>
              <span className="inline-flex items-center rounded-full bg-brand/10 border border-brand/20 px-2.5 py-0.5 text-xs font-semibold text-brand capitalize">
                {roleLabel}
              </span>
            </div>
            {joinedAt && (
              <div className="flex items-center gap-1 text-sm text-foreground-muted mt-0.5">
                <CalendarDays className="h-3.5 w-3.5" />
                <span>Member since {formatJoinDate(joinedAt)}</span>
              </div>
            )}
          </div>

          {/* CTA buttons — right side */}
          <div className="flex items-center gap-2 shrink-0 sm:ml-auto">
            {hasBusinessCard && cardUrl && (
              <BusinessCardModal agentId="" cardUrl={cardUrl} />
            )}
            {editSupported && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/me?tab=settings">
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Edit Profile
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
          <QuickStat
            label="Total Rentals"
            value={totalRentals.toLocaleString()}
            icon={ClipboardList}
            color="bg-blue-50 text-blue-600"
          />
          <QuickStat
            label="Total Earnings"
            value={formatGBPShort(totalEarnings)}
            icon={TrendingUp}
            color="bg-emerald-50 text-emerald-600"
          />
          <QuickStat
            label="Avg per Rental"
            value={avgPerRental > 0 ? formatGBPShort(avgPerRental) : "—"}
            icon={BarChart2}
            color="bg-violet-50 text-violet-600"
          />
        </div>

        {/* Quick actions row */}
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border flex-wrap">
          {cardUrl && (
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-inset px-3 py-1.5 text-xs font-medium text-foreground-secondary hover:bg-surface-card hover:text-foreground transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Share2 className="h-3.5 w-3.5" />}
              {copied ? "Copied!" : "Share Profile"}
            </button>
          )}
          <button
            type="button"
            disabled
            title="Coming soon"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-inset px-3 py-1.5 text-xs font-medium text-foreground-muted opacity-50 cursor-not-allowed"
          >
            <FileDown className="h-3.5 w-3.5" />
            Download Report
          </button>
          <Link
            href="/clients"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-inset px-3 py-1.5 text-xs font-medium text-foreground-secondary hover:bg-surface-card hover:text-foreground transition-colors"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Invite Client
          </Link>
        </div>
      </div>
    </div>
  );
}
