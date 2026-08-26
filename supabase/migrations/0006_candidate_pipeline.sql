-- ============================================================================
-- Candidate Portal Pipeline - Admin Configuration Columns
-- ============================================================================

-- Job openings: online exam configuration + window set by Admin
alter table public.job_openings
  add column if not exists total_questions int not null default 30,
  add column if not exists exam_duration_mins int not null default 60,
  add column if not exists exam_passing_score int not null default 70,
  add column if not exists exam_window_start timestamptz,
  add column if not exists exam_window_end timestamptz,
  add column if not exists exam_link text;

-- Candidates: category routing, malpractice / AI-tool cheating flags, exam result
alter table public.candidates
  add column if not exists category text not null default 'Fresher', -- Fresher | Experienced
  add column if not exists malpractice_flag boolean not null default false,
  add column if not exists cheating_detected boolean not null default false,
  add column if not exists exam_score int,
  add column if not exists exam_completed_at timestamptz;

-- Interviews: 4-metric scorecard (jsonb) + candidate slot confirmation
alter table public.interviews
  add column if not exists metrics jsonb,
  add column if not exists candidate_confirmed boolean not null default false;

-- Offers: dynamic terms & conditions + exact CTC breakdown
alter table public.offers
  add column if not exists service_bond_years int,
  add column if not exists relocation_required boolean not null default false,
  add column if not exists relocation_location text,
  add column if not exists salary_breakdown jsonb;
