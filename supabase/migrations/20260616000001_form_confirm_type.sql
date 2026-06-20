-- Add 'confirm' question type: a declaration the respondent must explicitly accept
-- to submit the form (blocks submission if not confirmed).

alter table public.form_questions
  drop constraint if exists form_questions_question_type_check;

alter table public.form_questions
  add constraint form_questions_question_type_check
  check (question_type in (
    'text','textarea','email','phone','date',
    'select','checkbox','number','info','file','confirm'
  ));
