-- ============================================================================
-- Oklut HRMS - Pipeline Test Data Seed (18 candidates / 6 jobs)
-- ----------------------------------------------------------------------------
-- HOW TO RUN: Supabase Dashboard -> SQL Editor -> paste & run (or psql).
--   * Runs as the postgres role, so RLS policies are bypassed.
--   * Idempotent: fixed UUIDs + ON CONFLICT DO NOTHING -> safe to re-run.
--   * All candidate portal logins use password: 1234
--
-- SCHEMA NOTES (matches migrations 0001..0011):
--   * There is no separate "exams" table — exams are configured ON the job
--     opening (exam_start_date/exam_end_date + pass_percentage + total_questions)
--     and exam state per candidate is stored on candidates.exam_* columns.
--   * There is no separate "reschedule_requests" table — requests live on the
--     candidate's interviews row (reschedule_requested / reschedule_status /
--     reschedule_reason / reschedule_preferred_time / reschedule_admin_note).
--   * Progression history is logged in audit_logs (entity_type = 'candidate').
--
-- COVERAGE MAP (Candidate ID -> scenario):
--   CAND-01 exam live in progress     CAND-10 technical no-show -> disqualified
--   CAND-02 exam future (Batch B)     CAND-11 technical cleared -> HR unlocked
--   CAND-03 exam past & passed        CAND-12 technical failed -> rejected
--   CAND-04 exam past & missed        CAND-13 HR booked
--   CAND-05 exam past & failed        CAND-14 HR cleared -> offer drafted
--   CAND-06 tech slot selection open  CAND-15 offer sent (awaiting signature)
--   CAND-07 tech slot booked          CAND-16 offer accepted -> internship/hired
--   CAND-08 reschedule PENDING        CAND-17 offer accepted -> onboarding
--   CAND-09 reschedule REJECTED       CAND-18 exam future (UI/UX)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Defensive schema ensure — no-op when migrations 0001..0011 are applied.
--    reschedule_admin_note: admin comment shown to the candidate on rejection.
-- ---------------------------------------------------------------------------
alter table public.interviews
  add column if not exists reschedule_admin_note text;

-- ---------------------------------------------------------------------------
-- 1. Candidate auth accounts (login: temp_id / password 1234)
-- ---------------------------------------------------------------------------
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token,
  reauthentication_token, is_anonymous, is_sso_user, email_change_confirm_status
) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'aarav.sharma@candidate.oklut.com', extensions.crypt('1234', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"name":"Aarav Sharma","role":"Candidate"}', '', '', '', '', '', '', '', false, false, 0),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ananya.iyer@candidate.oklut.com', extensions.crypt('1234', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"name":"Ananya Iyer","role":"Candidate"}', '', '', '', '', '', '', '', false, false, 0),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rohan.mehta@candidate.oklut.com', extensions.crypt('1234', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"name":"Rohan Mehta","role":"Candidate"}', '', '', '', '', '', '', '', false, false, 0),
  ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'priya.patel@candidate.oklut.com', extensions.crypt('1234', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"name":"Priya Patel","role":"Candidate"}', '', '', '', '', '', '', '', false, false, 0),
  ('00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vikram.verma@candidate.oklut.com', extensions.crypt('1234', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"name":"Vikram Verma","role":"Candidate"}', '', '', '', '', '', '', '', false, false, 0),
  ('00000000-0000-0000-0000-000000000106', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rahul.nair@candidate.oklut.com', extensions.crypt('1234', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"name":"Rahul Nair","role":"Candidate"}', '', '', '', '', '', '', '', false, false, 0),
  ('00000000-0000-0000-0000-000000000107', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sneha.gupta@candidate.oklut.com', extensions.crypt('1234', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"name":"Sneha Gupta","role":"Candidate"}', '', '', '', '', '', '', '', false, false, 0),
  ('00000000-0000-0000-0000-000000000108', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ishan.reddy@candidate.oklut.com', extensions.crypt('1234', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"name":"Ishan Reddy","role":"Candidate"}', '', '', '', '', '', '', '', false, false, 0),
  ('00000000-0000-0000-0000-000000000109', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'kavya.joshi@candidate.oklut.com', extensions.crypt('1234', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"name":"Kavya Joshi","role":"Candidate"}', '', '', '', '', '', '', '', false, false, 0),
  ('00000000-0000-0000-0000-00000000010a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'aditya.singh@candidate.oklut.com', extensions.crypt('1234', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"name":"Aditya Singh","role":"Candidate"}', '', '', '', '', '', '', '', false, false, 0),
  ('00000000-0000-0000-0000-00000000010b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'meera.sen@candidate.oklut.com', extensions.crypt('1234', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"name":"Meera Sen","role":"Candidate"}', '', '', '', '', '', '', '', false, false, 0),
  ('00000000-0000-0000-0000-00000000010c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tanvi.kulkarni@candidate.oklut.com', extensions.crypt('1234', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"name":"Tanvi Kulkarni","role":"Candidate"}', '', '', '', '', '', '', '', false, false, 0),
  ('00000000-0000-0000-0000-00000000010d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'siddharth.das@candidate.oklut.com', extensions.crypt('1234', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"name":"Siddharth Das","role":"Candidate"}', '', '', '', '', '', '', '', false, false, 0),
  ('00000000-0000-0000-0000-00000000010e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pooja.rao@candidate.oklut.com', extensions.crypt('1234', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"name":"Pooja Rao","role":"Candidate"}', '', '', '', '', '', '', '', false, false, 0),
  ('00000000-0000-0000-0000-00000000010f', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rithvik.malhotra@candidate.oklut.com', extensions.crypt('1234', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"name":"Rithvik Malhotra","role":"Candidate"}', '', '', '', '', '', '', '', false, false, 0),
  ('00000000-0000-0000-0000-000000000110', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'neha.bansal@candidate.oklut.com', extensions.crypt('1234', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"name":"Neha Bansal","role":"Candidate"}', '', '', '', '', '', '', '', false, false, 0),
  ('00000000-0000-0000-0000-000000000111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'varun.kapoor@candidate.oklut.com', extensions.crypt('1234', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"name":"Varun Kapoor","role":"Candidate"}', '', '', '', '', '', '', '', false, false, 0),
  ('00000000-0000-0000-0000-000000000112', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'divya.bhat@candidate.oklut.com', extensions.crypt('1234', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"name":"Divya Bhat","role":"Candidate"}', '', '', '', '', '', '', '', false, false, 0)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Job openings
--    JOB-01..02,05,06 = Fresher (exam configured). JOB-03..04 = Experienced
--    (no exam — pipeline starts at the Technical round).
--    Exam windows: ACTIVE (now-1h .. now+2h), PAST (yesterday 14:00..17:00),
--    FUTURE (tomorrow 10:00..13:00).
--    NOTE: exam windows live on the job opening, so one window per job.
--    JOB-06 is a second "Junior Frontend Developer" batch used to host a
--    future exam for a frontend candidate (schema limitation, see header).
-- ---------------------------------------------------------------------------
insert into public.job_openings (
  id, title, department_id, location, openings_count, description, requirements,
  employment_type, status, published, created_at,
  total_questions, exam_duration_mins, exam_passing_score, pass_percentage,
  exam_start_date, exam_end_date, exam_window_start, exam_window_end, exam_link
) values
  ('00000000-0000-4000-8000-0000000001e1', 'Junior Frontend Developer',
   '00000000-0000-4000-8000-0000000000d1', 'Hyderabad', 4,
   'Build responsive, accessible web interfaces using React and modern CSS. Work closely with designers to ship pixel-perfect UI.',
   'Freshers / 0-1 year\nReact, JavaScript, HTML, CSS\nBasic understanding of REST APIs', 'Full-time', 'Open', true, now() - interval '21 days',
   30, 60, 21, 70,
   now() - interval '1 hour', now() + interval '2 hours',
   now() - interval '1 hour', now() + interval '2 hours',
   'https://exam.oklut.com/frontend-2026'),
  ('00000000-0000-4000-8000-0000000001e2', 'Junior Backend Developer',
   '00000000-0000-4000-8000-0000000000d1', 'Hyderabad', 3,
   'Design and build server-side services with Node.js and PostgreSQL. Write clean, testable APIs and database queries.',
   'Freshers / 0-1 year\nNode.js, JavaScript\nSQL fundamentals\nProblem solving skills', 'Full-time', 'Open', true, now() - interval '18 days',
   30, 60, 21, 70,
   date_trunc('day', now()) - interval '1 day' + interval '14 hours',
   date_trunc('day', now()) - interval '1 day' + interval '17 hours',
   date_trunc('day', now()) - interval '1 day' + interval '14 hours',
   date_trunc('day', now()) - interval '1 day' + interval '17 hours',
   'https://exam.oklut.com/backend-2026'),
  ('00000000-0000-4000-8000-0000000001e3', 'Senior Full Stack Engineer',
   '00000000-0000-4000-8000-0000000000d1', 'Hyderabad', 2,
   'Own full-stack features end to end — React frontend, Node.js services, PostgreSQL. Mentor junior engineers and lead design discussions.',
   '4+ years full stack\nReact, Node.js, TypeScript, PostgreSQL\nSystem design & mentoring', 'Full-time', 'Open', true, now() - interval '15 days',
   30, 60, 21, 70,
   null, null, null, null, null),
  ('00000000-0000-4000-8000-0000000001e4', 'DevOps Engineer',
   '00000000-0000-4000-8000-0000000000d1', 'Hyderabad', 2,
   'Own CI/CD pipelines, cloud infrastructure on AWS, monitoring and incident response. Automate everything.',
   '3+ years DevOps\nAWS, Docker, Kubernetes, Terraform\nCI/CD (GitHub Actions / Jenkins)', 'Full-time', 'Open', true, now() - interval '12 days',
   30, 60, 21, 70,
   null, null, null, null, null),
  ('00000000-0000-4000-8000-0000000001e5', 'UI/UX Designer',
   '00000000-0000-4000-8000-0000000000d3', 'Hyderabad', 2,
   'Design clean, modern interfaces, design systems and interactive prototypes for our platform.',
   'Freshers / 1 year\nFigma proficiency\nStrong portfolio\nBasic design thinking', 'Full-time', 'Open', true, now() - interval '10 days',
   30, 45, 21, 70,
   date_trunc('day', now()) + interval '1 day' + interval '10 hours',
   date_trunc('day', now()) + interval '1 day' + interval '13 hours',
   date_trunc('day', now()) + interval '1 day' + interval '10 hours',
   date_trunc('day', now()) + interval '1 day' + interval '13 hours',
   'https://exam.oklut.com/design-2026'),
  ('00000000-0000-4000-8000-0000000001e6', 'Junior Frontend Developer (Batch B)',
   '00000000-0000-4000-8000-0000000000d1', 'Bangalore', 2,
   'Second batch posting for the Junior Frontend role — hosts a future exam window for pipeline testing.',
   'Freshers / 0-1 year\nReact, JavaScript, HTML, CSS', 'Full-time', 'Open', true, now() - interval '9 days',
   30, 60, 21, 70,
   date_trunc('day', now()) + interval '1 day' + interval '10 hours',
   date_trunc('day', now()) + interval '1 day' + interval '13 hours',
   date_trunc('day', now()) + interval '1 day' + interval '10 hours',
   date_trunc('day', now()) + interval '1 day' + interval '13 hours',
   'https://exam.oklut.com/frontend-b2-2026')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Candidates (18) — portal logins: temp_id / 1234
-- ---------------------------------------------------------------------------
insert into public.candidates (
  id, temp_id, user_id, candidate_id, job_opening_id, name, email, phone,
  resume_url, cover_letter, status, source, applied_at, updated_at, category,
  exam_score, exam_completed_at, exam_started_at,
  technical_interview_status, technical_interview_time, technical_interview_feedback,
  hr_interview_status, hr_interview_time, hr_interview_feedback,
  technical_interview_date, hr_interview_date, disqualified_at, disqualified_reason
) values
  -- CAND-01: exam ACTIVE, in progress (started, not submitted)
  ('00000000-0000-4000-8000-000000000b01', 'ARAV-SHRM', '00000000-0000-0000-0000-000000000101', 'CND-0001', '00000000-0000-4000-8000-0000000001e1',
   'Aarav Sharma', 'aarav.sharma@candidate.oklut.com', '+91 90000 10001', 'https://resumes.oklut.com/aarav-sharma.pdf', 'Passionate about building web interfaces.', 'screening', 'Website', now() - interval '5 days', now(),
   'Fresher', null, null, now() - interval '10 minutes', null, null, null, null, null, null, null, null, null, null),
  -- CAND-02: exam FUTURE (Batch B posting) — waiting for exam time
  ('00000000-0000-4000-8000-000000000b02', 'ANAN-IYE', '00000000-0000-0000-0000-000000000102', 'CND-0002', '00000000-0000-4000-8000-0000000001e6',
   'Ananya Iyer', 'ananya.iyer@candidate.oklut.com', '+91 90000 10002', 'https://resumes.oklut.com/ananya-iyer.pdf', null, 'applied', 'LinkedIn', now() - interval '3 days', now(),
   'Fresher', null, null, null, null, null, null, null, null, null, null, null, null, null),
  -- CAND-03: exam PAST & PASSED (26/30 = 87%) — technical unlocked, no slot yet
  ('00000000-0000-4000-8000-000000000b03', 'ROHA-MEH', '00000000-0000-0000-0000-000000000103', 'CND-0003', '00000000-0000-4000-8000-0000000001e2',
   'Rohan Mehta', 'rohan.mehta@candidate.oklut.com', '+91 90000 10003', 'https://resumes.oklut.com/rohan-mehta.pdf', null, 'screening', 'Website', now() - interval '8 days', now(),
   'Fresher', 26, date_trunc('day', now()) - interval '1 day' + interval '16 hours', null,
   null, null, null, null, null, null, null, null, null, null),
  -- CAND-04: exam PAST & MISSED — unattempted, expired window => rejected
  ('00000000-0000-4000-8000-000000000b04', 'PRIY-PAT', '00000000-0000-0000-0000-000000000104', 'CND-0004', '00000000-0000-4000-8000-0000000001e2',
   'Priya Patel', 'priya.patel@candidate.oklut.com', '+91 90000 10004', 'https://resumes.oklut.com/priya-patel.pdf', null, 'rejected', 'Referral', now() - interval '6 days', now(),
   'Fresher', null, null, null, null, null, null, null, null, null, null, null, null, null),
  -- CAND-05: exam PAST & FAILED (12/30 = 40% < 70%) => rejected
  ('00000000-0000-4000-8000-000000000b05', 'VIKR-VER', '00000000-0000-0000-0000-000000000105', 'CND-0005', '00000000-0000-4000-8000-0000000001e2',
   'Vikram Verma', 'vikram.verma@candidate.oklut.com', '+91 90000 10005', 'https://resumes.oklut.com/vikram-verma.pdf', null, 'rejected', 'Website', now() - interval '7 days', now(),
   'Fresher', 12, date_trunc('day', now()) - interval '1 day' + interval '15 hours', null,
   null, null, null, null, null, null, null, null, null, null),
  -- CAND-06: Experienced, technical slot selection OPEN (no booking yet)
  ('00000000-0000-4000-8000-000000000b06', 'RAHU-NAI', '00000000-0000-0000-0000-000000000106', 'CND-0006', '00000000-0000-4000-8000-0000000001e3',
   'Rahul Nair', 'rahul.nair@candidate.oklut.com', '+91 90000 10006', 'https://resumes.oklut.com/rahul-nair.pdf', '8 years full stack experience.', 'interview', 'LinkedIn', now() - interval '9 days', now(),
   'Experienced', null, null, null, null, null, null, null, null, null, null, null, null, null),
  -- CAND-07: technical slot BOOKED — today 19:00 (> 2h away)
  ('00000000-0000-4000-8000-000000000b07', 'SNEH-GUP', '00000000-0000-0000-0000-000000000107', 'CND-0007', '00000000-0000-4000-8000-0000000001e3',
   'Sneha Gupta', 'sneha.gupta@candidate.oklut.com', '+91 90000 10007', 'https://resumes.oklut.com/sneha-gupta.pdf', null, 'interview', 'Website', now() - interval '8 days', now(),
   'Experienced', null, null, null, 'scheduled', now() + interval '4 hours', null, null, null, null, null, null, null, null),
  -- CAND-08: technical booked + reschedule PENDING (health emergency)
  ('00000000-0000-4000-8000-000000000b08', 'ISHA-RED', '00000000-0000-0000-0000-000000000108', 'CND-0008', '00000000-0000-4000-8000-0000000001e4',
   'Ishan Reddy', 'ishan.reddy@candidate.oklut.com', '+91 90000 10008', 'https://resumes.oklut.com/ishan-reddy.pdf', null, 'interview', 'Referral', now() - interval '7 days', now(),
   'Experienced', null, null, null, 'scheduled', now() + interval '1 day', null, null, null, null, null, null, null, null),
  -- CAND-09: technical booked + reschedule REJECTED (forced back to original slot)
  ('00000000-0000-4000-8000-000000000b09', 'KAVY-JOS', '00000000-0000-0000-0000-000000000109', 'CND-0009', '00000000-0000-4000-8000-0000000001e4',
   'Kavya Joshi', 'kavya.joshi@candidate.oklut.com', '+91 90000 10009', 'https://resumes.oklut.com/kavya-joshi.pdf', null, 'interview', 'Website', now() - interval '6 days', now(),
   'Experienced', null, null, null, 'scheduled', now() + interval '3 hours', null, null, null, null, null, null, null, null),
  -- CAND-10: Fresher, exam passed, technical NO-SHOW -> disqualified
  ('00000000-0000-4000-8000-000000000b0a', 'ADIT-SIN', '00000000-0000-0000-0000-00000000010a', 'CND-0010', '00000000-0000-4000-8000-0000000001e1',
   'Aditya Singh', 'aditya.singh@candidate.oklut.com', '+91 90000 10010', 'https://resumes.oklut.com/aditya-singh.pdf', null, 'rejected', 'Website', now() - interval '12 days', now(),
   'Fresher', 24, now() - interval '6 days', null,
   'scheduled', now() - interval '1 day', null, null, null, null, null, null,
   now() - interval '1 day', 'You did not attend the Technical interview within its scheduled window.'),
  -- CAND-11: exam passed + TECHNICAL CLEARED -> HR unlocked (no HR slot yet)
  ('00000000-0000-4000-8000-000000000b0b', 'MEER-SEN', '00000000-0000-0000-0000-00000000010b', 'CND-0011', '00000000-0000-4000-8000-0000000001e2',
   'Meera Sen', 'meera.sen@candidate.oklut.com', '+91 90000 10011', 'https://resumes.oklut.com/meera-sen.pdf', null, 'interview', 'Campus', now() - interval '14 days', now(),
   'Fresher', 27, now() - interval '5 days', null,
   'passed', now() - interval '2 days', 'Strong problem solving and clean communication. Recommended for the HR round.', null, null, null, null, null, null, null),
  -- CAND-12: TECHNICAL FAILED -> rejected
  ('00000000-0000-4000-8000-000000000b0c', 'TANV-KUL', '00000000-0000-0000-0000-00000000010c', 'CND-0012', '00000000-0000-4000-8000-0000000001e3',
   'Tanvi Kulkarni', 'tanvi.kulkarni@candidate.oklut.com', '+91 90000 10012', 'https://resumes.oklut.com/tanvi-kulkarni.pdf', null, 'rejected', 'LinkedIn', now() - interval '10 days', now(),
   'Experienced', null, null, null,
   'failed', now() - interval '1 day', 'Lacked depth in system design fundamentals for the senior role.', null, null, null, null, null, null, null),
  -- CAND-13: technical cleared + HR slot BOOKED (tomorrow 11:00)
  ('00000000-0000-4000-8000-000000000b0d', 'SIDD-DAS', '00000000-0000-0000-0000-00000000010d', 'CND-0013', '00000000-0000-4000-8000-0000000001e3',
   'Siddharth Das', 'siddharth.das@candidate.oklut.com', '+91 90000 10013', 'https://resumes.oklut.com/siddharth-das.pdf', null, 'interview', 'Referral', now() - interval '16 days', now(),
   'Experienced', null, null, null, 'passed', now() - interval '3 days', 'Excellent technical depth and leadership potential.', 'scheduled', now() + interval '1 day', null, null, now() + interval '1 day', null, null),
  -- CAND-14: technical + HR CLEARED -> offer stage (draft offer)
  ('00000000-0000-4000-8000-000000000b0e', 'POOJ-RAO', '00000000-0000-0000-0000-00000000010e', 'CND-0014', '00000000-0000-4000-8000-0000000001e4',
   'Pooja Rao', 'pooja.rao@candidate.oklut.com', '+91 90000 10014', 'https://resumes.oklut.com/pooja-rao.pdf', null, 'offer', 'Website', now() - interval '20 days', now(),
   'Experienced', null, null, null, 'passed', now() - interval '5 days', 'Solid cloud architecture knowledge.', 'passed', now() - interval '2 days', 'Great culture fit and stable career record.', now() - interval '5 days', now() - interval '2 days', null, null),
  -- CAND-15: all rounds cleared -> OFFER RELEASED (awaiting signature)
  ('00000000-0000-4000-8000-000000000b0f', 'RITH-MAL', '00000000-0000-0000-0000-00000000010f', 'CND-0015', '00000000-0000-4000-8000-0000000001e1',
   'Rithvik Malhotra', 'rithvik.malhotra@candidate.oklut.com', '+91 90000 10015', 'https://resumes.oklut.com/rithvik-malhotra.pdf', null, 'offer', 'Campus', now() - interval '25 days', now(),
   'Fresher', 25, now() - interval '12 days', null,
   'passed', now() - interval '9 days', 'Strong fundamentals and rapid learning curve.', 'passed', now() - interval '6 days', 'Confident communicator, good team fit.', now() - interval '9 days', now() - interval '6 days', null, null),
  -- CAND-16: all rounds cleared + offer ACCEPTED -> internship onboarded (hired)
  ('00000000-0000-4000-8000-000000000b10', 'NEHA-BAN', '00000000-0000-0000-0000-000000000110', 'CND-0016', '00000000-0000-4000-8000-0000000001e2',
   'Neha Bansal', 'neha.bansal@candidate.oklut.com', '+91 90000 10016', 'https://resumes.oklut.com/neha-bansal.pdf', null, 'hired', 'Campus', now() - interval '40 days', now(),
   'Fresher', 28, now() - interval '25 days', null,
   'passed', now() - interval '20 days', 'Outstanding coding ability for a fresher.', 'passed', now() - interval '15 days', 'Very good communication and attitude.', now() - interval '20 days', now() - interval '15 days', null, null),
  -- CAND-17: all rounds cleared + offer ACCEPTED -> ready for onboarding
  ('00000000-0000-4000-8000-000000000b11', 'VARU-KAP', '00000000-0000-0000-0000-000000000111', 'CND-0017', '00000000-0000-4000-8000-0000000001e3',
   'Varun Kapoor', 'varun.kapoor@candidate.oklut.com', '+91 90000 10017', 'https://resumes.oklut.com/varun-kapoor.pdf', null, 'selected', 'LinkedIn', now() - interval '35 days', now(),
   'Experienced', null, null, null, 'passed', now() - interval '18 days', 'Top-tier engineering and communication.', 'passed', now() - interval '12 days', 'Excellent leadership and stability.', now() - interval '18 days', now() - interval '12 days', null, null),
  -- CAND-18: UI/UX Fresher — exam FUTURE (tomorrow 10:00)
  ('00000000-0000-4000-8000-000000000b12', 'DIVY-BHA', '00000000-0000-0000-0000-000000000112', 'CND-0018', '00000000-0000-4000-8000-0000000001e5',
   'Divya Bhat', 'divya.bhat@candidate.oklut.com', '+91 90000 10018', 'https://resumes.oklut.com/divya-bhat.pdf', null, 'applied', 'Website', now() - interval '2 days', now(),
   'Fresher', null, null, null, null, null, null, null, null, null, null, null, null, null)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 4. Auth identities (enables signInWithPassword for the portal session)
-- ---------------------------------------------------------------------------
insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at)
select
  gen_random_uuid(),
  c.user_id::text,
  c.user_id,
  jsonb_build_object('sub', c.user_id::text, 'email', lower(c.email), 'email_verified', true),
  'email',
  now(),
  now()
from public.candidates c
where c.user_id is not null
  and not exists (select 1 from auth.identities i where i.provider_id = c.user_id::text)
on conflict (provider_id, provider) do nothing;

-- ---------------------------------------------------------------------------
-- 5. Interview slots (interview_slots table — recruiter-published pools)
--    Times: today 17:00 / 19:00, tomorrow 11:00 (requirement) + expired slots
--    from yesterday for the no-show scenario.
-- ---------------------------------------------------------------------------
insert into public.interview_slots (
  id, job_opening_id, round, scheduled_at, meeting_link, max_candidates, status, created_by, created_at
) values
  -- JOB-01 Junior Frontend (CAND-10 no-show used yesterday's slot)
  ('00000000-0000-4000-8000-000000000f01', '00000000-0000-4000-8000-0000000001e1', 'technical', date_trunc('day', now()) + interval '17 hours', 'https://meet.google.com/okl-frnt-001', 3, 'open', (select id from public.users where email = 'ceo@oklut.com'), now() - interval '3 days'),
  ('00000000-0000-4000-8000-000000000f02', '00000000-0000-4000-8000-0000000001e1', 'technical', date_trunc('day', now()) - interval '1 day' + interval '10 hours', 'https://meet.google.com/okl-frnt-002', 2, 'open', (select id from public.users where email = 'ceo@oklut.com'), now() - interval '5 days'),
  ('00000000-0000-4000-8000-000000000f03', '00000000-0000-4000-8000-0000000001e1', 'hr', date_trunc('day', now()) + interval '1 day' + interval '11 hours', 'https://meet.google.com/okl-frnt-hr01', 2, 'open', (select id from public.users where email = 'ceo@oklut.com'), now() - interval '3 days'),
  -- JOB-02 Junior Backend (CAND-03 can book technical; CAND-11 can book HR)
  ('00000000-0000-4000-8000-000000000f04', '00000000-0000-4000-8000-0000000001e2', 'technical', date_trunc('day', now()) + interval '19 hours', 'https://meet.google.com/okl-back-001', 2, 'open', (select id from public.users where email = 'ceo@oklut.com'), now() - interval '2 days'),
  ('00000000-0000-4000-8000-000000000f05', '00000000-0000-4000-8000-0000000001e2', 'technical', date_trunc('day', now()) + interval '1 day' + interval '11 hours', 'https://meet.google.com/okl-back-002', 2, 'open', (select id from public.users where email = 'ceo@oklut.com'), now() - interval '2 days'),
  ('00000000-0000-4000-8000-000000000f06', '00000000-0000-4000-8000-0000000001e2', 'hr', date_trunc('day', now()) + interval '1 day' + interval '11 hours', 'https://meet.google.com/okl-back-hr01', 2, 'open', (select id from public.users where email = 'ceo@oklut.com'), now() - interval '2 days'),
  -- JOB-03 Senior Full Stack (CAND-06 selection open, CAND-07 booked 19:00, CAND-13 HR booked tomorrow 11:00)
  ('00000000-0000-4000-8000-000000000f07', '00000000-0000-4000-8000-0000000001e3', 'technical', date_trunc('day', now()) + interval '17 hours', 'https://meet.google.com/okl-sfs-001', 3, 'open', (select id from public.users where email = 'ceo@oklut.com'), now() - interval '6 days'),
  ('00000000-0000-4000-8000-000000000f08', '00000000-0000-4000-8000-0000000001e3', 'technical', date_trunc('day', now()) + interval '19 hours', 'https://meet.google.com/okl-sfs-002', 2, 'open', (select id from public.users where email = 'ceo@oklut.com'), now() - interval '6 days'),
  ('00000000-0000-4000-8000-000000000f09', '00000000-0000-4000-8000-0000000001e3', 'technical', date_trunc('day', now()) + interval '1 day' + interval '11 hours', 'https://meet.google.com/okl-sfs-003', 2, 'open', (select id from public.users where email = 'ceo@oklut.com'), now() - interval '6 days'),
  ('00000000-0000-4000-8000-000000000f0a', '00000000-0000-4000-8000-0000000001e3', 'hr', date_trunc('day', now()) + interval '1 day' + interval '11 hours', 'https://meet.google.com/okl-sfs-hr01', 2, 'open', (select id from public.users where email = 'ceo@oklut.com'), now() - interval '4 days'),
  -- JOB-04 DevOps (CAND-08 pending reschedule, CAND-09 booked 17:00)
  ('00000000-0000-4000-8000-000000000f0b', '00000000-0000-4000-8000-0000000001e4', 'technical', date_trunc('day', now()) + interval '17 hours', 'https://meet.google.com/okl-dev-001', 2, 'open', (select id from public.users where email = 'ceo@oklut.com'), now() - interval '4 days'),
  ('00000000-0000-4000-8000-000000000f0c', '00000000-0000-4000-8000-0000000001e4', 'technical', date_trunc('day', now()) + interval '19 hours', 'https://meet.google.com/okl-dev-002', 2, 'open', (select id from public.users where email = 'ceo@oklut.com'), now() - interval '4 days'),
  ('00000000-0000-4000-8000-000000000f0d', '00000000-0000-4000-8000-0000000001e4', 'technical', date_trunc('day', now()) + interval '1 day' + interval '11 hours', 'https://meet.google.com/okl-dev-003', 2, 'open', (select id from public.users where email = 'ceo@oklut.com'), now() - interval '4 days'),
  ('00000000-0000-4000-8000-000000000f0e', '00000000-0000-4000-8000-0000000001e4', 'hr', date_trunc('day', now()) + interval '1 day' + interval '11 hours', 'https://meet.google.com/okl-dev-hr01', 2, 'open', (select id from public.users where email = 'ceo@oklut.com'), now() - interval '3 days')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 6. Interviews (bookings, requests & scorecards)
--    Technical metrics: Domain Knowledge / Communication / Body Language / Adaptability
--    HR metrics: Culture Fit / Decorum / Stability / Teamwork
--    Interviewers: EMP-0002 (Meera Sharma, SWE) for Technical, EMP-0001 (HR) for HR.
-- ---------------------------------------------------------------------------
insert into public.interviews (
  id, candidate_id, job_opening_id, interviewer_id, round, scheduled_at, mode,
  meeting_link, status, feedback, rating, metrics, candidate_confirmed, slot_key,
  reschedule_requested, reschedule_status, reschedule_reason,
  reschedule_preferred_time, reschedule_admin_note, attended_at, created_at
) values
  -- CAND-07: Technical booked — today 19:00 (>2h away, reschedule window open)
  ('00000000-0000-4000-8000-000000000c01', '00000000-0000-4000-8000-000000000b07', '00000000-0000-4000-8000-0000000001e3',
   (select id from public.employees where email = 'employee@oklut.com'), 'Technical', date_trunc('day', now()) + interval '19 hours', 'online',
    'https://meet.google.com/okl-sfs-002', 'scheduled', null, null, null, true, '00000000-0000-4000-8000-000000000f08',
    false, null, null, null, null, null, null, now() - interval '1 day'),
  -- CAND-08: Technical booked tomorrow 11:00 + reschedule PENDING (health emergency)
  ('00000000-0000-4000-8000-000000000c02', '00000000-0000-4000-8000-000000000b08', '00000000-0000-4000-8000-0000000001e4',
   (select id from public.employees where email = 'employee@oklut.com'), 'Technical', date_trunc('day', now()) + interval '1 day' + interval '11 hours', 'online',
   'https://meet.google.com/okl-dev-003', 'scheduled', null, null, null, true, '00000000-0000-4000-8000-000000000f0d',
   true, 'pending', 'Health emergency — hospital visit, unable to travel this week.',
   date_trunc('week', now()) + interval '7 days' + interval '11 hours', null, null, now() - interval '1 day'),
  -- CAND-09: Technical booked today 17:00 + reschedule REJECTED (personal conflict)
  ('00000000-0000-4000-8000-000000000c03', '00000000-0000-4000-8000-000000000b09', '00000000-0000-4000-8000-0000000001e4',
   (select id from public.employees where email = 'employee@oklut.com'), 'Technical', date_trunc('day', now()) + interval '17 hours', 'online',
   'https://meet.google.com/okl-dev-001', 'scheduled', null, null, null, true, '00000000-0000-4000-8000-000000000f0b',
   false, 'rejected', 'Personal conflict — a family commitment falls on the same time.',
   date_trunc('week', now()) + interval '8 days' + interval '11 hours', 'Slots full on requested date', null, now() - interval '1 day'),
  -- CAND-10: Technical no-show — yesterday 10:00, never attended (disqualified)
  ('00000000-0000-4000-8000-000000000c04', '00000000-0000-4000-8000-000000000b0a', '00000000-0000-4000-8000-0000000001e1',
   (select id from public.employees where email = 'employee@oklut.com'), 'Technical', date_trunc('day', now()) - interval '1 day' + interval '10 hours', 'online',
   'https://meet.google.com/okl-frnt-002', 'scheduled', null, null, null, true, '00000000-0000-4000-8000-000000000f02',
   false, null, null, null, null, null, now() - interval '4 days'),
  -- CAND-11: Technical PASSED (scorecard) — unlocks HR
  ('00000000-0000-4000-8000-000000000c05', '00000000-0000-4000-8000-000000000b0b', '00000000-0000-4000-8000-0000000001e2',
   (select id from public.employees where email = 'employee@oklut.com'), 'Technical', now() - interval '2 days', 'online',
   'https://meet.google.com/okl-back-int', 'passed', 'Strong problem solving and clean communication. Recommended for the HR round.',
   4.5, '{"Domain Knowledge": 5, "Communication": 4, "Body Language": 4, "Adaptability": 5}', true, null,
   false, null, null, null, null, now() - interval '2 days' + interval '30 minutes', now() - interval '4 days'),
  -- CAND-12: Technical FAILED
  ('00000000-0000-4000-8000-000000000c06', '00000000-0000-4000-8000-000000000b0c', '00000000-0000-4000-8000-0000000001e3',
   (select id from public.employees where email = 'employee@oklut.com'), 'Technical', now() - interval '1 day', 'online',
   'https://meet.google.com/okl-sfs-int', 'failed', 'Lacked depth in system design fundamentals for the senior role.',
   2.0, '{"Domain Knowledge": 2, "Communication": 3, "Body Language": 2, "Adaptability": 1}', true, null,
   false, null, null, null, null, now() - interval '1 day' + interval '40 minutes', now() - interval '3 days'),
  -- CAND-13: Technical PASSED + HR booked tomorrow 11:00
  ('00000000-0000-4000-8000-000000000c07', '00000000-0000-4000-8000-000000000b0d', '00000000-0000-4000-8000-0000000001e3',
   (select id from public.employees where email = 'employee@oklut.com'), 'Technical', now() - interval '3 days', 'online',
   'https://meet.google.com/okl-sfs-int', 'passed', 'Excellent technical depth and leadership potential.',
   4.8, '{"Domain Knowledge": 5, "Communication": 5, "Body Language": 5, "Adaptability": 4}', true, null,
   false, null, null, null, null, now() - interval '3 days' + interval '35 minutes', now() - interval '6 days'),
  ('00000000-0000-4000-8000-000000000c08', '00000000-0000-4000-8000-000000000b0d', '00000000-0000-4000-8000-0000000001e3',
   (select id from public.employees where email = 'hr@oklut.com'), 'HR', date_trunc('day', now()) + interval '1 day' + interval '11 hours', 'online',
   'https://meet.google.com/okl-sfs-hr01', 'scheduled', null, null, null, true, '00000000-0000-4000-8000-000000000f0a',
   false, null, null, null, null, null, now() - interval '1 day'),
  -- CAND-14: Technical + HR PASSED (moving to offer)
  ('00000000-0000-4000-8000-000000000c09', '00000000-0000-4000-8000-000000000b0e', '00000000-0000-4000-8000-0000000001e4',
   (select id from public.employees where email = 'employee@oklut.com'), 'Technical', now() - interval '5 days', 'online',
   'https://meet.google.com/okl-dev-int', 'passed', 'Solid cloud architecture knowledge.',
   4.3, '{"Domain Knowledge": 4, "Communication": 4, "Body Language": 5, "Adaptability": 4}', true, null,
   false, null, null, null, null, now() - interval '5 days' + interval '25 minutes', now() - interval '8 days'),
  ('00000000-0000-4000-8000-000000000c0a', '00000000-0000-4000-8000-000000000b0e', '00000000-0000-4000-8000-0000000001e4',
   (select id from public.employees where email = 'hr@oklut.com'), 'HR', now() - interval '2 days', 'online',
   'https://meet.google.com/okl-dev-hr-int', 'passed', 'Great culture fit and stable career record.',
   4.6, '{"Culture Fit": 5, "Decorum": 5, "Stability": 4, "Teamwork": 4}', true, null,
   false, null, null, null, null, now() - interval '2 days' + interval '30 minutes', now() - interval '6 days'),
  -- CAND-15: Technical + HR PASSED (offer released)
  ('00000000-0000-4000-8000-000000000c0b', '00000000-0000-4000-8000-000000000b0f', '00000000-0000-4000-8000-0000000001e1',
   (select id from public.employees where email = 'employee@oklut.com'), 'Technical', now() - interval '9 days', 'online',
   'https://meet.google.com/okl-frnt-int', 'passed', 'Strong fundamentals and rapid learning curve.',
   4.2, '{"Domain Knowledge": 4, "Communication": 4, "Body Language": 4, "Adaptability": 5}', true, null,
   false, null, null, null, null, now() - interval '9 days' + interval '30 minutes', now() - interval '13 days'),
  ('00000000-0000-4000-8000-000000000c0c', '00000000-0000-4000-8000-000000000b0f', '00000000-0000-4000-8000-0000000001e1',
   (select id from public.employees where email = 'hr@oklut.com'), 'HR', now() - interval '6 days', 'online',
   'https://meet.google.com/okl-frnt-hr-int', 'passed', 'Confident communicator, good team fit.',
   4.4, '{"Culture Fit": 5, "Decorum": 4, "Stability": 4, "Teamwork": 5}', true, null,
   false, null, null, null, null, now() - interval '6 days' + interval '25 minutes', now() - interval '10 days'),
  -- CAND-16: Technical + HR PASSED (internship accepted)
  ('00000000-0000-4000-8000-000000000c0d', '00000000-0000-4000-8000-000000000b10', '00000000-0000-4000-8000-0000000001e2',
   (select id from public.employees where email = 'employee@oklut.com'), 'Technical', now() - interval '20 days', 'online',
   'https://meet.google.com/okl-back-int', 'passed', 'Outstanding coding ability for a fresher.',
   4.7, '{"Domain Knowledge": 5, "Communication": 4, "Body Language": 5, "Adaptability": 5}', true, null,
   false, null, null, null, null, now() - interval '20 days' + interval '35 minutes', now() - interval '25 days'),
  ('00000000-0000-4000-8000-000000000c0e', '00000000-0000-4000-8000-000000000b10', '00000000-0000-4000-8000-0000000001e2',
   (select id from public.employees where email = 'hr@oklut.com'), 'HR', now() - interval '15 days', 'online',
   'https://meet.google.com/okl-back-hr-int', 'passed', 'Very good communication and attitude.',
   4.5, '{"Culture Fit": 5, "Decorum": 4, "Stability": 5, "Teamwork": 4}', true, null,
   false, null, null, null, null, now() - interval '15 days' + interval '30 minutes', now() - interval '20 days'),
  -- CAND-17: Technical + HR PASSED (offer accepted)
  ('00000000-0000-4000-8000-000000000c0f', '00000000-0000-4000-8000-000000000b11', '00000000-0000-4000-8000-0000000001e3',
   (select id from public.employees where email = 'employee@oklut.com'), 'Technical', now() - interval '18 days', 'online',
   'https://meet.google.com/okl-sfs-int', 'passed', 'Top-tier engineering and communication.',
   4.9, '{"Domain Knowledge": 5, "Communication": 5, "Body Language": 5, "Adaptability": 5}', true, null,
   false, null, null, null, null, now() - interval '18 days' + interval '40 minutes', now() - interval '22 days'),
  ('00000000-0000-4000-8000-000000000c10', '00000000-0000-4000-8000-000000000b11', '00000000-0000-4000-8000-0000000001e3',
   (select id from public.employees where email = 'hr@oklut.com'), 'HR', now() - interval '12 days', 'online',
   'https://meet.google.com/okl-sfs-hr-int', 'passed', 'Excellent leadership and stability.',
   4.8, '{"Culture Fit": 5, "Decorum": 5, "Stability": 5, "Teamwork": 4}', true, null,
   false, null, null, null, null, now() - interval '12 days' + interval '30 minutes', now() - interval '16 days')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 7. Offers
--    CAND-14 draft (offer generation in progress), CAND-15 sent (awaiting
--    signature), CAND-16 accepted (internship), CAND-17 accepted (full-time).
-- ---------------------------------------------------------------------------
insert into public.offers (
  id, candidate_id, job_opening_id, offer_letter_url, salary_offered, joining_date,
  status, issued_by, created_at, service_bond_years, relocation_required,
  relocation_location, salary_breakdown, candidate_response, relocation_agreed, bond_agreed
) values
  ('00000000-0000-4000-8000-000000000d01', '00000000-0000-4000-8000-000000000b0e', '00000000-0000-4000-8000-0000000001e4',
   null, 1800000, (date_trunc('day', now()) + interval '5 weeks')::date,
   'draft', (select id from public.users where email = 'ceo@oklut.com'), now(),
   2, true, 'Hyderabad',
   '{"base_salary": 1200000, "variable": 200000, "allowances": 400000, "gross_total": 1800000}',
   null, null, null),
  ('00000000-0000-4000-8000-000000000d02', '00000000-0000-4000-8000-000000000b0f', '00000000-0000-4000-8000-0000000001e1',
   'https://offers.oklut.com/cnd-0015.pdf', 660000, (date_trunc('day', now()) + interval '6 weeks')::date,
   'sent', (select id from public.users where email = 'ceo@oklut.com'), now() - interval '2 days',
   2, false, null,
   '{"base_salary": 480000, "variable": 60000, "allowances": 120000, "gross_total": 660000}',
   null, null, null),
  ('00000000-0000-4000-8000-000000000d03', '00000000-0000-4000-8000-000000000b10', '00000000-0000-4000-8000-0000000001e2',
   'https://offers.oklut.com/cnd-0016.pdf', 420000, (date_trunc('day', now()) + interval '4 weeks')::date,
   'accepted', (select id from public.users where email = 'ceo@oklut.com'), now() - interval '12 days',
   2, false, null,
   '{"base_salary": 300000, "variable": 40000, "allowances": 80000, "gross_total": 420000}',
   'accept', false, true),
  ('00000000-0000-4000-8000-000000000d04', '00000000-0000-4000-8000-000000000b11', '00000000-0000-4000-8000-0000000001e3',
   'https://offers.oklut.com/cnd-0017.pdf', 2600000, (date_trunc('day', now()) + interval '3 weeks')::date,
   'accepted', (select id from public.users where email = 'ceo@oklut.com'), now() - interval '8 days',
   2, true, 'Hyderabad',
   '{"base_salary": 1800000, "variable": 300000, "allowances": 500000, "gross_total": 2600000}',
   'accept', true, true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 8. Progression history (audit_logs — entity_type = 'candidate')
--    Logged for candidates in advanced stages so the progression trail shows
--    every stage they cleared. Admin user = ceo@oklut.com.
-- ---------------------------------------------------------------------------
insert into public.audit_logs (user_id, action, entity_type, entity_id, details, created_at) values
  ((select id from public.users where email = 'ceo@oklut.com'), 'Exam Started', 'candidate', 'CAND-0001', '{"stage": "Online Exam", "status": "in_progress"}', now() - interval '10 minutes'),
  ((select id from public.users where email = 'ceo@oklut.com'), 'Application Submitted', 'candidate', 'CAND-0002', '{"stage": "Applied"}', now() - interval '3 days'),
  ((select id from public.users where email = 'ceo@oklut.com'), 'Exam Passed', 'candidate', 'CAND-0003', '{"stage": "Online Exam", "status": "passed", "score": 26, "out_of": 30, "percentage": 87}', now() - interval '1 day'),
  ((select id from public.users where email = 'ceo@oklut.com'), 'Exam Missed', 'candidate', 'CAND-0004', '{"stage": "Online Exam", "status": "expired_unattempted"}', now() - interval '1 day'),
  ((select id from public.users where email = 'ceo@oklut.com'), 'Exam Failed', 'candidate', 'CAND-0005', '{"stage": "Online Exam", "status": "failed", "score": 12, "out_of": 30, "percentage": 40}', now() - interval '1 day'),
  ((select id from public.users where email = 'ceo@oklut.com'), 'Application Submitted', 'candidate', 'CAND-0006', '{"stage": "Applied"}', now() - interval '9 days'),
  ((select id from public.users where email = 'ceo@oklut.com'), 'Technical Slot Booked', 'candidate', 'CAND-0007', '{"stage": "Technical Round", "status": "booked"}', now() - interval '1 day'),
  ((select id from public.users where email = 'ceo@oklut.com'), 'Reschedule Requested', 'candidate', 'CAND-0008', '{"stage": "Technical Round", "status": "pending", "reason": "Health emergency"}', now() - interval '6 hours'),
  ((select id from public.users where email = 'ceo@oklut.com'), 'Reschedule Rejected', 'candidate', 'CAND-0009', '{"stage": "Technical Round", "status": "rejected", "admin_note": "Slots full on requested date"}', now() - interval '1 day'),
  ((select id from public.users where email = 'ceo@oklut.com'), 'Exam Passed', 'candidate', 'CAND-0010', '{"stage": "Online Exam", "status": "passed", "score": 24, "out_of": 30}', now() - interval '6 days'),
  ((select id from public.users where email = 'ceo@oklut.com'), 'Technical No-Show', 'candidate', 'CAND-0010', '{"stage": "Technical Round", "status": "disqualified", "reason": "Missed scheduled interview without rescheduling"}', now() - interval '1 day'),
  ((select id from public.users where email = 'ceo@oklut.com'), 'Exam Passed', 'candidate', 'CAND-0011', '{"stage": "Online Exam", "status": "passed", "score": 27, "out_of": 30}', now() - interval '5 days'),
  ((select id from public.users where email = 'ceo@oklut.com'), 'Technical Round Passed', 'candidate', 'CAND-0011', '{"stage": "Technical Round", "status": "passed", "rating": 4.5}', now() - interval '2 days'),
  ((select id from public.users where email = 'ceo@oklut.com'), 'Technical Round Failed', 'candidate', 'CAND-0012', '{"stage": "Technical Round", "status": "failed", "rating": 2.0}', now() - interval '1 day'),
  ((select id from public.users where email = 'ceo@oklut.com'), 'Technical Round Passed', 'candidate', 'CAND-0013', '{"stage": "Technical Round", "status": "passed", "rating": 4.8}', now() - interval '3 days'),
  ((select id from public.users where email = 'ceo@oklut.com'), 'HR Slot Booked', 'candidate', 'CAND-0013', '{"stage": "HR Round", "status": "booked"}', now() - interval '1 day'),
  ((select id from public.users where email = 'ceo@oklut.com'), 'Technical Round Passed', 'candidate', 'CAND-0014', '{"stage": "Technical Round", "status": "passed", "rating": 4.3}', now() - interval '5 days'),
  ((select id from public.users where email = 'ceo@oklut.com'), 'HR Round Passed', 'candidate', 'CAND-0014', '{"stage": "HR Round", "status": "passed", "rating": 4.6}', now() - interval '2 days'),
  ((select id from public.users where email = 'ceo@oklut.com'), 'Offer Drafted', 'candidate', 'CAND-0014', '{"stage": "Offer", "status": "draft"}', now() - interval '1 day'),
  ((select id from public.users where email = 'ceo@oklut.com'), 'Exam Passed', 'candidate', 'CAND-0015', '{"stage": "Online Exam", "status": "passed", "score": 25, "out_of": 30}', now() - interval '12 days'),
  ((select id from public.users where email = 'ceo@oklut.com'), 'Technical Round Passed', 'candidate', 'CAND-0015', '{"stage": "Technical Round", "status": "passed", "rating": 4.2}', now() - interval '9 days'),
  ((select id from public.users where email = 'ceo@oklut.com'), 'HR Round Passed', 'candidate', 'CAND-0015', '{"stage": "HR Round", "status": "passed", "rating": 4.4}', now() - interval '6 days'),
  ((select id from public.users where email = 'ceo@oklut.com'), 'Offer Letter Issued', 'candidate', 'CAND-0015', '{"stage": "Offer", "status": "sent"}', now() - interval '2 days'),
  ((select id from public.users where email = 'ceo@oklut.com'), 'Exam Passed', 'candidate', 'CAND-0016', '{"stage": "Online Exam", "status": "passed", "score": 28, "out_of": 30}', now() - interval '25 days'),
  ((select id from public.users where email = 'ceo@oklut.com'), 'Technical Round Passed', 'candidate', 'CAND-0016', '{"stage": "Technical Round", "status": "passed", "rating": 4.7}', now() - interval '20 days'),
  ((select id from public.users where email = 'ceo@oklut.com'), 'HR Round Passed', 'candidate', 'CAND-0016', '{"stage": "HR Round", "status": "passed", "rating": 4.5}', now() - interval '15 days'),
  ((select id from public.users where email = 'ceo@oklut.com'), 'Offer Accepted', 'candidate', 'CAND-0016', '{"stage": "Offer", "status": "accepted"}', now() - interval '12 days'),
  ((select id from public.users where email = 'ceo@oklut.com'), 'Internship Onboarded', 'candidate', 'CAND-0016', '{"stage": "Internship", "status": "hired"}', now() - interval '10 days'),
  ((select id from public.users where email = 'ceo@oklut.com'), 'Technical Round Passed', 'candidate', 'CAND-0017', '{"stage": "Technical Round", "status": "passed", "rating": 4.9}', now() - interval '18 days'),
  ((select id from public.users where email = 'ceo@oklut.com'), 'HR Round Passed', 'candidate', 'CAND-0017', '{"stage": "HR Round", "status": "passed", "rating": 4.8}', now() - interval '12 days'),
  ((select id from public.users where email = 'ceo@oklut.com'), 'Offer Accepted', 'candidate', 'CAND-0017', '{"stage": "Offer", "status": "accepted"}', now() - interval '8 days'),
  ((select id from public.users where email = 'ceo@oklut.com'), 'Application Submitted', 'candidate', 'CAND-0018', '{"stage": "Applied"}', now() - interval '2 days');

-- ---------------------------------------------------------------------------
-- Done. Verify with:
--   select c.candidate_id, c.name, c.status, c.category,
--          c.exam_score, c.technical_interview_status, c.hr_interview_status
--   from public.candidates c order by c.candidate_id;
-- ============================================================================
