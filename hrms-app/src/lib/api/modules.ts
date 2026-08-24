import { supabase } from '@/lib/supabase'
import type { PerformanceGoal, PerformanceReview, JobOpening, Candidate, Interview, Offer, AuditLog } from '@/lib/database.types'

// Admin-side slot pool shape (interview_slots table is not part of the live
// public schema; kept local so recruiter tooling keeps compiling).
export interface InterviewSlot {
  id: string
  job_opening_id: string
  round: 'technical' | 'hr'
  scheduled_at: string
  meeting_link?: string | null
  max_candidates: number
  status?: string | null
  created_by?: string | null
  created_at: string
}

// ---------- Performance ----------
export async function fetchPerformanceGoals(employeeId?: string) {
  let query = supabase
    .from('performance_goals')
    .select('*, employee:employees(first_name, last_name, employee_code)')
    .order('created_at', { ascending: false })
  if (employeeId) query = query.eq('employee_id', employeeId)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as PerformanceGoal[]
}

export async function createGoal(input: {
  employee_id: string
  title: string
  description?: string
  target?: string
  due_date?: string
}) {
  const { data: session } = await supabase.auth.getSession()
  const { data, error } = await supabase
    .from('performance_goals')
    .insert({ ...input, reviewer_id: session.session?.user.id ?? null })
    .select()
    .single()
  if (error) throw error
  return data as PerformanceGoal
}

export async function updateGoalStatus(id: string, status: string) {
  const { data, error } = await supabase.from('performance_goals').update({ status }).eq('id', id).select().single()
  if (error) throw error
  return data as PerformanceGoal
}

export async function fetchPerformanceReviews(employeeId?: string) {
  let query = supabase
    .from('performance_reviews')
    .select('*, employee:employees(first_name, last_name, employee_code)')
    .order('created_at', { ascending: false })
  if (employeeId) query = query.eq('employee_id', employeeId)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as PerformanceReview[]
}

export async function createReview(input: {
  employee_id: string
  period: string
  goals?: string
  rating?: number
  comments?: string
}) {
  const { data: session } = await supabase.auth.getSession()
  const { data, error } = await supabase
    .from('performance_reviews')
    .insert({ ...input, reviewer_id: session.session?.user.id ?? null, status: 'submitted', review_date: new Date().toISOString().slice(0, 10) })
    .select()
    .single()
  if (error) throw error
  return data as PerformanceReview
}

// ---------- Recruitment ----------
export async function fetchJobOpenings(options?: { status?: string }) {
  let query = supabase
    .from('job_openings')
    .select('*, department:departments(name)')
    .order('created_at', { ascending: false })
  if (options?.status) query = query.eq('status', options.status)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as JobOpening[]
}

export async function createJobOpening(input: {
  title: string
  department_id?: string
  location?: string
  openings_count: number
  description?: string
  requirements?: string
  employment_type?: string
  status?: string
  published?: boolean
}) {
  const { data: session } = await supabase.auth.getSession()
  const { data, error } = await supabase
    .from('job_openings')
    .insert({ ...input, created_by: session.session?.user.id ?? null })
    .select()
    .single()
  if (error) throw error
  return data as JobOpening
}

export async function updateJobOpening(id: string, patch: Record<string, unknown>) {
  const { data, error } = await supabase.from('job_openings').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data as JobOpening
}

export async function deleteJobOpening(id: string) {
  const { error } = await supabase.from('job_openings').delete().eq('id', id)
  if (error) throw error
}

export async function fetchCandidates() {
  const { data, error } = await supabase
    .from('candidates')
    .select('*, job_opening:job_openings(title, department:departments(name)), converted_employee:employees(first_name, last_name, employee_code)')
    .order('applied_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Candidate[]
}

export async function createCandidate(input: {
  job_opening_id?: string
  name: string
  email: string
  phone?: string
  resume_url?: string
  cover_letter?: string
  source?: string
  ats_score?: number
  category?: string
  candidate_id?: string
}) {
  // create_candidate_with_auth (migration 0010) creates the candidates row AND
  // the linked auth.users account (password 1234) so the candidate can log into
  // the candidate portal with the returned temp_id.
  const { data, error } = await supabase.rpc('create_candidate_with_auth', {
    p_name: input.name,
    p_email: input.email,
    p_phone: input.phone ?? null,
    p_job_opening_id: input.job_opening_id ?? null,
    p_source: input.source ?? null,
    p_resume_url: input.resume_url ?? null,
    p_cover_letter: input.cover_letter ?? null,
    p_category: input.category ?? 'Fresher',
  })
  if (error) throw error
  return { id: '', name: input.name, email: input.email, temp_id: data as string } as unknown as Candidate
}

export async function updateCandidateStatus(id: string, status: string) {
  const { data, error } = await supabase
    .from('candidates')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Candidate
}

export async function updateCandidate(id: string, patch: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('candidates')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Candidate
}

export async function deleteCandidate(id: string) {
  const { error } = await supabase.from('candidates').delete().eq('id', id)
  if (error) throw error
}

export async function fetchInterviews() {
  const { data, error } = await supabase
    .from('interviews')
    .select('*, candidate:candidates(name, email, phone), job_opening:job_openings(title), interviewer:employees(first_name, last_name)')
    .order('scheduled_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Interview[]
}

export async function createInterview(input: {
  candidate_id?: string
  job_opening_id?: string
  interviewer_id?: string
  round?: string
  scheduled_at: string
  mode?: string
  meeting_link?: string
  slot_key?: string
}) {
  const { data, error } = await supabase.from('interviews').insert(input).select().single()
  if (error) throw error
  return data as Interview
}

export async function updateInterviewStatus(id: string, status: string, feedback?: string, rating?: number, metrics?: Record<string, number>) {
  void metrics
  const { data, error } = await supabase
    .from('interviews')
    .update({ status, feedback: feedback ?? null, rating: rating ?? null })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Interview
}

// ---------- Interview slots (recruiter-published pool) ----------
// The live schema has no interview_slots table — the pool is the set of
// unclaimed interview stubs (candidate_id IS NULL, status 'proposed').
type SlotRow = Interview & { interviewer?: { first_name: string | null; last_name: string | null } | null }

const slotFromInterview = (row: SlotRow): InterviewSlot => ({
  id: row.id,
  job_opening_id: row.job_opening_id ?? '',
  round: row.round === 'HR' ? 'hr' : 'technical',
  scheduled_at: row.scheduled_at ?? new Date().toISOString(),
  meeting_link: row.meeting_link ?? null,
  max_candidates: 1,
  status: 'open',
  created_by: row.interviewer_id ?? null,
  created_at: row.created_at,
})

export async function fetchInterviewSlots(jobOpeningId?: string) {
  let query = supabase
    .from('interviews')
    .select('*, interviewer:employees(first_name, last_name)')
    .is('candidate_id', null)
    .eq('status', 'proposed')
    .eq('reschedule_requested', false)
    .order('scheduled_at')
  if (jobOpeningId) query = query.eq('job_opening_id', jobOpeningId)
  const { data, error } = await query
  if (error) throw error
  return ((data ?? []) as unknown as SlotRow[]).map(slotFromInterview)
}

export async function createInterviewSlot(input: {
  job_opening_id: string
  round: string
  scheduled_at: string
  meeting_link?: string
  max_candidates?: number
}) {
  const { data, error } = await supabase
    .from('interviews')
    .insert({
      candidate_id: null,
      job_opening_id: input.job_opening_id,
      round: input.round === 'hr' ? 'HR' : 'Technical',
      scheduled_at: input.scheduled_at,
      mode: 'online',
      meeting_link: input.meeting_link ?? null,
      status: 'proposed',
      feedback: null,
      rating: null,
    })
    .select()
    .single()
  if (error) throw error
  return slotFromInterview(data as unknown as SlotRow)
}

export async function updateInterviewSlot(id: string, patch: Partial<InterviewSlot>) {
  const update: Record<string, unknown> = {}
  if (patch.scheduled_at !== undefined) update.scheduled_at = patch.scheduled_at
  if (patch.meeting_link !== undefined) update.meeting_link = patch.meeting_link
  if (patch.status !== undefined) update.status = patch.status === 'closed' ? 'closed' : 'proposed'
  const { data, error } = await supabase.from('interviews').update(update).eq('id', id).select().single()
  if (error) throw error
  return slotFromInterview(data as unknown as SlotRow)
}

export async function deleteInterviewSlot(id: string) {
  const { error } = await supabase.from('interviews').delete().eq('id', id)
  if (error) throw error
}

/**
 * Admin review of a candidate's reschedule request.
 * approve → the interview moves to the candidate's preferred time.
 * reject → the request is closed; the candidate must pick an available slot
 *          or the round ends in disqualification once all slots elapse.
 */
export async function reviewRescheduleRequest(id: string, decision: 'approve' | 'reject', preferredTime?: string, adminNote?: string) {
  void adminNote
  const patch =
    decision === 'approve'
      ? {
          scheduled_at: preferredTime ?? null,
          reschedule_requested: false,
          reschedule_status: 'accepted',
          status: 'scheduled',
        }
      : {
          reschedule_requested: false,
          reschedule_status: 'rejected',
        }
  const { data, error } = await supabase.from('interviews').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data as Interview
}


export async function fetchOffers() {
  const { data, error } = await supabase
    .from('offers')
    .select('*, candidate:candidates(name, email), job_opening:job_openings(title)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Offer[]
}

export async function createOffer(input: {
  candidate_id: string
  job_opening_id?: string
  salary_offered?: number
  joining_date?: string
  service_bond_years?: number | null
  relocation_required?: boolean
  relocation_location?: string | null
  salary_breakdown?: { base_salary: number; variable: number; allowances: number; gross_total: number } | null
  status?: string
}) {
  const { data: session } = await supabase.auth.getSession()
  const { data, error } = await supabase
    .from('offers')
    .insert({ ...input, issued_by: session.session?.user.id ?? null })
    .select()
    .single()
  if (error) throw error
  return data as Offer
}

export async function updateOffer(id: string, patch: Record<string, unknown>) {
  const { data, error } = await supabase.from('offers').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data as Offer
}

export async function updateOfferStatus(id: string, status: string) {
  const { data, error } = await supabase.from('offers').update({ status }).eq('id', id).select().single()
  if (error) throw error
  return data as Offer
}

// ---------- Audit ----------
export async function fetchAuditLogs() {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data ?? []) as AuditLog[]
}
