"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  MaintenanceJob,
  MaintenanceCost,
  MaintenancePhoto,
  MaintenanceJobComment,
  MaintenanceSummary,
} from "../domain/types";

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

function buildUnitLabel(
  unit: { unit_type: string; room_number: number | null; room_type: string | null } | null
): string | null {
  if (!unit) return null;
  if (unit.unit_type === "room" && unit.room_number) {
    const rt = unit.room_type
      ? ` · ${unit.room_type.charAt(0).toUpperCase() + unit.room_type.slice(1)}`
      : "";
    return `Room ${unit.room_number}${rt}`;
  }
  return unit.unit_type === "studio" ? "Studio" : "Whole Flat";
}

function mapJobRow(j: Record<string, unknown>): MaintenanceJob {
  const prop = Array.isArray(j.properties) ? j.properties[0] : j.properties;
  const unit = Array.isArray(j.units) ? j.units[0] : j.units;
  const costs = (Array.isArray(j.maintenance_costs) ? j.maintenance_costs : []) as MaintenanceCost[];
  const photos = (Array.isArray(j.maintenance_photos) ? j.maintenance_photos : []) as MaintenancePhoto[];
  const comments = (
    (Array.isArray(j.maintenance_job_comments) ? j.maintenance_job_comments : []) as MaintenanceJobComment[]
  ).sort((a, b) => a.created_at.localeCompare(b.created_at));
  return {
    ...(j as unknown as MaintenanceJob),
    property_name: (prop as { name?: string } | null)?.name ?? "Unknown",
    unit_label: buildUnitLabel(
      unit as { unit_type: string; room_number: number | null; room_type: string | null } | null
    ),
    costs,
    photos,
    comments,
  };
}

// ──────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────

/** Fetch all maintenance jobs for the current tenant, newest first. */
export async function getAllMaintenanceJobs(): Promise<MaintenanceJob[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("maintenance_jobs")
    .select(
      `*, properties(name), units(unit_type, room_number, room_type), maintenance_costs(*), maintenance_photos(*), maintenance_job_comments(*)`
    )
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((j) => mapJobRow(j as unknown as Record<string, unknown>));
}

/** Fetch a single job by ID (includes costs + photos). */
export async function getMaintenanceJob(jobId: string): Promise<MaintenanceJob | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("maintenance_jobs")
    .select(
      `*, properties(name), units(unit_type, room_number, room_type), maintenance_costs(*), maintenance_photos(*), maintenance_job_comments(*)`
    )
    .eq("id", jobId)
    .single();
  if (error) throw error;
  if (!data) return null;
  return mapJobRow(data as unknown as Record<string, unknown>);
}

/** Aggregate summary counts + costs for the dashboard card. */
export async function getMaintenanceSummary(): Promise<MaintenanceSummary> {
  const supabase = createSupabaseServerClient();

  const [jobsResult, costsResult] = await Promise.all([
    supabase
      .from("maintenance_jobs")
      .select("id, status, priority, resolved_date"),
    supabase
      .from("maintenance_costs")
      .select("amount, date_incurred"),
  ]);

  const jobs = jobsResult.data ?? [];
  const costs = costsResult.data ?? [];

  const d = new Date();
  d.setDate(1);
  const thisMonthStart = d.toISOString().split("T")[0];

  return {
    open_jobs: jobs.filter((j) => j.status === "open").length,
    in_progress_jobs: jobs.filter((j) => j.status === "in_progress").length,
    critical_jobs: jobs.filter(
      (j) => j.priority === "critical" && !["resolved", "closed"].includes(j.status)
    ).length,
    resolved_this_month: jobs.filter(
      (j) =>
        j.status === "resolved" &&
        j.resolved_date !== null &&
        j.resolved_date >= thisMonthStart
    ).length,
    total_cost_this_month: costs
      .filter((c) => c.date_incurred >= thisMonthStart)
      .reduce((s, c) => s + (c.amount ?? 0), 0),
  };
}
