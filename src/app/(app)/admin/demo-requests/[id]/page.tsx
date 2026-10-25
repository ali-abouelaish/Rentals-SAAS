import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getDemoRequest } from "@/features/demo-requests/data/admin";
import { portfolioLabel } from "@/features/demo-requests/domain/schemas";
import { DeleteDemoRequestButton } from "@/features/demo-requests/ui/admin/DeleteDemoRequestButton";
import { DemoNotesForm } from "@/features/demo-requests/ui/admin/DemoNotesForm";
import { DemoStatusControl } from "@/features/demo-requests/ui/admin/DemoStatusControl";
import { DemoStatusBadge, QuoteBadge, formatDemoTime } from "@/features/demo-requests/ui/admin/badges";

export const dynamic = "force-dynamic";

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-foreground-muted">{label}</dt>
      <dd className="text-sm text-foreground [overflow-wrap:anywhere]">{value}</dd>
    </div>
  );
}

export default async function AdminDemoRequestPage({ params }: { params: { id: string } }) {
  const lookup = await getDemoRequest(params.id);
  if (lookup.state === "missing") notFound();

  if (lookup.state === "unavailable") {
    return (
      <div className="space-y-5">
        <Link href="/admin/demo-requests" className="inline-flex min-h-11 items-center gap-1 text-sm text-foreground-secondary hover:text-foreground">
          <ArrowLeft size={14} /> Demo requests
        </Link>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
              <p className="text-sm text-foreground-secondary">
                Demo requests could not be read. Apply migration <code>20261025000001_demo_requests.sql</code>, then reload.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const r = lookup.request;
  const subject = encodeURIComponent(r.plan_interest === "enterprise" ? "Your Harbor quote" : "Your Harbor demo");

  return (
    <div className="space-y-5">
      <Link href="/admin/demo-requests" className="inline-flex min-h-11 items-center gap-1 text-sm text-foreground-secondary hover:text-foreground">
        <ArrowLeft size={14} /> Demo requests
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <DemoStatusBadge status={r.status} />
          {r.plan_interest === "enterprise" && <QuoteBadge />}
        </div>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-foreground [overflow-wrap:anywhere] sm:text-2xl">{r.company}</h1>
        <p className="text-sm text-foreground-secondary">
          {r.first_name} {r.last_name} · {portfolioLabel(r.portfolio_size)}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardContent className="pt-5 space-y-4">
              <h2 className="text-base font-semibold text-foreground">What they&apos;re hoping to solve</h2>
              {r.goal ? (
                <p className="whitespace-pre-wrap text-sm text-foreground [overflow-wrap:anywhere]">{r.goal}</p>
              ) : (
                <p className="text-sm text-foreground-muted">They left this blank.</p>
              )}
              <a
                href={`mailto:${r.email}?subject=${subject}`}
                className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-foreground-link hover:underline"
              >
                <Mail size={14} /> Reply to {r.email}
              </a>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <DemoNotesForm requestId={r.id} notes={r.admin_notes} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="pt-5">
              <DemoStatusControl requestId={r.id} status={r.status} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <dl className="space-y-3">
                <Detail label="Name" value={`${r.first_name} ${r.last_name}`} />
                <Detail
                  label="Email"
                  value={
                    <a href={`mailto:${r.email}`} className="text-foreground-link hover:underline">
                      {r.email}
                    </a>
                  }
                />
                <Detail label="Company" value={r.company} />
                <Detail label="Portfolio" value={portfolioLabel(r.portfolio_size)} />
                <Detail label="Asked for" value={r.plan_interest === "enterprise" ? "An Enterprise quote" : "A demo"} />
                <Detail label="Received" value={formatDemoTime(r.created_at)} />
                <Detail label="Team email" value={r.team_notified_at ? `Sent ${formatDemoTime(r.team_notified_at)}` : "Not sent"} />
                <Detail
                  label="Confirmation to them"
                  value={r.confirmation_sent_at ? `Sent ${formatDemoTime(r.confirmation_sent_at)}` : "Not sent"}
                />
              </dl>
            </CardContent>
          </Card>
          <DeleteDemoRequestButton requestId={r.id} company={r.company} />
        </div>
      </div>
    </div>
  );
}
