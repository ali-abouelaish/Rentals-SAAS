-- Add 'file' question type and create form-uploads storage bucket

alter table public.form_questions
  drop constraint if exists form_questions_question_type_check;

alter table public.form_questions
  add constraint form_questions_question_type_check check (
    question_type in ('text','textarea','email','phone','date','select','checkbox','number','info','file')
  );

-- Private bucket — uploads happen via admin client, reads via signed URL
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'form-uploads',
  'form-uploads',
  false,
  10485760,
  ARRAY[
    'image/jpeg','image/png','image/webp','image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;

-- Admins can read files scoped to their own tenant
create policy "form_uploads_admin_read" on storage.objects
  for select using (
    bucket_id = 'form-uploads'
    and (storage.foldername(name))[1]::uuid = (select current_tenant_id())
    and is_admin()
  );
