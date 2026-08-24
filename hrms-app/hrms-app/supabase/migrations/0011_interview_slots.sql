-- ============================================================================
-- 0011 - Interview slot pools, reschedule requests & disqualification
--  1) interview_slots: recruiter/admin publishes as many slots as needed per
--     job opening (Technical + HR). Candidates pick one from the portal.
--  2) interviews: reschedule request details (reason + preferred time) and
--     attended_at marker for the live interview.
--  3) candidates: disqualification markers (missed interview / no slot chosen).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Slot pool — one row per published interview slot, scoped to a job opening.
-- ---------------------------------------------------------------------------
create table if not exists public.interview_slots (
  id uuid primary key default gen_random_uuid(),
  job_opening_id uuid not null references public.job_openings(id) on delete cascade,
  round text not null default 'technical' check (round in ('technical', 'hr')),
  scheduled_at timestamptz not null,
  meeting_link text,
  max_candidates int not null default 1,
  status text not null default 'open', -- open | closed
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_interview_slots_job_round
  on public.interview_slots (job_opening_id, round, scheduled_at);

alter table public.interview_slots enable row level security;

-- Candidates (authenticated) may browse the published slots; only managers
-- (admin/HR/recruiter) may create/edit/delete them.
create policy "interview_slots read"
  on public.interview_slots for select to authenticated using (true);

create policy "interview_slots write admin"
  on public.interview_slots for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- ---------------------------------------------------------------------------
-- 2. Interviews — reschedule request payload + live-attendance marker.
--    slot_key / candidate_confirmed are re-declared idempotently so this file
--    is safe to run even if the earlier slot migrations were never applied.
-- ---------------------------------------------------------------------------
alter table public.interviews
  add column if not exists slot_key text,
  add column if not exists candidate_confirmed boolean not null default false,
  add column if not exists reschedule_requested boolean not null default false,
  add column if not exists reschedule_status text,
  add column if not exists reschedule_reason text,
  add column if not exists reschedule_preferred_time timestamptz,
  add column if not exists reschedule_admin_note text,
  add column if not exists attended_at timestamptz;

comment on column public.interviews.reschedule_reason is 'Candidate free-text reason for a reschedule request (admin review).';
comment on column public.interviews.reschedule_preferred_time is 'Candidate-chosen alternate time for the reschedule request.';
comment on column public.interviews.reschedule_admin_note is 'Admin comment recorded when a reschedule request is rejected/approved (shown to the candidate).';
comment on column public.interviews.attended_at is 'Set when the candidate clicks Attend Interview in the portal.';

-- Candidates book their own slot: allow the candidate-own session to INSERT
-- interview rows (0008 only granted read/update).
drop policy if exists "interviews insert own" on public.interviews;
create policy "interviews insert own"
  on public.interviews for insert to authenticated
  with check (candidate_id in (select id from public.candidates where user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 3. Candidates — disqualification markers (policy-driven, not malpractice)
--    plus the interview/exam columns the candidate portal already reads and
--    writes (exam_started_at is written on exam start; *_status drives round
--    unlock; *_feedback is displayed to the candidate).
-- ---------------------------------------------------------------------------
alter table public.candidates
  add column if not exists disqualified_at timestamptz,
  add column if not exists disqualified_reason text,
  add column if not exists exam_started_at timestamptz,
  add column if not exists exam_feedback text,
  add column if not exists technical_interview_status text,
  add column if not exists technical_interview_feedback text,
  add column if not exists hr_interview_status text,
  add column if not exists hr_interview_feedback text;