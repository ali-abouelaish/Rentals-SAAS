-- Add 'info' as a valid question_type on form_questions so admins can mix
-- read-only note blocks into booking forms (e.g. holding-deposit explainer,
-- process overview). The info body is stored in the existing question_text
-- column; no new columns are required.

alter table public.form_questions
  drop constraint if exists form_questions_question_type_check;

alter table public.form_questions
  add constraint form_questions_question_type_check
  check (question_type in (
    'text','textarea','email','phone','date',
    'select','checkbox','file_upload','number','info'
  ));
