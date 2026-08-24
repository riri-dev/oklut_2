// ============================================================================
// Candidate Portal — Supabase-backed API layer bound strictly to the LIVE
// public schema (candidates / job_openings / interviews / offers /
// notifications). Every field the portal renders is either a real column or
// DERIVED client-side from real columns:
//   • Exam lifecycle      → the interviews row with round = 'Online Exam'
//   • Exam window         → [exam row scheduled_at, + job.exam_duration_mins]
//   • Round state         → interviews rows filtered by round
//   • Slot pool           → interviews rows status='proposed' (unclaimed,
//                           candidate_id IS NULL, not flagged for reschedule)
//   • Offer response      → encoded inside offers.status
// ============================================================================

import { supabase } from '@/lib/supabase'
import { submitExamAttempt } from '@/lib/api/examService'
import type { Candidate, Interview, JobOpening, Offer } from '@/lib/database.types'

// ---------------------------------------------------------------------------
// Portal types — component prop shapes (unchanged page contract).
// ---------------------------------------------------------------------------

export interface PortalInterviewer {
  first_name: string
  last_name: string
}

export interface PortalInterview {
  id: string
  candidate_id: string
  job_opening_id: string | null
  interviewer: PortalInterviewer | null
  round: 'Technical' | 'HR'
  scheduled_at: string | null
  mode: string
  meeting_link: string | null
  status: string | null
  candidate_confirmed: boolean
  attended_at: string | null
  created_at: string
  updated_at: string
  reschedule_requested: boolean | null
  reschedule_status: 'pending' | 'accepted' | 'rejected' | null
  reschedule_reason: string | null
  reschedule_preferred_time: string | null
  reschedule_admin_note: string | null
  feedback: string | null
  rating: number | null
  metrics: Record<string, number> | null
  slot_key: string | null
}

export interface PortalCandidate {
  id: string
  candidate_id: string | null
  user_id: string | null
  name: string
  email: string
  category: string
  status: string
  applied_at: string
  created_at: string
  exam_score: number | null
  exam_completed_at: string | null
  exam_started_at: string | null
  exam_feedback: string | null
  technical_interview_status: string | null
  technical_interview_feedback: string | null
  technical_interview_time: string | null
  technical_interview_date: string | null
  technical_interview_rescheduled: boolean | null
  hr_interview_status: string | null
  hr_interview_feedback: string | null
  hr_interview_time: string | null
  hr_interview_date: string | null
  hr_interview_rescheduled: boolean | null
  malpractice_flag: boolean
  cheating_detected: boolean
  disqualified_at: string | null
  disqualified_reason: string | null
}

export interface PortalExamDetails {
  duration_mins: number | null
  total_questions: number | null
  total_marks: number | null
  pass_percentage: number | null
  window_start: string | null
  window_end: string | null
  guidelines: string[]
}

export interface PortalJobOpening {
  id: string
  title: string
  exam_start_date: string | null
  exam_end_date: string | null
  exam_start_time: string | null
  exam_end_time: string | null
  exam_window_start: string | null
  exam_window_end: string | null
  total_questions: number | null
  total_marks: number | null
  pass_percentage: number | null
  exam_duration_mins: number | null
  exam_link: string | null
  exam_details: PortalExamDetails
}

export interface PortalSalaryBreakdown {
  base_salary: number
  variable: number
  allowances: number
  gross_total: number
}

export interface PortalOffer {
  id: string
  candidate_id: string
  job_opening_id: string | null
  pdf_url: string | null
  document_title: string
  terms_content_html: string | null
  terms_checkbox_labels: Array<string | null> | null
  salary_offered: number | null
  joining_date: string | null
  service_bond_years: number | null
  relocation_required: boolean
  relocation_location: string | null
  salary_breakdown: PortalSalaryBreakdown | null
  status: string
  candidate_response: 'accept' | 'discuss' | 'reject' | null
  created_at: string
}

export interface PortalInterviewSlot {
  id: string
  job_opening_id: string | null
  round: 'technical' | 'hr'
  scheduled_at: string
  status: 'open' | 'closed'
  max_candidates: number
  booked: number
  meeting_link: string | null
}

export interface PortalData {
  candidate: PortalCandidate
  job: PortalJobOpening | null
  interviews: PortalInterview[]
  slots: PortalInterviewSlot[]
  offer: PortalOffer | null
}

// ---------------------------------------------------------------------------
// Static presentation copy (authored content, NOT queried from the DB).
// ---------------------------------------------------------------------------

export const PORTAL_EXAM_GUIDELINES = [
  'Ensure a stable internet connection with a minimum speed of 2 Mbps.',
  'Supported Browsers: Latest versions of Google Chrome or Mozilla Firefox.',
  'Proctoring Notice: Web camera and microphone access are required. Navigating away from the exam tab or opening multiple tabs will trigger malpractice warnings.',
  'Submission Policy: The assessment will automatically submit when the timer expires.',
  'Calculator / Note-taking: Scratchpad and built-in calculator will be provided inside the exam interface.',
]

const PORTAL_OFFER_DOCUMENT_TITLE = 'Offer of Employment'

// ---------------------------------------------------------------------------
// Row → portal mappers (pure derivations over live columns)
// ---------------------------------------------------------------------------

const norm = (s?: string | null) => (s ?? '').trim().toLowerCase()

const EXAM_ROUND = 'online exam'
const EXAM_STARTED_STATUSES = ['ongoing', 'submitted', 'passed', 'failed']
const EXAM_DONE_STATUSES = ['submitted', 'passed', 'failed']

const latestRow = (rows: Interview[]): Interview | null => {
  if (rows.length === 0) return null
  return [...rows].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))[0]
}

type InterviewWithJoin = Interview & {
  interviewer: { first_name: string | null; last_name: string | null } | null
}

const toPortalInterview = (row: InterviewWithJoin): PortalInterview => ({
  id: row.id,
  candidate_id: row.candidate_id,
  job_opening_id: row.job_opening_id ?? null,
  interviewer: row.interviewer
    ? { first_name: row.interviewer.first_name ?? '', last_name: row.interviewer.last_name ?? '' }
    : null,
  round: row.round === 'HR' ? 'HR' : 'Technical',
  scheduled_at: row.scheduled_at ?? null,
  mode: row.mode ?? 'online',
  meeting_link: row.meeting_link ?? null,
  status: row.status ?? null,
  candidate_confirmed: row.status === 'scheduled',
  attended_at: null,
  created_at: row.created_at,
  updated_at: row.created_at,
  reschedule_requested: row.reschedule_requested ?? false,
  reschedule_status: (row.reschedule_status as 'pending' | 'accepted' | 'rejected') ?? null,
  // No dedicated columns in the live schema — the portal surfaces request
  // intent purely through the reschedule_requested / reschedule_status flags.
  reschedule_reason: null,
  reschedule_preferred_time: null,
  reschedule_admin_note: null,
  feedback: row.feedback ?? null,
  rating: row.rating ?? null,
  metrics: null,
  slot_key: null,
})

/** Derive the candidate's exam + round state from their interview rows. */
const deriveCandidateState = (
  candidate: Candidate,
  interviewRows: Interview[],
): PortalCandidate => {
  const examRow = latestRow(interviewRows.filter((i) => norm(i.round) === EXAM_ROUND))
  const techRows = interviewRows.filter((i) => i.round === 'Technical')
  const hrRows = interviewRows.filter((i) => i.round === 'HR')

  const techLatest = latestRow(techRows)
  const hrLatest = latestRow(hrRows)

  const examStartedAt =
    examRow && EXAM_STARTED_STATUSES.includes(norm(examRow.status))
      ? examRow.scheduled_at ?? examRow.created_at
      : null
  const examCompletedAt =
    examRow && EXAM_DONE_STATUSES.includes(norm(examRow.status)) ? examRow.created_at : null

  const disqualified = candidate.stage === 'Disqualified' && candidate.status === 'rejected'

  const roundState = (latest: Interview | null, rows: Interview[]) => ({
    status: latest?.status ?? null,
    feedback: latest?.feedback ?? null,
    date: latest?.scheduled_at ?? null,
    rescheduled: rows.some((r) => r.reschedule_status === 'accepted') || null,
  })

  const tech = roundState(techLatest, techRows)
  const hr = roundState(hrLatest, hrRows)

  return {
    id: candidate.id,
    candidate_id: candidate.temp_id ?? null,
    user_id: candidate.user_id ?? null,
    name: candidate.name,
    email: candidate.email,
    category: candidate.category ?? 'Fresher',
    status: candidate.status ?? 'applied',
    applied_at: candidate.applied_at,
    created_at: candidate.applied_at,
    exam_score: examRow?.rating ?? null,
    exam_completed_at: examCompletedAt,
    exam_started_at: examStartedAt,
    exam_feedback: examRow?.feedback ?? null,
    technical_interview_status: tech.status,
    technical_interview_feedback: tech.feedback,
    technical_interview_time: tech.date,
    technical_interview_date: tech.date,
    technical_interview_rescheduled: tech.rescheduled,
    hr_interview_status: hr.status,
    hr_interview_feedback: hr.feedback,
    hr_interview_time: hr.date,
    hr_interview_date: hr.date,
    hr_interview_rescheduled: hr.rescheduled,
    malpractice_flag: false,
    cheating_detected: false,
    disqualified_at: disqualified ? candidate.updated_at : null,
    disqualified_reason: disqualified ? candidate.notes ?? null : null,
  }
}

/** Exam window derives from the exam interview row + the opening duration. */
const deriveExamWindow = (
  jobRow: JobOpening,
  interviewRows: Interview[],
): { start: string | null; end: string | null; examLink: string | null } => {
  const examRow = latestRow(interviewRows.filter((i) => norm(i.round) === EXAM_ROUND))
  const start = examRow?.scheduled_at ?? null
  let end: string | null = null
  if (start && jobRow.exam_duration_mins != null) {
    end = new Date(new Date(start).getTime() + jobRow.exam_duration_mins * 60_000).toISOString()
  }
  return { start, end, examLink: examRow?.exam_link ?? null }
}

const toPortalJob = (row: JobOpening, interviewRows: Interview[]): PortalJobOpening => {
  const { start, end, examLink } = deriveExamWindow(row, interviewRows)
  return {
    id: row.id,
    title: row.title,
    exam_start_date: start,
    exam_end_date: end,
    exam_start_time: null,
    exam_end_time: null,
    exam_window_start: start,
    exam_window_end: end,
    total_questions: row.total_questions ?? null,
    total_marks: null,
    pass_percentage: row.exam_passing_score ?? null,
    exam_duration_mins: row.exam_duration_mins ?? null,
    exam_link: examLink,
    exam_details: {
      duration_mins: row.exam_duration_mins ?? null,
      total_questions: row.total_questions ?? null,
      total_marks: null,
      pass_percentage: row.exam_passing_score ?? null,
      window_start: start,
      window_end: end,
      guidelines: PORTAL_EXAM_GUIDELINES,
    },
  }
}

/**
 * Slot pool — unclaimed interview stubs (candidate_id IS NULL, status
 * 'proposed', not flagged for reschedule). One portal slot per stub.
 */
const deriveSlots = (interviewRows: Interview[], jobId: string | null): PortalInterviewSlot[] =>
  interviewRows
    .filter(
      (r) =>
        r.candidate_id == null &&
        norm(r.status) === 'proposed' &&
        !r.reschedule_requested &&
        r.scheduled_at != null &&
        (r.round === 'Technical' || r.round === 'HR'),
    )
    .map((r) => ({
      id: r.id,
      job_opening_id: r.job_opening_id ?? jobId,
      round: r.round === 'HR' ? ('hr' as const) : ('technical' as const),
      scheduled_at: r.scheduled_at!,
      status: 'open' as const,
      max_candidates: 1,
      booked: 0,
      meeting_link: r.meeting_link ?? null,
    }))

/** Offer response is encoded in the live offers.status column. */
const decodeOfferResponse = (status?: string | null): PortalOffer['candidate_response'] => {
  switch (norm(status)) {
    case 'accepted':
    case 'terms_accepted':
      return 'accept'
    case 'rejected':
      return 'reject'
    case 'discuss_requested':
      return 'discuss'
    default:
      return null
  }
}

const toPortalOffer = (row: Offer): PortalOffer => ({
  id: row.id,
  candidate_id: row.candidate_id,
  job_opening_id: row.job_opening_id ?? null,
  pdf_url: row.offer_letter_url ?? null,
  document_title: PORTAL_OFFER_DOCUMENT_TITLE,
  terms_content_html: null,
  terms_checkbox_labels: null,
  salary_offered: row.salary_offered ?? null,
  joining_date: row.joining_date ?? null,
  service_bond_years: null,
  relocation_required: false,
  relocation_location: null,
  salary_breakdown: null,
  status: row.status ?? 'sent',
  candidate_response: decodeOfferResponse(row.status),
  created_at: row.created_at,
})

// ---------------------------------------------------------------------------
// Login — single-input Candidate ID (temp_id) lookup, no password.
// ---------------------------------------------------------------------------

export async function candidateLogin(tempId: string): Promise<{ candidateId: string; name: string }> {
  const trimmed = tempId.trim()
  if (!trimmed) throw new Error('Please enter your Candidate ID.')
  const { data, error } = await supabase
    .from('candidates')
    .select('id, name')
    .eq('temp_id', trimmed)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Invalid Candidate ID. Please check and try again.')
  return { candidateId: data.id, name: data.name }
}

// ---------------------------------------------------------------------------
// Portal snapshot — parallel fetch + derivation of every entity rendered.
// ---------------------------------------------------------------------------

export async function fetchCandidatePortal(candidateId: string): Promise<PortalData> {
  const { data: candidate, error: candErr } = await supabase
    .from('candidates')
    .select('*')
    .eq('id', candidateId)
    .single()
  if (candErr) throw candErr
  if (!candidate) throw new Error('Candidate record not found.')

  const jobId: string | null = candidate.job_opening_id ?? null

  const [jobRes, interviewsRes, offersRes] = await Promise.all([
    jobId
      ? supabase.from('job_openings').select('*').eq('id', jobId).single()
      : Promise.resolve({ data: null as JobOpening | null, error: null }),
    supabase
      .from('interviews')
      .select('*, interviewer:employees(first_name, last_name)')
      .or(`candidate_id.eq.${candidateId},candidate_id.is.null`)
      .order('scheduled_at'),
    supabase.from('offers').select('*').eq('candidate_id', candidateId).order('created_at', { ascending: false }),
  ])

  const jobRow = jobRes.data
  if (jobRes.error) throw jobRes.error
  const interviewsRaw = (interviewsRes.data ?? []) as unknown as InterviewWithJoin[]
  if (interviewsRes.error) throw interviewsRes.error
  const offersRaw = offersRes.data ?? []
  if (offersRes.error) throw offersRes.error

  // Only Technical / HR rounds render as interview cards — the Online Exam
  // row drives exam state instead.
  const interviews = interviewsRaw
    .filter((i) => i.round === 'Technical' || i.round === 'HR')
    .map(toPortalInterview)

  return {
    candidate: deriveCandidateState(candidate, interviewsRaw),
    job: jobRow ? toPortalJob(jobRow, interviewsRaw) : null,
    interviews,
    slots: deriveSlots(interviewsRaw, jobId),
    offer: offersRaw[0] ? toPortalOffer(offersRaw[0]) : null,
  }
}

// ---------------------------------------------------------------------------
// Mutations — every action the portal exposes, persisted to Supabase.
// ---------------------------------------------------------------------------

export type PortalRound = 'technical' | 'hr'

const roundLabel = (round: PortalRound): 'Technical' | 'HR' => (round === 'hr' ? 'HR' : 'Technical')

export async function bookInterviewSlot(input: {
  candidateId: string
  jobOpeningId: string | null
  round: PortalRound
  slotKey?: string | null
  scheduledAt: string
  meetingLink: string | null
  existingInterviewId?: string | null
}) {
  const patch = {
    scheduled_at: input.scheduledAt,
    mode: 'online',
    meeting_link: input.meetingLink,
    status: 'scheduled',
    reschedule_requested: false,
    reschedule_status: null,
  }

  if (input.existingInterviewId) {
    const { error } = await supabase.from('interviews').update(patch).eq('id', input.existingInterviewId)
    if (error) throw error
  } else {
    const { error } = await supabase.from('interviews').insert({
      ...patch,
      candidate_id: input.candidateId,
      job_opening_id: input.jobOpeningId,
      round: roundLabel(input.round),
      feedback: null,
      rating: null,
    })
    if (error) throw error
  }
}

export async function cancelInterviewSlot(input: { interviewId: string }) {
  const { error } = await supabase
    .from('interviews')
    .update({
      status: 'cancelled',
      reschedule_requested: false,
      reschedule_status: null,
    })
    .eq('id', input.interviewId)
  if (error) throw error
}

export async function submitRescheduleRequest(input: {
  candidateId: string
  jobOpeningId: string | null
  round: PortalRound
  reason: string
  preferredTime: string
  existingInterviewId?: string | null
}) {
  const reschedulePatch = {
    reschedule_requested: true,
    reschedule_status: 'pending',
  }

  if (input.existingInterviewId) {
    const { error } = await supabase
      .from('interviews')
      .update(reschedulePatch)
      .eq('id', input.existingInterviewId)
    if (error) throw error
  } else {
    // No booking yet — raise a proposed stub so admins see the request.
    const { error } = await supabase.from('interviews').insert({
      ...reschedulePatch,
      candidate_id: input.candidateId,
      job_opening_id: input.jobOpeningId,
      round: roundLabel(input.round),
      scheduled_at: input.preferredTime,
      mode: 'online',
      meeting_link: null,
      status: 'proposed',
      feedback: null,
      rating: null,
    })
    if (error) throw error
  }
}

export async function revertRescheduleRequest(input: { interviewId: string }) {
  const { error } = await supabase
    .from('interviews')
    .update({
      reschedule_requested: false,
      reschedule_status: null,
    })
    .eq('id', input.interviewId)
  if (error) throw error
}

export async function attendInterview(input: { interviewId: string }) {
  const { error } = await supabase
    .from('interviews')
    .update({ status: 'ongoing' })
    .eq('id', input.interviewId)
  if (error) throw error
}

/** Mark the exam as started — upserts the candidate's Online Exam row. */
export async function startExam(input: { candidateId: string; jobOpeningId?: string | null }) {
  const nowIso = new Date().toISOString()
  const { data: existing } = await supabase
    .from('interviews')
    .select('id')
    .eq('candidate_id', input.candidateId)
    .ilike('round', EXAM_ROUND)
    .maybeSingle()

  if (existing?.id) {
    const { error } = await supabase.from('interviews').update({ status: 'ongoing' }).eq('id', existing.id)
    if (error) throw error
    return
  }

  const { error } = await supabase.from('interviews').insert({
    candidate_id: input.candidateId,
    job_opening_id: input.jobOpeningId ?? null,
    round: 'Online Exam',
    scheduled_at: nowIso,
    mode: 'online',
    status: 'ongoing',
    feedback: null,
    rating: null,
  })
  if (error) throw error
}

export async function submitExam(input: { candidateId: string; jobOpeningId: string | null }) {
  return submitExamAttempt(input.candidateId, input.jobOpeningId)
}

/** Terms acceptance — persisted via the offers.status encoding. */
export async function acceptOfferTerms(input: { offerId: string; relocationRequired?: boolean }) {
  const { error } = await supabase.from('offers').update({ status: 'terms_accepted' }).eq('id', input.offerId)
  if (error) throw error
}

export async function respondToOffer(input: {
  offerId: string
  response: 'accept' | 'discuss' | 'reject'
  candidateId: string
  userId: string | null
  message?: string
}) {
  const now = new Date().toISOString()
  const statusByResponse =
    input.response === 'accept' ? 'accepted' : input.response === 'reject' ? 'rejected' : 'discuss_requested'
  const { error: offerErr } = await supabase
    .from('offers')
    .update({ status: statusByResponse })
    .eq('id', input.offerId)
  if (offerErr) throw offerErr

  if (input.response === 'accept') {
    const { error: candErr } = await supabase
      .from('candidates')
      .update({ status: 'hired', updated_at: now })
      .eq('id', input.candidateId)
    if (candErr) throw candErr
  }

  if (input.response === 'discuss') {
    const { error: notifErr } = await supabase.from('notifications').insert({
      user_id: input.userId ?? null,
      type: 'info',
      title: 'Offer Discussion Requested',
      message: input.message?.trim() || 'You requested to discuss the offer terms with our team.',
      is_read: false,
      created_at: now,
    })
    if (notifErr) throw notifErr
  }
}

/** Disqualification — stage + status carry it; notes keeps the reason. */
export async function disqualifyCandidate(input: { candidateId: string; reason: string }) {
  const { error } = await supabase
    .from('candidates')
    .update({
      status: 'rejected',
      stage: 'Disqualified',
      notes: input.reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.candidateId)
  if (error) throw error
}
