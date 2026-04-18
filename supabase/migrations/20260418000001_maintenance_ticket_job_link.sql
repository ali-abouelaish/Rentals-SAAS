-- ============================================================
-- Link maintenance_tickets → maintenance_jobs
-- Enables "Convert ticket to job" flow: tenant-raised tickets
-- can be promoted into internal work orders for costing/tracking.
-- ============================================================

alter table public.maintenance_tickets
  add column if not exists job_id uuid
    references public.maintenance_jobs(id) on delete set null;

create index if not exists maintenance_tickets_tenant_job_idx
  on public.maintenance_tickets (tenant_id, job_id);
