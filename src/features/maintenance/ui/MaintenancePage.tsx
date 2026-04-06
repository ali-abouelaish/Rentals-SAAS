"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Plus,
  List,
  LayoutGrid,
  Search,
  Wrench,
  CalendarDays,
  User,
  ChevronRight,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils/cn";
import {
  JOB_STATUS_LABELS,
  JOB_PRIORITY_LABELS,
  JOB_PRIORITY_COLORS,
  JOB_STATUS_COLORS,
  JOB_CATEGORY_LABELS,
  KANBAN_COLUMNS,
} from "../domain/types";
import type { MaintenanceJob, JobStatus } from "../domain/types";
import { updateJobStatus } from "../actions";
import { KanbanBoard } from "./KanbanBoard";
import { JobDrawer } from "./JobDrawer";
import { RaiseJobModal } from "./RaiseJobModal";

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

function fmtPounds(pence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(pence / 100);
}

function daysAgo(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return "Today";
  if (d === 1) return "1d ago";
  return `${d}d ago`;
}

// ──────────────────────────────────────────────────────────
// List Row
// ──────────────────────────────────────────────────────────

interface JobRowProps {
  job: MaintenanceJob;
  onClick: () => void;
}

function JobRow({ job, onClick }: JobRowProps) {
  const pColors = JOB_PRIORITY_COLORS[job.priority];
  const sColors = JOB_STATUS_COLORS[job.status];

  return (
    <tr
      onClick={onClick}
      className="group cursor-pointer hover:bg-surface-inset transition-colors"
    >
      {/* Priority */}
      <td className="py-3 pr-3 pl-4 w-4">
        <span className={cn("h-2 w-2 rounded-full block", pColors.dot)} title={JOB_PRIORITY_LABELS[job.priority]} />
      </td>
      {/* Title + property */}
      <td className="py-3 pr-4">
        <p className="text-sm font-medium text-foreground line-clamp-1">{job.title}</p>
        <p className="text-xs text-foreground-secondary flex items-center gap-1 mt-0.5">
          <Wrench size={10} className="shrink-0" />
          {job.property_name}
          {job.unit_label && <span className="text-foreground-muted">· {job.unit_label}</span>}
        </p>
      </td>
      {/* Category */}
      <td className="py-3 pr-4 hidden md:table-cell">
        <span className="text-xs text-foreground-secondary">{JOB_CATEGORY_LABELS[job.category]}</span>
      </td>
      {/* Status */}
      <td className="py-3 pr-4">
        <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold", sColors.bg, sColors.text)}>
          {JOB_STATUS_LABELS[job.status]}
        </span>
      </td>
      {/* Priority label */}
      <td className="py-3 pr-4 hidden lg:table-cell">
        <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold border", pColors.bg, pColors.text, pColors.border)}>
          {JOB_PRIORITY_LABELS[job.priority]}
        </span>
      </td>
      {/* Assigned */}
      <td className="py-3 pr-4 hidden xl:table-cell">
        {job.assigned_to ? (
          <span className="text-xs text-foreground-secondary flex items-center gap-1">
            <User size={11} />
            {job.assigned_to}
          </span>
        ) : (
          <span className="text-xs text-foreground-muted">—</span>
        )}
      </td>
      {/* Scheduled */}
      <td className="py-3 pr-4 hidden xl:table-cell">
        {job.scheduled_date ? (
          <span className="text-xs text-foreground-secondary flex items-center gap-1">
            <CalendarDays size={11} />
            {new Date(job.scheduled_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          </span>
        ) : (
          <span className="text-xs text-foreground-muted">—</span>
        )}
      </td>
      {/* Cost */}
      <td className="py-3 pr-4 hidden sm:table-cell text-right">
        {job.total_cost > 0 ? (
          <span className="text-xs font-medium text-foreground tabular-nums flex items-center gap-1 justify-end">
            <DollarSign size={11} className="text-emerald-600" />
            {fmtPounds(job.total_cost)}
          </span>
        ) : (
          <span className="text-xs text-foreground-muted">—</span>
        )}
      </td>
      {/* Age + chevron */}
      <td className="py-3 pr-4 text-right">
        <div className="flex items-center justify-end gap-2">
          <span className="text-[11px] text-foreground-muted">{daysAgo(job.created_at)}</span>
          <ChevronRight size={14} className="text-foreground-muted group-hover:text-foreground transition-colors" />
        </div>
      </td>
    </tr>
  );
}

// ──────────────────────────────────────────────────────────
// Status filter pills
// ──────────────────────────────────────────────────────────

const STATUS_FILTERS: Array<{ label: string; value: JobStatus | "all" }> = [
  { label: "All", value: "all" },
  { label: "Open", value: "open" },
  { label: "In Progress", value: "in_progress" },
  { label: "Pending", value: "pending_parts" },
  { label: "Resolved", value: "resolved" },
];

// ──────────────────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────────────────

interface MaintenancePageProps {
  jobs: MaintenanceJob[];
  properties: { id: string; name: string }[];
  initialJobId?: string;
}

export function MaintenancePage({ jobs: initialJobs, properties, initialJobId }: MaintenancePageProps) {
  const [jobs, setJobs] = useState<MaintenanceJob[]>(initialJobs);
  const [view, setView] = useState<"list" | "kanban">("list");
  const [statusFilter, setStatusFilter] = useState<JobStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [raiseOpen, setRaiseOpen] = useState(false);

  // Auto-open job from URL query param
  useEffect(() => {
    if (initialJobId) {
      const job = jobs.find((j) => j.id === initialJobId);
      if (job) {
        setSelectedJobId(initialJobId);
        setDrawerOpen(true);
      }
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedJob = useMemo(
    () => (selectedJobId ? jobs.find((j) => j.id === selectedJobId) ?? null : null),
    [jobs, selectedJobId]
  );

  const filtered = useMemo(() => {
    let result = jobs;
    if (statusFilter !== "all") {
      result = result.filter((j) => j.status === statusFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (j) =>
          j.title.toLowerCase().includes(q) ||
          (j.property_name ?? "").toLowerCase().includes(q) ||
          (j.assigned_to ?? "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [jobs, statusFilter, search]);

  function openJob(job: MaintenanceJob) {
    setSelectedJobId(job.id);
    setDrawerOpen(true);
  }

  async function handleStatusChange(jobId: string, newStatus: string) {
    const result = await updateJobStatus(jobId, newStatus);
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success(`Status → ${JOB_STATUS_LABELS[newStatus as JobStatus]}`);
      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, status: newStatus as JobStatus } : j))
      );
    }
  }

  function handleJobUpdated(updated: Partial<MaintenanceJob> & { id: string }) {
    setJobs((prev) =>
      prev.map((j) => (j.id === updated.id ? { ...j, ...updated } : j))
    );
  }

  // Summary counts
  const counts = useMemo(() => ({
    open: jobs.filter((j) => j.status === "open").length,
    in_progress: jobs.filter((j) => j.status === "in_progress").length,
    critical: jobs.filter((j) => j.priority === "critical" && !["resolved", "closed"].includes(j.status)).length,
    resolved: jobs.filter((j) => j.status === "resolved").length,
  }), [jobs]);

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading text-foreground">Maintenance</h1>
          <p className="text-sm text-foreground-secondary mt-0.5">{jobs.length} jobs total</p>
        </div>
        <button
          onClick={() => setRaiseOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-brand-fg hover:opacity-90 transition-opacity self-start sm:self-auto"
        >
          <Plus size={16} />
          Raise New Job
        </button>
      </div>

      {/* ── Summary stat chips ── */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: "Open", value: counts.open, color: "text-slate-700 bg-slate-100" },
          { label: "In Progress", value: counts.in_progress, color: "text-blue-700 bg-blue-100" },
          { label: "Critical", value: counts.critical, color: "text-red-700 bg-red-100" },
          { label: "Resolved", value: counts.resolved, color: "text-emerald-700 bg-emerald-100" },
        ].map((c) => (
          <span
            key={c.label}
            className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", c.color)}
          >
            {c.value} {c.label}
          </span>
        ))}
      </div>

      {/* ── Filter bar ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-0 sm:max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search jobs…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-surface-card text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-brand/50"
          />
        </div>

        {/* Status filters */}
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                statusFilter === f.value
                  ? "bg-brand text-brand-fg shadow-sm"
                  : "text-foreground-secondary hover:bg-surface-inset"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 rounded-xl border border-border bg-surface-card p-1 ml-auto shrink-0">
          <button
            onClick={() => setView("list")}
            className={cn(
              "p-2 rounded-lg transition-colors",
              view === "list" ? "bg-brand text-brand-fg" : "text-foreground-muted hover:text-foreground"
            )}
            title="List view"
          >
            <List size={15} />
          </button>
          <button
            onClick={() => setView("kanban")}
            className={cn(
              "p-2 rounded-lg transition-colors",
              view === "kanban" ? "bg-brand text-brand-fg" : "text-foreground-muted hover:text-foreground"
            )}
            title="Kanban view"
          >
            <LayoutGrid size={15} />
          </button>
        </div>
      </div>

      {/* ── List View ── */}
      {view === "list" && (
        <div className="rounded-bento bg-surface-card shadow-bento overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] font-semibold text-foreground-muted uppercase tracking-wider border-b border-border">
                  <th className="pb-3 pt-4 pl-4 w-4" />
                  <th className="text-left pb-3 pt-4 pr-4">Job</th>
                  <th className="text-left pb-3 pt-4 pr-4 hidden md:table-cell">Category</th>
                  <th className="text-left pb-3 pt-4 pr-4">Status</th>
                  <th className="text-left pb-3 pt-4 pr-4 hidden lg:table-cell">Priority</th>
                  <th className="text-left pb-3 pt-4 pr-4 hidden xl:table-cell">Assigned</th>
                  <th className="text-left pb-3 pt-4 pr-4 hidden xl:table-cell">Scheduled</th>
                  <th className="text-right pb-3 pt-4 pr-4 hidden sm:table-cell">Cost</th>
                  <th className="text-right pb-3 pt-4 pr-4">Age</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtered.map((job) => (
                  <JobRow
                    key={job.id}
                    job={job}
                    onClick={() => openJob(job)}
                  />
                ))}
              </tbody>
            </table>

            {filtered.length === 0 && (
              <div className="py-16 text-center">
                <Wrench size={32} className="mx-auto text-foreground-muted mb-3" strokeWidth={1.5} />
                <p className="text-sm text-foreground-secondary">
                  {search || statusFilter !== "all" ? "No jobs match your filters" : "No maintenance jobs yet"}
                </p>
                {!search && statusFilter === "all" && (
                  <button
                    onClick={() => setRaiseOpen(true)}
                    className="text-brand text-sm font-medium hover:underline mt-1"
                  >
                    Raise the first job
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Kanban View ── */}
      {view === "kanban" && (
        <div className="rounded-bento bg-surface-card shadow-bento p-5">
          <KanbanBoard
            jobs={filtered}
            onJobClick={openJob}
            onStatusChange={handleStatusChange}
          />
        </div>
      )}

      {/* ── Job Drawer ── */}
      <JobDrawer
        job={selectedJob}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onJobUpdated={handleJobUpdated}
      />

      {/* ── Raise Job Modal ── */}
      {raiseOpen && (
        <RaiseJobModal
          properties={properties}
          onClose={() => setRaiseOpen(false)}
          onSuccess={() => { setRaiseOpen(false); window.location.reload(); }}
        />
      )}
    </div>
  );
}
