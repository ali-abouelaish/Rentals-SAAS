/**
 * Realistic mock data for the Maintenance module.
 * Used as a fallback when Phase 4 DB migrations have not yet been applied.
 * All monetary amounts in pence unless noted.
 */

import type { MaintenanceJob, MaintenanceCost, MaintenanceSummary } from "../domain/types";

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

const makeCost = (jobId: string, overrides: Partial<MaintenanceCost> = {}): MaintenanceCost => ({
  id: `mc-${Math.random().toString(36).slice(2, 8)}`,
  tenant_id: "mock",
  job_id: jobId,
  property_cost_id: null,
  description: "Labour",
  amount: 0,
  date_incurred: "2026-04-01",
  supplier: null,
  invoice_ref: null,
  created_at: "2026-04-01T00:00:00Z",
  ...overrides,
});

const makeJob = (id: string, overrides: Partial<MaintenanceJob>): MaintenanceJob => ({
  id,
  tenant_id: "mock",
  property_id: "prop1",
  unit_id: null,
  title: "Maintenance Job",
  description: null,
  category: "other",
  priority: "medium",
  status: "open",
  reported_by: null,
  assigned_to: null,
  scheduled_date: null,
  resolved_date: null,
  total_cost: 0,
  created_at: "2026-04-01T00:00:00Z",
  updated_at: "2026-04-01T00:00:00Z",
  property_name: "14 Mastmaker Road",
  unit_label: null,
  costs: [],
  photos: [],
  ...overrides,
});

// ──────────────────────────────────────────────────────────
// Costs for specific jobs
// ──────────────────────────────────────────────────────────

const job1Costs: MaintenanceCost[] = [
  makeCost("j1", { id: "mc1a", description: "Drain cleaning — Dyno-Rod call-out", amount: 18000, supplier: "Dyno-Rod", date_incurred: "2026-03-28" }),
  makeCost("j1", { id: "mc1b", description: "Replacement pipe section + fittings", amount: 4500, supplier: "Travis Perkins", date_incurred: "2026-03-29" }),
];

const job4Costs: MaintenanceCost[] = [
  makeCost("j4", { id: "mc4a", description: "Washing machine diagnosis call-out", amount: 8500, supplier: "Hotpoint Service", date_incurred: "2026-04-01" }),
];

const job7Costs: MaintenanceCost[] = [
  makeCost("j7", { id: "mc7a", description: "Professional deep clean (rooms + carpets + oven)", amount: 35000, supplier: "CleanPro Ltd", date_incurred: "2026-03-10" }),
];

const job9Costs: MaintenanceCost[] = [
  makeCost("j9", { id: "mc9a", description: "Plumber call-out + tap cartridge replacement", amount: 12000, supplier: "Local Plumbing Co", date_incurred: "2026-03-20" }),
];

// ──────────────────────────────────────────────────────────
// Mock Jobs (12 total)
// ──────────────────────────────────────────────────────────

export const MOCK_JOBS: MaintenanceJob[] = [
  makeJob("j1", {
    property_id: "prop1", property_name: "14 Mastmaker Road",
    title: "Blocked drain in main bathroom",
    description: "Drain completely blocked — water backing up into shower tray. Affecting shared bathroom on floor 2.",
    category: "plumbing", priority: "high", status: "in_progress",
    reported_by: "Mohammed Al-Rashid (Room 3)", assigned_to: "Dyno-Rod",
    scheduled_date: "2026-04-05",
    total_cost: 22500,
    costs: job1Costs,
    created_at: "2026-03-27T09:15:00Z",
    updated_at: "2026-03-29T11:00:00Z",
  }),
  makeJob("j2", {
    property_id: "prop2", property_name: "37 Sussex Gardens",
    title: "Boiler not producing hot water",
    description: "Boiler showing error code E1. No hot water or heating across the entire property. 5 tenants affected.",
    category: "plumbing", priority: "critical", status: "open",
    reported_by: "Emma Thompson (Room 1)", assigned_to: null,
    scheduled_date: "2026-04-05",
    total_cost: 0,
    created_at: "2026-04-03T07:30:00Z",
    updated_at: "2026-04-03T07:30:00Z",
  }),
  makeJob("j3", {
    property_id: "prop3", property_name: "22 Balham High Road",
    title: "Faulty plug socket sparking in kitchen",
    description: "Kitchen double socket sparking when appliances are plugged in. Potential fire risk — socket taped off and labelled. Do not use.",
    category: "electrical", priority: "high", status: "open",
    reported_by: "Priya Sharma (Room 2)", assigned_to: "Swift Electrical",
    scheduled_date: "2026-04-06",
    total_cost: 0,
    created_at: "2026-04-02T14:00:00Z",
    updated_at: "2026-04-02T14:00:00Z",
  }),
  makeJob("j4", {
    property_id: "prop1", property_name: "14 Mastmaker Road",
    unit_label: "Room 5",
    title: "Washing machine stops mid-cycle (error F5)",
    description: "Shared washing machine in utility room stops and displays error code F5. Engineer suspects drum bearing — parts ordered.",
    category: "appliance", priority: "medium", status: "pending_parts",
    reported_by: "Staff inspection", assigned_to: "Hotpoint Service",
    scheduled_date: "2026-04-10",
    total_cost: 8500,
    costs: job4Costs,
    created_at: "2026-04-01T11:00:00Z",
    updated_at: "2026-04-02T14:00:00Z",
  }),
  makeJob("j5", {
    property_id: "prop4", property_name: "8 Rope Street",
    title: "Cracked plaster in bedroom 2 ceiling",
    description: "Large crack running from corner to centre of bedroom 2 ceiling. Possibly related to upstairs bathroom overflow. Awaiting structural quote.",
    category: "structural", priority: "low", status: "pending_quote",
    reported_by: "Aleksandra Kowalski", assigned_to: null,
    total_cost: 0,
    created_at: "2026-03-25T16:00:00Z",
    updated_at: "2026-03-26T09:00:00Z",
  }),
  makeJob("j6", {
    property_id: "prop5", property_name: "91 Cambridge Heath Road",
    title: "Mouse infestation in kitchen",
    description: "Tenant reports droppings under kitchen sink and inside cupboards. Initial traps set. Professional pest control visit arranged.",
    category: "pest_control", priority: "critical", status: "in_progress",
    reported_by: "Daniel Chen (Room 4)", assigned_to: "PestControl Pro",
    scheduled_date: "2026-04-04",
    total_cost: 0,
    created_at: "2026-04-01T08:00:00Z",
    updated_at: "2026-04-01T10:00:00Z",
  }),
  makeJob("j7", {
    property_id: "prop2", property_name: "37 Sussex Gardens",
    unit_label: "Room 3",
    title: "Professional deep clean — end of tenancy",
    description: "Room 3 vacated on 09/03. Full deep clean including carpets, oven, bathroom grout, and windows.",
    category: "cleaning", priority: "low", status: "resolved",
    reported_by: "Admin", assigned_to: "CleanPro Ltd",
    resolved_date: "2026-03-12",
    total_cost: 35000,
    costs: job7Costs,
    created_at: "2026-03-08T10:00:00Z",
    updated_at: "2026-03-12T16:00:00Z",
  }),
  makeJob("j8", {
    property_id: "prop3", property_name: "22 Balham High Road",
    title: "Repaint hallway and staircase",
    description: "Hallway paint heavily scuffed and marked with crayon and stickers. Needs full repaint before next inspection.",
    category: "decoration", priority: "low", status: "open",
    reported_by: "Staff inspection", assigned_to: null,
    total_cost: 0,
    created_at: "2026-03-30T13:00:00Z",
    updated_at: "2026-03-30T13:00:00Z",
  }),
  makeJob("j9", {
    property_id: "prop4", property_name: "8 Rope Street",
    title: "Dripping tap in bathroom",
    description: "Hot tap in bathroom dripping continuously. Wasting water and causing noise at night.",
    category: "plumbing", priority: "low", status: "resolved",
    reported_by: "Jasmine Okonkwo", assigned_to: "Local Plumbing Co",
    resolved_date: "2026-03-22",
    total_cost: 12000,
    costs: job9Costs,
    created_at: "2026-03-18T11:30:00Z",
    updated_at: "2026-03-22T14:00:00Z",
  }),
  makeJob("j10", {
    property_id: "prop1", property_name: "14 Mastmaker Road",
    title: "Shared fridge not maintaining temperature",
    description: "Kitchen fridge temperature reads 12°C. Food spoiling within 2 days. May need regas or compressor replacement.",
    category: "appliance", priority: "medium", status: "in_progress",
    reported_by: "Sophie Laurent (Room 1)", assigned_to: "Hotpoint Service",
    scheduled_date: "2026-04-07",
    total_cost: 0,
    created_at: "2026-04-02T10:00:00Z",
    updated_at: "2026-04-03T09:00:00Z",
  }),
  makeJob("j11", {
    property_id: "prop5", property_name: "91 Cambridge Heath Road",
    unit_label: "Room 2",
    title: "Damaged door frame — door won't close properly",
    description: "Door frame for Room 2 appears cracked or warped — door drags and won't latch. Could be structural movement or simple frame damage.",
    category: "structural", priority: "medium", status: "pending_quote",
    reported_by: "Staff inspection", assigned_to: null,
    total_cost: 0,
    created_at: "2026-03-28T14:00:00Z",
    updated_at: "2026-03-29T10:00:00Z",
  }),
  makeJob("j12", {
    property_id: "prop2", property_name: "37 Sussex Gardens",
    title: "Annual EICR — electrical safety inspection",
    description: "Electrical Installation Condition Report (EICR) due by end of April. Book a qualified Part P electrician.",
    category: "electrical", priority: "medium", status: "open",
    reported_by: "Admin", assigned_to: null,
    scheduled_date: "2026-04-25",
    total_cost: 0,
    created_at: "2026-03-31T09:00:00Z",
    updated_at: "2026-03-31T09:00:00Z",
  }),
];

// ──────────────────────────────────────────────────────────
// Dashboard Summary
// ──────────────────────────────────────────────────────────

export const MOCK_MAINTENANCE_SUMMARY: MaintenanceSummary = {
  open_jobs: 5,
  in_progress_jobs: 3,
  critical_jobs: 2,
  resolved_this_month: 2,
  total_cost_this_month: 78000, // pence (£780)
};
