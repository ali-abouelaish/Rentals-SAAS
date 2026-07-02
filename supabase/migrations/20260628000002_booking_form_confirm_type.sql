-- Add 'confirm' as a valid question_type on booking_form_questions so admins can
-- add a mandatory "must press Yes" confirmation field (e.g. "I agree to the terms"),
-- matching the generic forms feature. The confirmation prompt is stored in the
-- existing question_text column; the answer is captured as the string "Yes".

alter table public.booking_form_questions
  drop constraint if exists booking_form_questions_question_type_check;

alter table public.booking_form_questions
  add constraint booking_form_questions_question_type_check
  check (question_type in (
    'text','textarea','email','phone','date',
    'select','checkbox','file_upload','number','info','confirm'
  ));
