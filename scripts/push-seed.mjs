// ============================================================================
// Bulk seed push — pushes supabase/seed-data.json into the remote database
// using the SUPABASE_SERVICE_ROLE_KEY (bypasses RLS, so this is admin tooling).
//
//   npm run push:seed            # apply seed-data.json
//   npm run push:seed -- --dry   # validate config without touching the DB
//
// Required env (put in .env.local — it is gitignored):
//   VITE_SUPABASE_URL=https://<ref>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY=<service_role key from Dashboard -> Settings -> API>
//
// What it does, per job in the config:
//   - upserts the job opening (id derived from its `key`, e.g. "b3") incl.
//     exam window/link/pass% and slot capacities
// What it does, per candidate in the config:
//   - resolves or creates the linked auth account (email + password "1234")
//     via the GoTrue Admin API (fills GoTrue's non-null columns correctly —
//     avoids the NULL-token bug that broke logins with raw SQL inserts)
//   - upserts the candidate row bound to that auth user
//   - creates interview/offer rows for the requested scenario
// All interview/offer ids are deterministic (uuid v5 from candidate key), so
// re-running is idempotent and a changed scenario cleans up its stale rows.
// ============================================================================

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dryRun = process.argv.includes('--dry')

// ---------------------------------------------------------------------------
// Env loading (same pattern as scripts/verify-supabase.mjs)
// ---------------------------------------------------------------------------
function loadEnv(path) {
  const env = {}
  if (!existsSync(path)) return env
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}

const env = { ...loadEnv(resolve(root, '.env.local')), ...loadEnv(resolve(root, '.env')), ...process.env }
const url = env.VITE_SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!dryRun) {
  if (!url || url.includes('placeholder')) {
    console.error('✗ VITE_SUPABASE_URL missing/placeholder in .env.local')
    process.exit(1)
  }
  if (!serviceKey || serviceKey.includes('your-service-role-key')) {
    console.error('✗ SUPABASE_SERVICE_ROLE_KEY missing in .env.local — copy it from')
    console.error('  Supabase Dashboard → Project Settings → API → service_role')
    process.exit(1)
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const DEMO_PASSWORD = '1234'
const INTERVIEWER_TECH = '00000000-0000-0000-0000-000000000020' // EMP-0002 (Engineering)
const INTERVIEWER_HR = '00000000-0000-0000-0000-000000000010'   // EMP-0001 (HR)
const UUID6 = '00000000-0000-4000-8000-0000000000'

const slotMax = { technical_slot_1_max_count: 3, technical_slot_2_max_count: 3, technical_slot_3_max_count: 3, hr_slot_1_max_count: 2, hr_slot_2_max_count: 2, hr_slot_3_max_count: 2 }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function jobId(key) {
  if (!/^[0-9a-f]{2}$/.test(key)) throw new Error(`job key "${key}" must be 2 hex chars`)
  return UUID6 + key
}
function candId(key) {
  if (!/^[0-9a-f]{2}$/.test(key)) throw new Error(`candidate key "${key}" must be 2 hex chars`)
  return UUID6 + key
}
function uuidv5(name) {
  const h = createHash('md5').update('oklut-hrms:' + name).digest()
  h[6] = (h[6] & 0x0f) | 0x50
  h[8] = (h[8] & 0x3f) | 0x80
  return [h.subarray(0, 4), h.subarray(4, 6), h.subarray(6, 8), h.subarray(8, 10), h.subarray(10, 16)]
    .map((s) => Buffer.from(s).toString('hex')).join('-')
}
const interviewIds = (key) => {
  const ids = []
  for (const role of ['Technical', 'HR']) for (let i = 0; i < 6; i++) ids.push(uuidv5(`interview:${key}:${role}:${i}`))
  return ids
}
const offerId = (key) => uuidv5(`offer:${key}`)

// Offset strings like "-5d", "+113s", "+45m", "-5h" -> ISO timestamp
function offsetToIso(offset, base = new Date()) {
  if (offset == null || offset === '') return null
  const m = /^([+-])(\d+)([smhd])$/.exec(String(offset).trim())
  if (!m) throw new Error(`bad offset "${offset}" (use e.g. -5d, +45m, +113s, -5h)`)
  const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000 }
  const ms = parseInt(m[2], 10) * mult[m[3]]
  return new Date(base.getTime() + (m[1] === '+' ? ms : -ms)).toISOString()
}
const isoDaysAgo = (offset) => offsetToIso(offset).slice(0, 10) // date-only for offers

const check = (label, r) => {
  if (r.error) throw new Error(`${label}: ${r.error.message} ${r.error.details ?? ''}`)
  return r.data
}

// ---------------------------------------------------------------------------
// Connect
// ---------------------------------------------------------------------------
const supabase = dryRun ? null : createClient(url, serviceKey, { auth: { persistSession: false } })

const config = JSON.parse(readFileSync(resolve(root, 'supabase', 'seed-data.json'), 'utf8'))
const candidatesByKey = new Map()
for (const c of config.candidates) {
  if (candidatesByKey.has(c.key)) throw new Error(`duplicate candidate key "${c.key}"`)
  candidatesByKey.set(c.key, c)
}

console.log(`${dryRun ? 'DRY RUN — ' : ''}pushing ${config.jobs.length} jobs + ${config.candidates.length} candidates to ${url}`)
console.log('')

// ---------------------------------------------------------------------------
// 1. Jobs
// ---------------------------------------------------------------------------
const deptIds = {}
for (const j of config.jobs) {
  jobId(j.key) // validate key format
  if (dryRun) { console.log(`  ~ job ${j.key} ${j.title}  (validated)`); continue }
  if (!deptIds[j.department]) {
    const rows = check(`dept ${j.department}`, await supabase.from('departments').select('id').eq('name', j.department).maybeSingle())
    if (!rows) throw new Error(`department "${j.department}" not found (departments: IT, HR, Design, Finance, Marketing)`)
    deptIds[j.department] = rows.id
  }
  const row = {
    id: jobId(j.key),
    title: j.title,
    department_id: deptIds[j.department],
    location: j.location,
    openings_count: j.openings_count,
    employment_type: j.employment_type,
    description: j.description,
    requirements: j.requirements,
    status: 'Open',
    published: true,
    total_questions: j.exam.total_questions,
    exam_duration_mins: j.exam.duration_mins,
    pass_percentage: j.exam.pass_percentage,
    exam_passing_score: j.exam.pass_percentage,
    exam_start_date: offsetToIso(j.exam.start_in),
    exam_end_date: offsetToIso(j.exam.end_in),
    exam_window_start: offsetToIso(j.exam.start_in),
    exam_window_end: offsetToIso(j.exam.end_in),
    exam_link: j.exam.link,
    ...slotMax,
  }
  check(`job ${j.key}`, await supabase.from('job_openings').upsert(row, { onConflict: 'id' }))
  console.log(`  ✔ job ${j.key} ${j.title}  (exam ${row.exam_start_date.slice(0, 16)} → ${row.exam_end_date.slice(0, 16)})`)
}
console.log('')

// ---------------------------------------------------------------------------
// 2. Auth users — one per unique email (existing rows/users are reused)
// ---------------------------------------------------------------------------
const userCache = new Map() // email -> user_id
async function resolveUserId(c) {
  const email = c.email.toLowerCase()
  if (userCache.has(email)) return userCache.get(email)

  const existing = await supabase.from('candidates').select('user_id').eq('email', email).not('user_id', 'is', null).limit(1).maybeSingle()
  if (existing?.data?.user_id) { userCache.set(email, existing.data.user_id); return existing.data.user_id }
  if (existing?.error) throw new Error(`lookup ${email}: ${existing.error.message}`)

  const { data: users } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const found = (users?.users ?? []).find((u) => u.email?.toLowerCase() === email)
  if (found) { userCache.set(email, found.id); return found.id }

  const { data, error } = await supabase.auth.admin.createUser({
    id: uuidv5('auth:' + email),
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { name: c.name, role: 'Candidate' },
  })
  if (error) throw new Error(`createUser ${email}: ${error.message}`)
  userCache.set(email, data.user.id)
  return data.user.id
}

// ---------------------------------------------------------------------------
// 3. Scenario interpreter
// ---------------------------------------------------------------------------
function applyScenario(c, cand, job) {
  const out = { interviews: [], offer: null, columns: {} }
  const base = new Date()
  const t = (off) => offsetToIso(off, base)
  const techProposed = (n) => ({
    id: uuidv5(`interview:${c.key}:Technical:${n}`),
    round: 'Technical', status: 'proposed', slot_key: `technical_slot_${n + 1}`,
    scheduled_at: t(job.tech_slots[n]),
  })
  const hrProposed = (n) => ({
    id: uuidv5(`interview:${c.key}:HR:${n}`),
    round: 'HR', status: 'proposed', slot_key: `hr_slot_${n + 1}`,
    scheduled_at: t(job.hr_slots[n]),
  })
  const techCompleted = () => ({
    id: uuidv5(`interview:${c.key}:Technical:0`),
    round: 'Technical', status: 'completed', slot_key: 'technical_slot_1',
    scheduled_at: t(c.tech_passed_in ?? '-4d'),
    interviewer_id: INTERVIEWER_TECH,
    feedback: c.tech_feedback ?? null, rating: c.tech_rating ?? null, metrics: c.tech_metrics ?? null,
    candidate_confirmed: true,
  })
  const hrCompleted = ({ failed = false } = {}) => ({
    id: uuidv5(`interview:${c.key}:HR:0`),
    round: 'HR', status: failed ? 'failed' : 'completed', slot_key: 'hr_slot_1',
    scheduled_at: t(failed ? c.hr_failed_in : c.hr_passed_in),
    interviewer_id: INTERVIEWER_HR,
    feedback: failed ? c.hr_feedback : (c.hr_feedback ?? null),
    rating: c.hr_rating ?? null, metrics: c.hr_metrics ?? null,
    candidate_confirmed: true,
  })
  const hrBooked = () => ({
    id: uuidv5(`interview:${c.key}:HR:0`),
    round: 'HR', status: 'scheduled', slot_key: 'hr_slot_1',
    scheduled_at: t(c.hr_booked_in),
    interviewer_id: INTERVIEWER_HR,
    meeting_link: c.meeting_link ?? null,
    candidate_confirmed: true,
    reschedule_requested: true,
    reschedule_status: c.reschedule,
  })
  const techBooked = () => ({
    id: uuidv5(`interview:${c.key}:Technical:0`),
    round: 'Technical', status: 'scheduled', slot_key: 'technical_slot_1',
    scheduled_at: t(c.join_in ?? '+113s'),
    interviewer_id: INTERVIEWER_TECH,
    meeting_link: c.meeting_link ?? null,
    candidate_confirmed: true,
  })
  const completed = (r) => ({ id: r.id, candidate_id: cand.id, job_opening_id: job.id, interviewer_id: r.interviewer_id ?? null, round: r.round, scheduled_at: r.scheduled_at, mode: 'online', meeting_link: r.meeting_link ?? null, status: r.status, feedback: r.feedback, rating: r.rating, metrics: r.metrics ?? null, candidate_confirmed: r.candidate_confirmed ?? false, reschedule_requested: r.reschedule_requested ?? false, reschedule_status: r.reschedule_status ?? null, slot_key: r.slot_key ?? null })

  const addInterview = (r) => out.interviews.push(completed(r))

  switch (c.scenario) {
    case 'exam_scheduled':         // round 1 upcoming, no attempt yet
    case 'exam_live':              // exam window open, Take Exam enabled
    case 'exam_expired_unattempted':
      break
    case 'exam_awaiting':          // submitted, awaiting evaluation
      out.columns.exam_completed_at = t(c.exam_completed_in)
      out.columns.exam_started_at = t(c.exam_started_in)
      break
    case 'exam_fail':              // scored below pass percentage
      out.columns.exam_score = c.exam_score
      out.columns.exam_completed_at = t(c.exam_completed_in)
      out.columns.exam_feedback = c.exam_feedback ?? null
      break
    case 'exam_pass_tech_slots':   // passed exam, picking a technical slot
      out.columns.exam_score = c.exam_score
      out.columns.exam_completed_at = t(c.exam_completed_in)
      out.columns.exam_started_at = t(c.exam_started_in)
      out.columns.exam_feedback = c.exam_feedback ?? null
      for (let i = 0; i < job.tech_slots.length; i++) addInterview(techProposed(i))
      break
    case 'disqualified':           // malpractice / AI-cheating detection
      out.columns.malpractice_flag = true
      break
    case 'tech_slots':             // experienced — technical slots available
      for (let i = 0; i < job.tech_slots.length; i++) addInterview(techProposed(i))
      break
    case 'tech_booked': {          // technical confirmed — join window live
      const r = techBooked(); addInterview(r)
      out.columns.technical_interview_status = 'scheduled'
      out.columns.technical_interview_time = r.scheduled_at
      break }
    case 'tech_pass_hr_slots': {   // technical passed, picking an HR slot
      const r = techCompleted(); addInterview(r)
      out.columns.technical_interview_status = 'passed'
      out.columns.technical_interview_time = r.scheduled_at
      out.columns.technical_interview_feedback = c.tech_feedback ?? null
      for (let i = 0; i < job.hr_slots.length; i++) addInterview(hrProposed(i))
      break }
    case 'tech_pass_hr_booked_reschedule': { // HR confirmed + reschedule pending/accepted/rejected
      const t1 = techCompleted(); addInterview(t1)
      out.columns.technical_interview_status = 'passed'
      out.columns.technical_interview_time = t1.scheduled_at
      out.columns.technical_interview_feedback = c.tech_feedback ?? null
      const t2 = hrBooked(); addInterview(t2)
      out.columns.hr_interview_status = 'scheduled'
      out.columns.hr_interview_time = t2.scheduled_at
      break }
    case 'offer_sent': {           // all rounds cleared, offer awaiting response
      const t1 = techCompleted(); addInterview(t1)
      out.columns.technical_interview_status = 'passed'
      out.columns.technical_interview_time = t1.scheduled_at
      out.columns.technical_interview_feedback = c.tech_feedback ?? null
      const t2 = hrCompleted(); addInterview(t2)
      out.columns.hr_interview_status = 'passed'
      out.columns.hr_interview_time = t2.scheduled_at
      out.columns.hr_interview_feedback = c.hr_feedback ?? null
      out.offer = makeOffer(c, 'sent', null)
      break }
    case 'hr_fail': {              // technical passed, HR failed → rejected
      const t1 = techCompleted(); addInterview(t1)
      out.columns.technical_interview_status = 'passed'
      out.columns.technical_interview_time = t1.scheduled_at
      out.columns.technical_interview_feedback = c.tech_feedback ?? null
      const t2 = hrCompleted({ failed: true }); addInterview(t2)
      out.columns.hr_interview_status = 'failed'
      out.columns.hr_interview_time = t2.scheduled_at
      out.columns.hr_interview_feedback = c.hr_feedback ?? null
      break }
    case 'hired': {                // offer accepted
      const t1 = techCompleted(); addInterview(t1)
      out.columns.technical_interview_status = 'passed'
      out.columns.technical_interview_time = t1.scheduled_at
      out.columns.technical_interview_feedback = c.tech_feedback ?? null
      const t2 = hrCompleted(); addInterview(t2)
      out.columns.hr_interview_status = 'passed'
      out.columns.hr_interview_time = t2.scheduled_at
      out.columns.hr_interview_feedback = c.hr_feedback ?? null
      out.offer = makeOffer(c, 'accepted', 'accept')
      break }
    default:
      throw new Error(`unknown scenario "${c.scenario}" for ${c.key}`)
  }
  return out
}

function makeOffer(c, status, response) {
  const salary = c.offer.salary
  const base = Math.round(salary * 0.7), variable = Math.round(salary * 0.1), allowances = salary - base - variable
  return {
    id: offerId(c.key),
    salary_offered: salary,
    joining_date: offsetToIso(c.offer.joining_in).slice(0, 10),
    status,
    issued_by: INTERVIEWER_HR,
    service_bond_years: c.offer.bond_years ?? 0,
    relocation_required: c.offer.relocation != null,
    relocation_location: c.offer.relocation ?? null,
    salary_breakdown: { base_salary: base, variable, allowances, gross_total: salary },
    candidate_response: response,
  }
}

// ---------------------------------------------------------------------------
// 4. Push candidates
// ---------------------------------------------------------------------------
const summary = []
for (const c of config.candidates) {
  const job = config.jobs.find((j) => j.key === c.job)
  if (!job) throw new Error(`candidate ${c.key}: unknown job key "${c.job}"`)
  const jobRow = { id: jobId(job.key), tech_slots: job.tech_slots, hr_slots: job.hr_slots }

  if (dryRun) {
    summary.push({ key: c.key, name: c.name, email: c.email, temp_id: c.temp_id ?? '—', scenario: c.scenario })
    continue
  }

  const userId = await resolveUserId(c)
  const appliedAt = offsetToIso(c.applied_in)
  const s = applyScenario(c, { id: candId(c.key) }, jobRow)

  const candRow = {
    id: candId(c.key),
    temp_id: c.temp_id ?? null,
    user_id: userId,
    candidate_id: c.candidate_id,
    job_opening_id: jobRow.id,
    name: c.name,
    email: c.email,
    phone: c.phone ?? null,
    status: c.status,
    source: c.source ?? null,
    category: c.category ?? 'Fresher',
    applied_at: appliedAt,
    updated_at: appliedAt,
    ats_score: c.ats_score ?? null,
    exam_score: s.columns.exam_score ?? null,
    exam_completed_at: s.columns.exam_completed_at ?? null,
    exam_started_at: s.columns.exam_started_at ?? null,
    exam_feedback: s.columns.exam_feedback ?? null,
    malpractice_flag: s.columns.malpractice_flag ?? false,
    cheating_detected: false,
    technical_interview_status: s.columns.technical_interview_status ?? null,
    technical_interview_time: s.columns.technical_interview_time ?? null,
    technical_interview_feedback: s.columns.technical_interview_feedback ?? null,
    hr_interview_status: s.columns.hr_interview_status ?? null,
    hr_interview_time: s.columns.hr_interview_time ?? null,
    hr_interview_feedback: s.columns.hr_interview_feedback ?? null,
  }
  check(`candidate ${c.key}`, await supabase.from('candidates').upsert(candRow, { onConflict: 'id' }))

  const candUuid = candId(c.key)

  // Cleanup deterministic rows first so a changed scenario can't leave stale data
  check(`cleanup ${c.key} interviews`, await supabase.from('interviews').delete().eq('candidate_id', candUuid).in('id', interviewIds(c.key)))
  for (const iv of s.interviews) {
    check(`interview ${c.key}`, await supabase.from('interviews').upsert(iv, { onConflict: 'id' }))
  }

  check(`cleanup ${c.key} offer`, await supabase.from('offers').delete().eq('candidate_id', candUuid).eq('id', offerId(c.key)))
  if (s.offer) {
    check(`offer ${c.key}`, await supabase.from('offers').upsert({ ...s.offer, candidate_id: candUuid, job_opening_id: jobRow.id }, { onConflict: 'id' }))
  }

  summary.push({ key: c.key, name: c.name, email: c.email, temp_id: c.temp_id ?? '—', password: c.temp_id ? DEMO_PASSWORD : '(reuses existing account)', scenario: c.scenario })
}

console.log(dryRun ? '✔ config validated (dry run — nothing written)\n' : '✔ done\n')
console.table(summary)
if (!dryRun) {
  console.log('\nLogin: portal ID = temp_id, password = 1234')
  console.log('Kavya (multi-application switcher) logs in with her original ID 00000000-0000-4000-8000-0000000001c1')
}
