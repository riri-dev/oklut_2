-- Slot capacity & canonical interview-date fields
-- Exam schedule canonical columns (replace legacy exam_window_start/end for schedule use)
alter table public.job_openings
  add column if not exists exam_start_date timestamptz,
  add column if not exists exam_end_date timestamptz,
  -- Per-slot max candidate capacity for interview slot pools
  add column if not exists technical_slot_1_max_count integer,
  add column if not exists technical_slot_2_max_count integer,
  add column if not exists technical_slot_3_max_count integer,
  add column if not exists hr_slot_1_max_count integer,
  add column if not exists hr_slot_2_max_count integer,
  add column if not exists hr_slot_3_max_count integer;

-- Candidate-bound interview timestamps (the slot the candidate selected)
alter table public.candidates
  add column if not exists technical_interview_date timestamptz,
  add column if not exists hr_interview_date timestamptz;

-- Slot pool rows are candidate-agnostic; slot_key identifies the slot
-- (e.g. technical_slot_1, hr_slot_2) whose max_count lives on job_openings
alter table public.interviews
  alter column candidate_id drop not null,
  add column if not exists slot_key text;

comment on column public.interviews.slot_key is 'Slot pool key (e.g. technical_slot_1). Max capacity per slot lives on job_openings.technical_*_max_count / hr_*_max_count.';
