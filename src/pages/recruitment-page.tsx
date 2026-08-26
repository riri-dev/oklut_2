import { useState } from 'react'
import { toast } from 'sonner'
import { Briefcase, Plus, Loader2, Pencil, Trash2, CalendarClock, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { TableSkeleton } from '@/components/shared/skeletons'
import { StatusPill } from '@/components/shared/status-pill'
import {
  useJobOpenings,
  useCreateJobOpening,
  useUpdateJobOpening,
  useDeleteJobOpening,
  useCandidates,
  useCreateCandidate,
  useUpdateCandidateStatus,
  useUpdateCandidate,
  useDeleteCandidate,
  useInterviews,
  useCreateInterview,
  useUpdateInterviewStatus,
  useReviewRescheduleRequest,
  useOffers,
  useCreateOffer,
  useUpdateOfferStatus,
  useEmployees,
  useDepartments,
} from '@/hooks/use-queries'
import { useAuth } from '@/features/auth/auth-context'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { formatDate, formatDateTime, formatCurrency } from '@/lib/format'
import type { Interview } from '@/lib/database.types'
import { fetchInterviewSlots, createInterviewSlot, updateInterviewSlot, deleteInterviewSlot } from '@/lib/api/modules'

interface SlotDraft {
  id?: string
  scheduled_at: string
  meeting_link: string
  max_candidates: string
}

interface SlotOrigin {
  scheduled_at: string
  meeting_link: string
  max_candidates: number
}

function JobsTab() {
  const { isManager } = useAuth()
  const { data: jobs = [], isLoading } = useJobOpenings()
  const { data: departments = [] } = useDepartments()
  const create = useCreateJobOpening()
  const update = useUpdateJobOpening()
  const del = useDeleteJobOpening()

  const [dialog, setDialog] = useState(false)
  const [editing, setEditing] = useState<{ id: string } | null>(null)
  const [title, setTitle] = useState('')
  const [dept, setDept] = useState('')
  const [location, setLocation] = useState('')
  const [count, setCount] = useState('1')
  const [type, setType] = useState('Full-time')
  const [description, setDescription] = useState('')
  const [requirements, setRequirements] = useState('')
  const [status, setStatus] = useState('Open')
  const [lastDate, setLastDate] = useState('')
  const [totalQuestions, setTotalQuestions] = useState('30')
  const [examDuration, setExamDuration] = useState('60')
  const [passingScore, setPassingScore] = useState('70')
  const [windowStart, setWindowStart] = useState('')
  const [windowEnd, setWindowEnd] = useState('')
  const [examStartDate, setExamStartDate] = useState('')
  const [examEndDate, setExamEndDate] = useState('')
  const [examLink, setExamLink] = useState('')
  // Interview slot pools — recruiter publishes as many slots as wanted per round.
  const [techSlots, setTechSlots] = useState<SlotDraft[]>([])
  const [hrSlots, setHrSlots] = useState<SlotDraft[]>([])
  const [slotOrigins, setSlotOrigins] = useState<Record<string, SlotOrigin>>({})

  const addSlotDraft = (round: 'technical' | 'hr') => {
    const setter = round === 'technical' ? setTechSlots : setHrSlots
    setter((prev) => [...prev, { scheduled_at: '', meeting_link: '', max_candidates: '1' }])
  }

  const patchSlotDraft = (round: 'technical' | 'hr', idx: number, patch: Partial<SlotDraft>) => {
    const setter = round === 'technical' ? setTechSlots : setHrSlots
    setter((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
  }

  const removeSlotDraft = (round: 'technical' | 'hr', idx: number) => {
    const setter = round === 'technical' ? setTechSlots : setHrSlots
    setter((prev) => prev.filter((_, i) => i !== idx))
  }

  const openDialog = (j?: { id: string; title: string; department_id?: string | null; location?: string | null; openings_count: number; employment_type?: string | null; description?: string | null; requirements?: string | null; status?: string | null; total_questions?: number | null; exam_duration_mins?: number | null; exam_passing_score?: number | null; exam_window_start?: string | null; exam_window_end?: string | null; exam_start_date?: string | null; exam_end_date?: string | null; exam_link?: string | null }) => {
    setEditing(j ? { id: j.id } : null)
    setTitle(j?.title ?? '')
    setDept(j?.department_id ?? '')
    setLocation(j?.location ?? '')
    setCount(String(j?.openings_count ?? 1))
    setType(j?.employment_type ?? 'Full-time')
    const desc = j?.description ?? ''
    const match = desc.match(/\[Last Date: (.*?)\]/)
    setLastDate(match ? match[1] : '')
    setDescription(desc.replace(/\[Last Date: .*?\]\n?/, '').trim())
    setRequirements(j?.requirements ?? '')
    setStatus(j?.status ?? 'Open')
    setTotalQuestions(String(j?.total_questions ?? 30))
    setExamDuration(String(j?.exam_duration_mins ?? 60))
    setPassingScore(String(j?.exam_passing_score ?? 70))
    setWindowStart(j?.exam_window_start ? j.exam_window_start.slice(0, 16) : '')
    setWindowEnd(j?.exam_window_end ? j.exam_window_end.slice(0, 16) : '')
    setExamStartDate(j?.exam_start_date ? j.exam_start_date.slice(0, 16) : (j?.exam_window_start ? j.exam_window_start.slice(0, 16) : ''))
    setExamEndDate(j?.exam_end_date ? j.exam_end_date.slice(0, 16) : (j?.exam_window_end ? j.exam_window_end.slice(0, 16) : ''))
    setExamLink(j?.exam_link ?? '')
    setTechSlots([])
    setHrSlots([])
    setSlotOrigins({})
    if (j?.id) {
      fetchInterviewSlots(j.id)
        .then((slots) => {
          const toDraft = (round: 'technical' | 'hr') =>
            slots
              .filter((s) => s.round === round)
              .map((s) => ({
                id: s.id,
                scheduled_at: s.scheduled_at.slice(0, 16),
                meeting_link: s.meeting_link ?? '',
                max_candidates: String(s.max_candidates),
              }))
          setTechSlots(toDraft('technical'))
          setHrSlots(toDraft('hr'))
          setSlotOrigins(
            Object.fromEntries(slots.map((s) => [s.id, { scheduled_at: s.scheduled_at, meeting_link: s.meeting_link ?? '', max_candidates: s.max_candidates }]))
          )
        })
        .catch(() => {
          // Slots couldn't load — the manager stays empty and is still usable.
        })
    }
    setDialog(true)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    const payload = {
      title: title.trim(),
      department_id: dept || undefined,
      location: location || undefined,
      openings_count: Number(count) || 1,
      employment_type: type,
      description: lastDate ? `[Last Date: ${lastDate}]\n${description}` : (description || undefined),
      requirements: requirements || undefined,
      status,
      published: status === 'Open',
      total_questions: Number(totalQuestions) || 30,
      exam_duration_mins: Number(examDuration) || 60,
      exam_passing_score: Number(passingScore) || 70,
      exam_window_start: windowStart ? new Date(windowStart).toISOString() : null,
      exam_window_end: windowEnd ? new Date(windowEnd).toISOString() : null,
      exam_start_date: examStartDate ? new Date(examStartDate).toISOString() : null,
      exam_end_date: examEndDate ? new Date(examEndDate).toISOString() : null,
      exam_link: examLink.trim() || null,
    }
    if (editing) await update.mutateAsync({ id: editing.id, patch: payload })
    else {
      const created = await create.mutateAsync(payload)
      await syncSlots(created.id)
    }
    if (editing) await syncSlots(editing.id)
    setDialog(false)
  }

  // Persist the slot pools: update changed existing slots, insert new ones,
  // delete slots the recruiter removed. Runs after the job row is saved.
  const syncSlots = async (jobId: string) => {
    const allDrafts = [
      ...techSlots.map((s) => ({ ...s, round: 'technical' as const })),
      ...hrSlots.map((s) => ({ ...s, round: 'hr' as const })),
    ]
    const keptIds = new Set(allDrafts.filter((s) => s.id).map((s) => s.id!))

    for (const id of Object.keys(slotOrigins)) {
      if (!keptIds.has(id)) await deleteInterviewSlot(id)
    }

    for (const draft of allDrafts) {
      const iso = draft.scheduled_at ? new Date(draft.scheduled_at).toISOString() : null
      const max = Number(draft.max_candidates) || 1
      const link = draft.meeting_link.trim() || null
      if (draft.id) {
        const origin = slotOrigins[draft.id]
        if (origin && (origin.scheduled_at !== iso || origin.meeting_link !== (link ?? '') || origin.max_candidates !== max)) {
          await updateInterviewSlot(draft.id, { scheduled_at: iso ?? undefined, meeting_link: link ?? undefined, max_candidates: max })
        }
      } else if (iso) {
        await createInterviewSlot({
          job_opening_id: jobId,
          round: draft.round,
          scheduled_at: iso,
          meeting_link: link ?? undefined,
          max_candidates: max,
        })
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {isManager && (
          <Button onClick={() => openDialog()}>
            <Plus className="mr-2 h-4 w-4" /> New Opening
          </Button>
        )}
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : jobs.length === 0 ? (
        <EmptyState title="No job openings" description="Create job openings to start recruiting." icon={Briefcase} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {jobs.map((j) => (
            <div key={j.id} className="flex flex-col rounded-xl border bg-card p-5">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium">{j.title} {j.requirements?.includes('Fresher') ? <span className="text-[10px] bg-blue-100 text-blue-800 px-1 py-0.5 rounded ml-1">Fresher</span> : <span className="text-[10px] bg-purple-100 text-purple-800 px-1 py-0.5 rounded ml-1">Experienced</span>}</h3>
                  <p className="text-xs text-muted-foreground">
                    {j.department?.name ?? 'General'} · {j.location ?? 'Remote'} · {j.employment_type ?? 'Full-time'}
                  </p>
                </div>
                <StatusPill status={j.status ?? (j.published ? 'Open' : 'closed')} />
              </div>
              <div className="mb-3">
                <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary ring-1 ring-inset ring-primary/20">
                  Referral Code: REF-{j.title.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase()}{j.id.slice(-4).toUpperCase()}
                </span>
              </div>
              <div className="mb-3 flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
                <div className="flex items-center gap-1"><CalendarClock className="h-3 w-3" /> Posted: {new Date(j.created_at).toLocaleDateString()}</div>
                {j.description?.match(/\[Last Date: (.*?)\]/) && (
                  <div className="flex items-center gap-1 text-red-600/80"><CalendarClock className="h-3 w-3" /> Last Date: {new Date(j.description.match(/\[Last Date: (.*?)\]/)![1]).toLocaleDateString()}</div>
                )}
              </div>
              {j.description && <p className="line-clamp-3 flex-1 text-sm text-muted-foreground">{j.description.replace(/\[Last Date: .*?\]\n?/, '')}</p>}
              <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm">
                <span className="font-medium">{j.openings_count} opening{j.openings_count > 1 ? 's' : ''}</span>
                {isManager && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDialog(j)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete opening?</AlertDialogTitle>
                          <AlertDialogDescription>Remove the {j.title} opening and its pipeline?</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => del.mutate(j.id)} className="bg-destructive text-destructive-foreground">
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Opening' : 'New Job Opening'}</DialogTitle>
            <DialogDescription>Create or update a job opening.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Senior Software Engineer" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={dept || undefined} onValueChange={setDept}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Mumbai / Remote" />
              </div>
              <div className="space-y-2">
                <Label>Openings</Label>
                <Input type="number" min={1} value={count} onChange={(e) => setCount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Employment type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Full-time">Full-time</SelectItem>
                    <SelectItem value="Part-time">Part-time</SelectItem>
                    <SelectItem value="Contract">Contract</SelectItem>
                    <SelectItem value="Internship">Internship</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Open">Open</SelectItem>
                    <SelectItem value="On Hold">On Hold</SelectItem>
                    <SelectItem value="Closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Last Date to Apply</Label>
                <Input type="date" value={lastDate} onChange={(e) => setLastDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Experience Level</Label>
              <Select value={requirements.includes('Fresher') ? 'Fresher' : 'Experienced'} onValueChange={(v) => setRequirements(v === 'Fresher' ? 'Fresher required' : 'Experienced required')}>
                <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Fresher">Fresher (Exam → Tech → HR)</SelectItem>
                  <SelectItem value="Experienced">Experienced (Tech → HR → Manager)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Requirements</Label>
              <Textarea value={requirements} onChange={(e) => setRequirements(e.target.value)} rows={3} />
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Online Exam Configuration (Fresher Track)</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Total questions</Label>
                  <Input type="number" min={1} value={totalQuestions} onChange={(e) => setTotalQuestions(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Duration (mins)</Label>
                  <Input type="number" min={1} value={examDuration} onChange={(e) => setExamDuration(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Passing score</Label>
                  <Input type="number" min={0} max={100} value={passingScore} onChange={(e) => setPassingScore(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Exam start date</Label>
                  <Input type="datetime-local" value={examStartDate} onChange={(e) => setExamStartDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Exam end date</Label>
                  <Input type="datetime-local" value={examEndDate} onChange={(e) => setExamEndDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Exam link (URL)</Label>
                <Input
                  type="url"
                  placeholder="https://exam.example.com/..."
                  value={examLink}
                  onChange={(e) => setExamLink(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Opens in a new tab from the candidate portal. Leave empty to use the embedded exam.</p>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 space-y-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Interview Slot Configuration</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Publish interview slots for candidates to choose from. Add as many slots as you want for each round — candidates pick one from the portal dropdown.
                </p>
              </div>
              {(['technical', 'hr'] as const).map((round) => (
                <div key={round} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{round === 'technical' ? 'Technical Interview Slots' : 'HR Interview Slots'}</span>
                    <Button type="button" size="sm" variant="outline" onClick={() => addSlotDraft(round)}>
                      <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Slot
                    </Button>
                  </div>
                  {(round === 'technical' ? techSlots : hrSlots).length === 0 && (
                    <p className="text-xs text-muted-foreground">No slots published yet. Click &quot;Add Slot&quot; to create one.</p>
                  )}
                  {(round === 'technical' ? techSlots : hrSlots).map((s, idx) => (
                    <div key={s.id ?? `new-${idx}`} className="grid grid-cols-1 gap-2 rounded-lg border bg-card p-2 sm:grid-cols-[1.2fr_1.6fr_90px_36px] sm:items-center">
                      <Input
                        type="datetime-local"
                        className="h-8 text-xs"
                        value={s.scheduled_at}
                        onChange={(e) => patchSlotDraft(round, idx, { scheduled_at: e.target.value })}
                      />
                      <Input
                        className="h-8 text-xs"
                        placeholder="Meeting link (https://meet.google.com/...)"
                        value={s.meeting_link}
                        onChange={(e) => patchSlotDraft(round, idx, { meeting_link: e.target.value })}
                      />
                      <Input
                        type="number"
                        min={1}
                        className="h-8 text-xs"
                        placeholder="Max candidates"
                        value={s.max_candidates}
                        onChange={(e) => patchSlotDraft(round, idx, { max_candidates: e.target.value })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => removeSlotDraft(round, idx)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={create.isPending || update.isPending}>
                {(create.isPending || update.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? 'Save' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CandidatesTab() {
  const { data: candidates = [], isLoading } = useCandidates()
  const { data: jobs = [] } = useJobOpenings()
  const create = useCreateCandidate()
  const updateStatus = useUpdateCandidateStatus()
  const updateCandidate = useUpdateCandidate()
  const del = useDeleteCandidate()

  const [dialog, setDialog] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [jobId, setJobId] = useState('')
  const [source, setSource] = useState('')
  const [resumeUrl, setResumeUrl] = useState('')
  const [category, setCategory] = useState('Fresher')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim()) return

    await create.mutateAsync({ name: name.trim(), email: email.trim(), phone: phone || undefined, job_opening_id: jobId || undefined, source: source || undefined, resume_url: resumeUrl || undefined, category })
    setDialog(false)
    setName(''); setEmail(''); setPhone(''); setJobId(''); setSource(''); setResumeUrl('')
  }

  const stageOptions = ['Applied', 'Screening', 'Interview', 'Shortlisted', 'Offered', 'Hired', 'Rejected']

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialog(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Candidate
        </Button>
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} />
      ) : candidates.length === 0 ? (
        <EmptyState title="No candidates" description="Add candidates to build your pipeline." />
      ) : (
        <div className="rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3">Candidate</th>
                  <th className="px-4 py-3">Applied For</th>
                  <th className="px-4 py-3">Track</th>
                  <th className="px-4 py-3">ATS Score</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Malpractice / AI</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.email}</p>
                      <div className="mt-1 flex flex-col gap-1">
                        <div className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded border border-green-200 inline-block w-max">
                          Portal: <a href="#" className="underline">Auth Link</a> | PW: {c.id.substring(0, 6).toUpperCase()}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">{c.job_opening?.title ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      {c.category === 'Experienced' ? (
                        <span className="inline-flex items-center rounded-md bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-600/10">Experienced</span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/10">Fresher</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {(() => {
                        const parsedScore = c.source?.includes('(ATS:') ? parseInt(c.source.split('(ATS: ')[1]) : undefined
                        const displayScore = c.ats_score ?? parsedScore
                        return displayScore ? (
                          <div className="flex items-center gap-1">
                            <span className={`font-semibold ${displayScore > 80 ? 'text-green-600' : displayScore > 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                              {displayScore}
                            </span>
                          </div>
                        ) : '—'
                      })()}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col gap-1">
                        <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <Switch
                            className="scale-75"
                            checked={!!c.malpractice_flag}
                            onCheckedChange={(v) => updateCandidate.mutate({ id: c.id, patch: { malpractice_flag: v } })}
                          />
                          Malpractice
                        </label>
                        <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <Switch
                            className="scale-75"
                            checked={!!c.cheating_detected}
                            onCheckedChange={(v) => updateCandidate.mutate({ id: c.id, patch: { cheating_detected: v } })}
                          />
                          AI Tool Violation
                        </label>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">{c.source?.replace(/\s*\(ATS:.*?\)/, '') ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Select value={c.status ?? 'Applied'} onValueChange={(v) => updateStatus.mutate({ id: c.id, status: v })}>
                          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {stageOptions.map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {c.status !== 'Shortlisted' && c.status !== 'Offered' && c.status !== 'Hired' && (
                          <Button size="sm" variant="outline" className="h-8 text-xs font-semibold text-primary" onClick={() => updateStatus.mutate({ id: c.id, status: 'Shortlisted' })}>
                            Shortlist
                          </Button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete candidate?</AlertDialogTitle>
                            <AlertDialogDescription>Remove {c.name} from the pipeline?</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => del.mutate(c.id)} className="bg-destructive text-destructive-foreground">
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Candidate</DialogTitle>
            <DialogDescription>Add a candidate to the hiring pipeline.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Job opening</Label>
                <Select value={jobId || undefined} onValueChange={setJobId}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {jobs.map((j) => (
                      <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Track / Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Fresher">Fresher (Exam → Tech → HR)</SelectItem>
                    <SelectItem value="Experienced">Experienced (Tech → HR)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Source</Label>
              <Select value={source || undefined} onValueChange={setSource}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {['Referral', 'LinkedIn', 'Naukri', 'Portal', 'Walk-in', 'Other'].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Resume/CV Document</Label>
              <Input type="file" accept=".pdf,.doc,.docx" onChange={e => {
                const file = e.target.files?.[0]
                if (file) setResumeUrl(file.name)
              }} />
              <p className="text-[11px] text-muted-foreground">Attach the candidate&apos;s resume for reference. Storage is handled by the backend.</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function InterviewsTab() {
  const queryClient = useQueryClient()
  const { data: interviews = [], isLoading } = useInterviews()
  const { data: candidates = [] } = useCandidates()
  const { data: employees = [] } = useEmployees()
  const { data: jobs = [] } = useJobOpenings()
  const create = useCreateInterview()
  const updateStatus = useUpdateInterviewStatus()
  const reviewReschedule = useReviewRescheduleRequest()
  const update = useUpdateCandidate()
  const updateJob = useUpdateJobOpening()

  const [dialog, setDialog] = useState(false)
  const [candidateId, setCandidateId] = useState('')
  const [jobId, setJobId] = useState('')
  const [interviewerId, setInterviewerId] = useState('')
  const [round, setRound] = useState('First Round')
  const [scheduledAt, setScheduledAt] = useState('')
  const [mode, setMode] = useState('video')
  const [link, setLink] = useState('')
  const [slotKey, setSlotKey] = useState('')
  const [slotMax, setSlotMax] = useState('')

  const SLOT_KEYS = ['technical_slot_1', 'technical_slot_2', 'technical_slot_3', 'hr_slot_1', 'hr_slot_2', 'hr_slot_3']

  const slotLabel = (key: string) =>
    key === 'technical_slot_1' ? 'Technical Slot 1' :
    key === 'technical_slot_2' ? 'Technical Slot 2' :
    key === 'technical_slot_3' ? 'Technical Slot 3' :
    key === 'hr_slot_1' ? 'HR Slot 1' :
    key === 'hr_slot_2' ? 'HR Slot 2' : 'HR Slot 3'

  const maxForSlot = (key: string) =>
    key === 'technical_slot_1' ? 'technical_slot_1_max_count' as const :
    key === 'technical_slot_2' ? 'technical_slot_2_max_count' as const :
    key === 'technical_slot_3' ? 'technical_slot_3_max_count' as const :
    key === 'hr_slot_1' ? 'hr_slot_1_max_count' as const :
    key === 'hr_slot_2' ? 'hr_slot_2_max_count' as const : 'hr_slot_3_max_count' as const

  const openSchedule = () => {
    setCandidateId('')
    setJobId('')
    setInterviewerId('')
    setRound('First Round')
    setScheduledAt('')
    setMode('video')
    setLink('')
    setSlotKey('')
    setSlotMax('')
    setDialog(true)
  }

  const METRIC_SETS: Record<string, string[]> = {
    'Online Exam': ['Accuracy', 'Speed', 'Problem Solving', 'Time Management'],
    Technical: ['Domain Knowledge', 'Communication', 'Body Language', 'Adaptability'],
    HR: ['Culture Fit', 'Decorum', 'Stability', 'Teamwork'],
  }

  const [scorecard, setScorecard] = useState<Interview | null>(null)
  const [metricValues, setMetricValues] = useState<Record<string, number>>({})
  const [scoreStatus, setScoreStatus] = useState<'passed' | 'failed'>('passed')
  const [scoreFeedback, setScoreFeedback] = useState('')
  const [rejectTarget, setRejectTarget] = useState<Interview | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const metricNames = scorecard ? (METRIC_SETS[scorecard.round] ?? ['Domain Knowledge', 'Communication', 'Body Language', 'Adaptability']) : []

  const openScorecard = (i: Interview) => {
    setScorecard(i)
    setMetricValues({ ...(i.metrics ?? {}), ...Object.fromEntries((METRIC_SETS[i.round] ?? []).map((m) => [m, i.metrics?.[m] ?? 3])) })
    setScoreStatus(i.status === 'failed' ? 'failed' : 'passed')
    setScoreFeedback(i.feedback ?? '')
  }

  const submitScorecard = async () => {
    if (!scorecard) return
    const metrics = Object.fromEntries(metricNames.map((m) => [m, Math.max(1, Math.min(5, Number(metricValues[m]) || 3))]))
    const avg = metricNames.reduce((s, m) => s + (metrics[m] ?? 0), 0) / metricNames.length
    await updateStatus.mutateAsync({
      id: scorecard.id,
      status: scoreStatus,
      metrics,
      rating: Math.round(avg * 10) / 10,
      feedback: scoreFeedback.trim() || undefined,
    })
    // Sync the round verdict onto the candidate so the next round unlocks
    // immediately in the candidate portal (technical_interview_status /
    // hr_interview_status are the portal's unlock gates).
    const cand = candidates.find((c) => c.id === scorecard.candidate_id)
    if (cand) {
      const normalized = (scorecard.round ?? '').toLowerCase()
      const patch: Record<string, string> = {}
      if (normalized === 'technical') patch.technical_interview_status = scoreStatus
      if (normalized === 'hr') patch.hr_interview_status = scoreStatus
      if (Object.keys(patch).length) {
        update.mutate({
          id: cand.id,
          patch: { ...patch, status: scoreStatus === 'failed' ? 'rejected' : cand.status ?? 'interview' },
        })
      }
    }
    setScorecard(null)
  }

const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!candidateId || !scheduledAt) return
    await create.mutateAsync({
      candidate_id: candidateId,
      job_opening_id: jobId || undefined,
      interviewer_id: interviewerId || undefined,
      round: round || undefined,
      scheduled_at: new Date(scheduledAt).toISOString(),
      mode: mode || undefined,
      meeting_link: link || undefined,
      slot_key: slotKey || undefined,
    })
    if (candidateId) {
      const payload: Record<string, string> = {}
      if (round?.toLowerCase().includes('hr')) payload.hr_interview_date = new Date(scheduledAt).toISOString()
      else if (round?.toLowerCase().includes('techn')) payload.technical_interview_date = new Date(scheduledAt).toISOString()
      if (Object.keys(payload).length) update.mutate({ id: candidateId, patch: payload })
    }
    if (slotKey) {
      const opening = jobs.find((j) => j.id === jobId)
      const max = slotMax ? Number(slotMax) : undefined
      if (opening && max) updateJob.mutate({ id: opening.id, patch: { [maxForSlot(slotKey)]: max } })
    }
    toast.success('Interview scheduled.')
    setDialog(false)
    queryClient.invalidateQueries({ queryKey: queryKeys.interviews })
    queryClient.invalidateQueries({ queryKey: queryKeys.candidates })
  }

  const rescheduleRequests = interviews.filter((i) => i.reschedule_requested === true && i.reschedule_status === 'pending')
  // Legacy pool rows (candidate_id null) are superseded by interview_slots — hide them.
  const candidateInterviews = interviews.filter((i) => i.candidate_id)

  const handleApproveReschedule = async (i: Interview) => {
    if (!i.reschedule_preferred_time) return
    await reviewReschedule.mutateAsync({ id: i.id, decision: 'approve', preferredTime: i.reschedule_preferred_time })
    const cand = candidates.find((c) => c.id === i.candidate_id)
    if (cand) {
      const patch: Record<string, string> = {}
      if ((i.round ?? '').toLowerCase() === 'technical') patch.technical_interview_date = i.reschedule_preferred_time
      if ((i.round ?? '').toLowerCase() === 'hr') patch.hr_interview_date = i.reschedule_preferred_time
      if (Object.keys(patch).length) update.mutate({ id: cand.id, patch })
    }
  }

  const handleRejectReschedule = (i: Interview) => {
    reviewReschedule.mutate({ id: i.id, decision: 'reject', adminNote: rejectNote.trim() || undefined })
    setRejectTarget(null)
    setRejectNote('')
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openSchedule}>
          <Plus className="mr-2 h-4 w-4" /> Schedule Interview
        </Button>
      </div>

      {rescheduleRequests.length > 0 && (
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Reschedule Requests ({rescheduleRequests.length})</h3>
            <span className="text-xs text-muted-foreground">Candidates asking to move their confirmed interview</span>
          </div>
          {rescheduleRequests.map((req) => (
            <div key={req.id} className="rounded-lg border bg-muted/20 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {req.candidate?.name ?? '—'} · <span className="text-muted-foreground">{req.round}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Currently: {formatDateTime(req.scheduled_at)}
                    {req.reschedule_preferred_time && (
                      <> → Wants: <span className="font-medium text-primary">{formatDateTime(req.reschedule_preferred_time)}</span></>
                    )}
                  </p>
                  {req.reschedule_reason && (
                    <p className="mt-1.5 rounded-md border bg-card px-2.5 py-1.5 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Reason:</span> {req.reschedule_reason}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    size="sm"
                    className="h-8 bg-green-600 text-xs hover:bg-green-700"
                    disabled={reviewReschedule.isPending}
                    onClick={() => handleApproveReschedule(req)}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={reviewReschedule.isPending}
                    onClick={() => {
                      setRejectTarget(req)
                      setRejectNote('')
                    }}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Approving moves the interview to the candidate&apos;s preferred time. Rejecting keeps the original slot — the candidate must then pick an available slot or is disqualified once all slots elapse.
          </p>
        </div>
      )}

      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : interviews.length === 0 ? (
        <EmptyState title="No interviews" description="Schedule interviews to track the hiring process." icon={CalendarClock} />
      ) : (
        <div className="rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3">Candidate</th>
                  <th className="px-4 py-3">Round</th>
                  <th className="px-4 py-3">Job</th>
                  <th className="px-4 py-3">Interviewer</th>
                  <th className="px-4 py-3">Scheduled</th>
                  <th className="px-4 py-3">Mode</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Malpractice</th>
                  <th className="px-4 py-3">Rating</th>
                </tr>
              </thead>
              <tbody>
                {candidateInterviews.map((i) => (
                  <tr key={i.id} className="border-b last:border-0">
                    <td className="px-4 py-2.5 font-medium">{i.candidate?.name}</td>
                    <td className="px-4 py-2.5">
                      {i.round}
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {i.job_opening?.requirements?.includes('Fresher') ? '(Fresher Track)' : '(Experienced Track)'}
                      </p>
                    </td>
                    <td className="px-4 py-2.5">{i.job_opening?.title ?? '—'}</td>
                    <td className="px-4 py-2.5">{i.interviewer ? `${i.interviewer.first_name} ${i.interviewer.last_name}` : '—'}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatDateTime(i.scheduled_at)}</td>
                    <td className="px-4 py-2.5 capitalize">{i.mode ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Select value={i.status ?? 'scheduled'} onValueChange={(v) => updateStatus.mutate({ id: i.id, status: v })}>
                          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="scheduled">Scheduled</SelectItem>
                            <SelectItem value="ongoing">Ongoing</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="passed">Passed</SelectItem>
                            <SelectItem value="failed">Failed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => openScorecard(i)}>
                          Scorecard
                        </Button>
                      </div>
                      {i.reschedule_status && (
                        <p className="mt-1 max-w-56 text-[10px] text-muted-foreground">
                          <span className="font-medium text-amber-700">
                            Reschedule {i.reschedule_status === 'pending' ? 'requested' : i.reschedule_status}
                          </span>
                          {i.reschedule_status === 'rejected' && i.reschedule_admin_note
                            ? ` — ${i.reschedule_admin_note}`
                            : i.reschedule_status === 'accepted'
                              ? ' — moved to preferred time'
                              : ''}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {i.malpractice_flag ? (
                        <span className="inline-flex items-center rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">Flagged</span>
                      ) : (
                        <span className="text-muted-foreground text-xs">Clear</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">{i.rating ? `${i.rating}/5` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Interview</DialogTitle>
            <DialogDescription>Book an interview round for a candidate.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>Candidate *</Label>
              <Select value={candidateId || undefined} onValueChange={setCandidateId}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {candidates.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Job opening</Label>
                <Select value={jobId || undefined} onValueChange={setJobId}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {jobs.map((j) => (
                      <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Round</Label>
                <Select value={round} onValueChange={setRound}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Online Exam">Online Exam</SelectItem>
                    <SelectItem value="Screening">Screening</SelectItem>
                    <SelectItem value="First Round">First Round</SelectItem>
                    <SelectItem value="Second Round">Second Round</SelectItem>
                    <SelectItem value="Technical">Technical</SelectItem>
                    <SelectItem value="HR">HR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Interviewer</Label>
                <Select value={interviewerId || undefined} onValueChange={setInterviewerId}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Mode</Label>
                <Select value={mode} onValueChange={setMode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="onsite">On-site</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Slot pool</Label>
                <Select
                  value={slotKey || undefined}
                  onValueChange={(v) => {
                    setSlotKey(v)
                    const opening = jobs.find((j) => j.id === jobId)
                    if (opening) {
                      const max = opening[maxForSlot(v)]
                      if (max != null) setSlotMax(String(max))
                    }
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="None (direct booking)" /></SelectTrigger>
                  <SelectContent>
                    {SLOT_KEYS.map((k) => (
                      <SelectItem key={k} value={k}>{slotLabel(k)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Slot max capacity</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="e.g. 10"
                  value={slotMax}
                  disabled={!slotKey}
                  onChange={(e) => setSlotMax(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Candidate Proposed Dates (3 options)</Label>
                <Input placeholder="e.g. Oct 12, Oct 14, Oct 15" />
              </div>
              <div className="space-y-2">
                <Label>Scheduled at *</Label>
                <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Meeting link</Label>
              <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.google.com/..." />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Schedule
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!scorecard} onOpenChange={(open) => !open && setScorecard(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Interviewer Scorecard — {scorecard?.round}</DialogTitle>
            <DialogDescription>Rate the candidate 1–5 on each metric, then record the verdict. The next round unlocks automatically on &quot;Passed&quot;.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {metricNames.map((m) => (
              <div key={m} className="flex items-center justify-between gap-4">
                <Label className="w-40">{m}</Label>
                <div className="flex flex-1 items-center gap-2">
                  <Input
                    type="range"
                    min={1}
                    max={5}
                    step={1}
                    value={metricValues[m] ?? 3}
                    onChange={(e) => setMetricValues((v) => ({ ...v, [m]: Number(e.target.value) }))}
                  />
                  <span className="w-8 text-sm font-semibold text-right">{metricValues[m] ?? 3}/5</span>
                </div>
              </div>
            ))}
            <div className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Overall rating: {metricNames.length ? (metricNames.reduce((s, m) => s + (Number(metricValues[m]) || 3), 0) / metricNames.length).toFixed(1) : '—'}/5
            </div>
            <div className="space-y-2">
              <Label>Verdict</Label>
              <Select value={scoreStatus} onValueChange={(v) => setScoreStatus(v as 'passed' | 'failed')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="passed">Passed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Feedback</Label>
              <Textarea
                rows={3}
                placeholder="Written feedback shown to the candidate in the portal"
                value={scoreFeedback}
                onChange={(e) => setScoreFeedback(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setScorecard(null)}>Cancel</Button>
            <Button type="button" onClick={submitScorecard} disabled={updateStatus.isPending}>
              {updateStatus.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Scorecard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectTarget !== null} onOpenChange={(o) => { if (!o) setRejectTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Reschedule Request</DialogTitle>
            <DialogDescription>
              {rejectTarget?.candidate?.name ?? 'The candidate'} keeps the original slot ({rejectTarget ? formatDateTime(rejectTarget.scheduled_at) : '—'}). The note below is shown to the candidate in their portal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Admin note (optional)</Label>
            <Textarea
              rows={3}
              placeholder="e.g. Slots full on requested date — please attend the original slot"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button
              type="button"
              variant="destructive"
              disabled={reviewReschedule.isPending}
              onClick={() => rejectTarget && handleRejectReschedule(rejectTarget)}
            >
              {reviewReschedule.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reject Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function OffersTab() {
  const { data: offers = [], isLoading } = useOffers()
  const { data: candidates = [] } = useCandidates()
  const { data: jobs = [] } = useJobOpenings()
  const create = useCreateOffer()
  const updateStatus = useUpdateOfferStatus()

  const [dialog, setDialog] = useState(false)
  const [candidateId, setCandidateId] = useState('')
  const [jobId, setJobId] = useState('')
  const [salary, setSalary] = useState('')
  const [joiningDate, setJoiningDate] = useState('')
  const [bondYears, setBondYears] = useState('0')
  const [relocation, setRelocation] = useState('Yes')
  const [relocationLocation, setRelocationLocation] = useState('')
  const [baseSalary, setBaseSalary] = useState('')
  const [variable, setVariable] = useState('')
  const [allowances, setAllowances] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!candidateId) return
    const base = Number(baseSalary) || 0
    const varPay = Number(variable) || 0
    const allow = Number(allowances) || 0
    await create.mutateAsync({
      candidate_id: candidateId,
      job_opening_id: jobId || undefined,
      salary_offered: salary ? Number(salary) : undefined,
      joining_date: joiningDate || undefined,
      status: 'issued',
      service_bond_years: bondYears === '0' ? null : Number(bondYears),
      relocation_required: relocation === 'Yes',
      relocation_location: relocationLocation || undefined,
      salary_breakdown: base || varPay || allow ? { base_salary: base, variable: varPay, allowances: allow, gross_total: base + varPay + allow } : null,
    })
    setDialog(false)
    setCandidateId(''); setJobId(''); setSalary(''); setJoiningDate(''); setRelocationLocation(''); setBaseSalary(''); setVariable(''); setAllowances('')
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialog(true)}>
          <Plus className="mr-2 h-4 w-4" /> Issue Offer
        </Button>
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : offers.length === 0 ? (
        <EmptyState title="No offers" description="Issue offers to candidates who have cleared interviews." icon={FileText} />
      ) : (
        <div className="rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3">Candidate</th>
                  <th className="px-4 py-3">Position</th>
                  <th className="px-4 py-3">Salary offered</th>
                  <th className="px-4 py-3">Joining date</th>
                  <th className="px-4 py-3">Response</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {offers.map((o) => (
                  <tr key={o.id} className="border-b last:border-0">
                    <td className="px-4 py-2.5 font-medium">{o.candidate?.name}</td>
                    <td className="px-4 py-2.5">{o.job_opening?.title ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      {o.salary_offered ? formatCurrency(o.salary_offered, true) : '—'}
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        Relocation: {o.relocation_required ? `Yes${o.relocation_location ? ` (${o.relocation_location})` : ''}` : 'No'} · Bond: {o.service_bond_years ? `${o.service_bond_years} yr` : 'No'}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">{o.joining_date ? formatDate(o.joining_date) : '—'}</td>
                    <td className="px-4 py-2.5">
                      {o.candidate_response === 'accepted' ? (
                        <span className="inline-flex items-center rounded-md bg-green-100 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">Full Acceptance (Green)</span>
                      ) : o.candidate_response === 'declined' ? (
                        <span className="inline-flex items-center rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">Rejected Terms (Red)</span>
                      ) : o.status === 'issued' ? (
                        <span className="inline-flex items-center rounded-md bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-600/10">Partial / Pending (Orange)</span>
                      ) : (
                        <span className="text-muted-foreground text-xs">Waiting</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Select value={o.status ?? 'issued'} onValueChange={(v) => updateStatus.mutate({ id: o.id, status: v })}>
                          <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="issued">Issued</SelectItem>
                            <SelectItem value="accepted">Accepted</SelectItem>
                            <SelectItem value="declined">Declined</SelectItem>
                            <SelectItem value="withdrawn">Withdrawn</SelectItem>
                          </SelectContent>
                        </Select>
                        {o.status === 'accepted' && (
                          <Button size="sm" variant="default" className="h-8 text-[11px] bg-green-600 hover:bg-green-700 text-white" onClick={() => toast.success(`Converted ${o.candidate?.name} to Employee. Employee ID and assets will be provisioned.`)}>
                            Convert to Employee
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue Offer</DialogTitle>
            <DialogDescription>Extend an offer letter to a candidate.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>Candidate *</Label>
              <Select value={candidateId || undefined} onValueChange={setCandidateId}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {candidates.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Position</Label>
              <Select value={jobId || undefined} onValueChange={setJobId}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {jobs.map((j) => (
                    <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CTC / Salary offered</Label>
                <Input type="number" value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Joining date</Label>
                <Input type="date" value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Relocation Support</Label>
                <Select value={relocation} onValueChange={setRelocation}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Employment Bond</Label>
                <Select value={bondYears} onValueChange={setBondYears}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Year Bond</SelectItem>
                    <SelectItem value="2">2 Year Bond</SelectItem>
                    <SelectItem value="3">3 Year Bond</SelectItem>
                    <SelectItem value="0">No Bond</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {relocation === 'Yes' && (
                <div className="space-y-2 col-span-2">
                  <Label>Relocation location</Label>
                  <Input value={relocationLocation} onChange={(e) => setRelocationLocation(e.target.value)} placeholder="e.g. Pune, Maharashtra" />
                </div>
              )}
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">CTC Breakdown (Annual)</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Base salary</Label>
                  <Input type="number" value={baseSalary} onChange={(e) => setBaseSalary(e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label>Variable pay</Label>
                  <Input type="number" value={variable} onChange={(e) => setVariable(e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label>Allowances</Label>
                  <Input type="number" value={allowances} onChange={(e) => setAllowances(e.target.value)} placeholder="0" />
                </div>
              </div>
              <div className="text-xs font-medium text-primary">
                Gross Total: {formatCurrency((Number(baseSalary) || 0) + (Number(variable) || 0) + (Number(allowances) || 0))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Issue
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function RecruitmentPage() {
  const { isManager } = useAuth()
  if (!isManager) return <PageHeader title="Recruitment" description="Only managers can access recruitment." />
  return (
    <div>
      <PageHeader title="Recruitment" description="Manage job openings, candidates, interviews and offers." />
      <Tabs defaultValue="jobs">
        <TabsList>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
          <TabsTrigger value="candidates">Candidates</TabsTrigger>
          <TabsTrigger value="interviews">Interviews</TabsTrigger>
          <TabsTrigger value="offers">Offers</TabsTrigger>
        </TabsList>
        <TabsContent value="jobs" className="mt-4"><JobsTab /></TabsContent>
        <TabsContent value="candidates" className="mt-4"><CandidatesTab /></TabsContent>
        <TabsContent value="interviews" className="mt-4"><InterviewsTab /></TabsContent>
        <TabsContent value="offers" className="mt-4"><OffersTab /></TabsContent>
      </Tabs>
    </div>
  )
}
