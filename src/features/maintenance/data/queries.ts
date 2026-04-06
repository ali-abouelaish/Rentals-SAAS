"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MaintenanceJob, MaintenanceCost, MaintenancePhoto, MaintenanceSummary } from "../domain/types";
import { MOCK_JOBS, MOCK_MAINTENANCE_SUMMARY } from "./mock";

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

const isMissingTable = (err: unknown): boolean => {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("schema cache") ||
    msg.includes("does not exist") ||
    msg.includes("relation")
  );
};

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
  return {
    ...(j as unknown as MaintenanceJob),
    property_name: (prop as { name?: string } | null)?.name ?? "Unknown",
    unit_label: buildUnitLabel(
      unit as { unit_type: string; room_number: number | null; room_type: string | null } | null
    ),
    costs,
    photos,
  };
}

// ──────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────

/** Fetch all maintenance jobs for the current tenant, newest first. */
export async function getAllMaintenanceJobs(): Promise<MaintenanceJob[]> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("maintenance_jobs")
      .select(
        `*, properties(name), units(unit_type, room_number, room_type), maintenance_costs(*), maintenance_photos(*)`
      )
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((j) => mapJobRow(j as unknown as Record<string, unknown>));
  } catch (err) {
    if (isMissingTable(err)) return MOCK_JOBS;
    console.error("getAllMaintenanceJobs error:", err);
    return MOCK_JOBS;
  }
}

/** Fetch a single job by ID (includes costs + photos). */
export async function getMaintenanceJob(jobId: string): Promise<MaintenanceJob | null> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("maintenance_jobs")
      .select(
        `*, properties(name), units(unit_type, room_number, room_type), maintenance_costs(*), maintenance_photos(*)`
      )
      .eq("id", jobId)
      .single();
    if (error) throw error;
    if (!data) return null;
    return mapJobRow(data as unknown as Record<string, unknown>);
  } catch (err) {
    if (isMissingTable(err)) return MOCK_JOBS.find((j) => j.id === jobId) ?? null;
    console.error("getMaintenanceJob error:", err);
    return null;
  }
}

/** Aggregate summary counts + costs for the dashboard card. */
export async function getMaintenanceSummary(): Promise<MaintenanceSummary> {
  try {
    const supabase = createSupabaseServerClient();

    const { error: tableCheck } = await supabase
      .from("maintenance_jobs")
      .select("id")
      .limit(1);
    if (tableCheck) throw tableCheck;

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
  } catch (err) {
    if (isMissingTable(err)) return MOCK_MAINTENANCE_SUMMARY;
    console.error("getMaintenanceSummary error:", err);
    return MOCK_MAINTENANCE_SUMMARY;
  }
}
