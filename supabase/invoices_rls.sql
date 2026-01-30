alter table billing_profiles enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
alter table invoice_bonus_links enable row level security;
alter table email_templates enable row level security;
alter table tenant_invoice_counter enable row level security;

create policy "billing profiles select"
on billing_profiles for select
using (tenant_id = current_tenant_id());

create policy "billing profiles modify"
on billing_profiles for all
using (tenant_id = current_tenant_id() and is_admin())
with check (tenant_id = current_tenant_id() and is_admin());

create policy "invoices select"
on invoices for select
using (
  tenant_id = current_tenant_id()
  and (is_admin() or created_by_user_id = auth.uid())
);

create policy "invoices insert"
on invoices for insert
with check (
  tenant_id = current_tenant_id()
  and created_by_user_id = auth.uid()
);

create policy "invoices update"
on invoices for update
using (
  tenant_id = current_tenant_id()
  and (
    is_admin()
    or (created_by_user_id = auth.uid() and status = 'draft')
  )
)
with check (
  tenant_id = current_tenant_id()
  and (
    is_admin()
    or (created_by_user_id = auth.uid() and status in ('draft','submitted'))
  )
);

create policy "invoices delete"
on invoices for delete
using (
  tenant_id = current_tenant_id()
  and (is_admin() or (created_by_user_id = auth.uid() and status = 'draft'))
);

create policy "invoice items select"
on invoice_items for select
using (
  tenant_id = current_tenant_id()
  and exists (
    select 1 from invoices
    where invoices.id = invoice_items.invoice_id
      and invoices.tenant_id = current_tenant_id()
      and (is_admin() or invoices.created_by_user_id = auth.uid())
  )
);

create policy "invoice items modify"
on invoice_items for all
using (
  tenant_id = current_tenant_id()
  and exists (
    select 1 from invoices
    where invoices.id = invoice_items.invoice_id
      and invoices.tenant_id = current_tenant_id()
      and (
        is_admin()
        or (invoices.created_by_user_id = auth.uid() and invoices.status = 'draft')
      )
  )
)
with check (
  tenant_id = current_tenant_id()
  and exists (
    select 1 from invoices
    where invoices.id = invoice_items.invoice_id
      and invoices.tenant_id = current_tenant_id()
      and (
        is_admin()
        or (invoices.created_by_user_id = auth.uid() and invoices.status = 'draft')
      )
  )
);

create policy "invoice bonus links select"
on invoice_bonus_links for select
using (
  tenant_id = current_tenant_id()
  and exists (
    select 1 from invoices
    where invoices.id = invoice_bonus_links.invoice_id
      and invoices.tenant_id = current_tenant_id()
      and (is_admin() or invoices.created_by_user_id = auth.uid())
  )
);

create policy "invoice bonus links modify"
on invoice_bonus_links for all
using (
  tenant_id = current_tenant_id()
  and exists (
    select 1 from invoices
    where invoices.id = invoice_bonus_links.invoice_id
      and invoices.tenant_id = current_tenant_id()
      and (
        is_admin()
        or (invoices.created_by_user_id = auth.uid() and invoices.status = 'draft')
      )
  )
)
with check (
  tenant_id = current_tenant_id()
  and exists (
    select 1 from invoices
    where invoices.id = invoice_bonus_links.invoice_id
      and invoices.tenant_id = current_tenant_id()
      and (
        is_admin()
        or (invoices.created_by_user_id = auth.uid() and invoices.status = 'draft')
      )
  )
);

create policy "email templates select"
on email_templates for select
using (tenant_id = current_tenant_id());

create policy "email templates modify"
on email_templates for all
using (tenant_id = current_tenant_id() and is_admin())
with check (tenant_id = current_tenant_id() and is_admin());

create policy "invoice counter"
on tenant_invoice_counter for all
using (tenant_id = current_tenant_id())
with check (tenant_id = current_tenant_id());

-- Storage policies
create policy "billing logos read"
on storage.objects for select
using (
  bucket_id = 'billing-logos'
  and (storage.foldername(name))[1] = current_tenant_id()::text
);

create policy "billing logos write"
on storage.objects for insert
with check (
  bucket_id = 'billing-logos'
  and (storage.foldername(name))[1] = current_tenant_id()::text
  and is_admin()
);

create policy "invoice pdf read"
on storage.objects for select
using (
  bucket_id = 'invoices-pdf'
  and (storage.foldername(name))[1] = current_tenant_id()::text
);

create policy "invoice pdf write"
on storage.objects for insert
with check (
  bucket_id = 'invoices-pdf'
  and (storage.foldername(name))[1] = current_tenant_id()::text
  and is_admin()
);
