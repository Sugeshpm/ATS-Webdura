-- =============================================================================
-- 00022 — Applicant-supplied message on the application row
--
-- The WordPress careers form has a "Message" field where applicants can
-- write a short note to the recruiter (cover-letter style). Store it on
-- applications so it displays in context on the candidate detail page.
--
-- Purely additive — nullable column, no data touched on existing rows.
-- =============================================================================

alter table public.applications
  add column if not exists applicant_message text;

comment on column public.applications.applicant_message is
  'Optional message from the applicant, captured at submission via the public intake API.';
