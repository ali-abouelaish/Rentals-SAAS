"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import {
  EvaluationFormSchema,
  calculateBreakEven,
  poundsToP,
  type EvaluationStatus,
} from "../domain/types";

// ──────────────────────────────────────────────────────────
// Create Evaluation
// ──────────────────────────────────────────────────────────

export async function createEvaluation(
  raw: z.infer<typeof EvaluationFormSchema>
) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const values = EvaluationFormSchema.parse(raw);

  // Convert £ inputs to pence
  const furniture_cost = poundsToP(values.furniture_cost);
  const refurbishment_cost = poundsToP(values.refurbishment_cost);
  const upfront_fees = poundsToP(values.upfront_fees);
  const agency_fees = poundsToP(values.agency_fees);
  const other_setup_costs = poundsToP(values.other_setup_costs);
  const rent_to_landlord_pcm = poundsToP(values.rent_to_landlord_pcm);
  const bills_pcm = poundsToP(values.bills_pcm);
  const council_tax_pcm = poundsToP(values.council_tax_pcm);
  const cleaning_pcm = poundsToP(values.cleaning_pcm);
  const insurance_pcm = poundsToP(values.insurance_pcm);
  const other_costs_pcm = poundsToP(values.other_costs_pcm);

  // Convert room rents to pence
  const rooms = values.rooms.map((r) => ({
    ...r,
    expected_rent_pcm: poundsToP(r.expected_rent_pcm),
    ai_recommended_rent_pcm: r.ai_recommended_rent_pcm
      ? poundsToP(r.ai_recommended_rent_pcm)
      : null,
  }));

  const calcs = calculateBreakEven({
    rooms,
    occupancy_rate: values.expected_occupancy_rate,
    rent_to_landlord_pcm,
    bills_pcm,
    council_tax_pcm,
    cleaning_pcm,
    insurance_pcm,
    other_costs_pcm,
    furniture_cost,
    refurbishment_cost,
    upfront_fees,
    agency_fees,
    other_setup_costs,
  });

  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("evaluations")
    .insert({
      tenant_id: profile.tenant_id,
      portfolio_id: values.portfolio_id,
      created_by: profile.id,
      status: "considering",

      address: values.address,
      postcode: values.postcode,
      detected_area: values.detected_area,
      property_type: values.property_type,
      total_rooms: values.total_rooms,
      furnished: values.furnished,

      furniture_cost: values.furnished ? null : furniture_cost,
      refurbishment_cost: refurbishment_cost || null,
      upfront_fees: upfront_fees || null,
      agency_fees: agency_fees || null,
      other_setup_costs: other_setup_costs || null,
      other_setup_costs_label: values.other_setup_costs_label || null,
      total_setup_cost: calcs.total_setup_cost,

      rent_to_landlord_pcm,
      bills_pcm: bills_pcm || null,
      council_tax_pcm: council_tax_pcm || null,
      cleaning_pcm: cleaning_pcm || null,
      insurance_pcm: insurance_pcm || null,
      other_costs_pcm: other_costs_pcm || null,
      other_costs_label: values.other_costs_label || null,
      total_monthly_costs: calcs.total_monthly_costs,

      expected_occupancy_rate: values.expected_occupancy_rate,
      rooms,
      projected_monthly_income: calcs.projected_monthly_income,

      monthly_net_profit: calcs.monthly_net_profit,
      break_even_months: calcs.break_even_months,
      break_even_date: calcs.break_even_date,
      annual_roi_percentage: calcs.annual_roi_percentage,

      actual_vs_predicted_notes: values.actual_vs_predicted_notes || null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/acquisition-insights");
  return data.id as string;
}

// ──────────────────────────────────────────────────────────
// Update status
// ──────────────────────────────────────────────────────────

export async function updateEvaluationStatus(
  id: string,
  status: EvaluationStatus
) {
  await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("evaluations")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/acquisition-insights");
  revalidatePath(`/acquisition-insights/${id}`);
}

// ──────────────────────────────────────────────────────────
// Link to live property
// ──────────────────────────────────────────────────────────

export async function linkEvaluationToProperty(
  evaluationId: string,
  propertyId: string
) {
  await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("evaluations")
    .update({
      linked_property_id: propertyId,
      status: "taken_on",
      updated_at: new Date().toISOString(),
    })
    .eq("id", evaluationId);

  if (error) throw new Error(error.message);
  revalidatePath("/acquisition-insights");
  revalidatePath(`/acquisition-insights/${evaluationId}`);
}

// ──────────────────────────────────────────────────────────
// Save AI results
// ──────────────────────────────────────────────────────────

export async function saveAIRecommendations(
  evaluationId: string,
  payload: {
    ai_recommended_rents: unknown;
    ai_recommended_occupancy: number;
    ai_reasoning: string;
    ai_comparable_properties: unknown;
    ai_risk_flags: unknown;
  }
) {
  await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("evaluations")
    .update({
      ai_recommended_rents: payload.ai_recommended_rents,
      ai_recommended_occupancy: payload.ai_recommended_occupancy,
      ai_reasoning: payload.ai_reasoning,
      ai_comparable_properties: payload.ai_comparable_properties,
      ai_risk_flags: payload.ai_risk_flags,
      ai_generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", evaluationId);

  if (error) throw new Error(error.message);
  revalidatePath(`/acquisition-insights/${evaluationId}`);
}

// ──────────────────────────────────────────────────────────
// Update outcome notes
// ──────────────────────────────────────────────────────────

export async function updateOutcomeNotes(
  evaluationId: string,
  notes: string
) {
  await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("evaluations")
    .update({
      actual_vs_predicted_notes: notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", evaluationId);

  if (error) throw new Error(error.message);
  revalidatePath(`/acquisition-insights/${evaluationId}`);
}
