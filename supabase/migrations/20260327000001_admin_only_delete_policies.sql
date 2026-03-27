-- Admin-only delete policies for all tables that support deletion

-- clients
drop policy if exists "clients delete" on clients;
create policy "clients delete"
on clients for delete
using (tenant_id = current_tenant_id() and is_admin());

-- rental_codes: replace existing policy (was agent or admin) with admin-only
drop policy if exists "rentals delete" on rental_codes;
create policy "rentals delete"
on rental_codes for delete
using (tenant_id = current_tenant_id() and is_admin());

-- landlords
drop policy if exists "landlords delete" on landlords;
create policy "landlords delete"
on landlords for delete
using (tenant_id = current_tenant_id() and is_admin());

-- bonuses
drop policy if exists "bonuses delete" on bonuses;
create policy "bonuses delete"
on bonuses for delete
using (tenant_id = current_tenant_id() and is_admin());

-- invoices
drop policy if exists "invoices delete" on invoices;
create policy "invoices delete"
on invoices for delete
using (tenant_id = current_tenant_id() and is_admin());

-- invoice_items (cascade-deleted when deleting an invoice)
drop policy if exists "invoice items delete" on invoice_items;
create policy "invoice items delete"
on invoice_items for delete
using (tenant_id = current_tenant_id() and is_admin());

-- invoice_bonus_links (cascade-deleted when deleting an invoice)
drop policy if exists "invoice bonus links delete" on invoice_bonus_links;
create policy "invoice bonus links delete"
on invoice_bonus_links for delete
using (tenant_id = current_tenant_id() and is_admin());
