// Real exam-attempt submission — persists the attempt through Supabase.
// No fabricated scores: the candidate's Online Exam interview row is marked
// 'submitted' and the round stays in "awaiting evaluation" until the admin
// publishes results (status passed/failed + rating).

import { supabase } from '@/lib/supabase'
import type { Interview } from '@/lib/database.types'

export interface ExamSubmitResult {
  interview: Interview | null
}

export async function submitExamAttempt(
  candidateId: string,
  jobOpeningId: string | null | undefined
): Promise<ExamSubmitResult> {
  const { data: existing } = await supabase
    .from('interviews')
    .select('id')
    .eq('candidate_id', candidateId)
    .ilike('round', 'Online Exam')
    .maybeSingle()

  if (existing?.id) {
    const { data, error } = await supabase
      .from('interviews')
      .update({ status: 'submitted' })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw error
    return { interview: data as Interview }
  }

  const { data, error } = await supabase
    .from('interviews')
    .insert({
      candidate_id: candidateId,
      job_opening_id: jobOpeningId ?? null,
      round: 'Online Exam',
      scheduled_at: new Date().toISOString(),
      mode: 'online',
      status: 'submitted',
    })
    .select()
    .single()
  if (error) throw error

  return { interview: data as Interview }
}
