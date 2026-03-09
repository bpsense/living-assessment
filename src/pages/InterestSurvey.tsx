import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2, ArrowRight, Sparkles, ChevronLeft } from 'lucide-react'
import { clsx } from 'clsx'
import { supabase } from '../lib/supabase'
import { DimensionIcon } from '../components/student/DimensionIcon'
import type { Student, Dimension } from '../types/database'

// ============================================================
// Rating options — emoji faces with labels
// ============================================================

const RATING_OPTIONS = [
  { value: 1, label: 'Not really', emoji: '😐' },
  { value: 2, label: 'A little', emoji: '🙂' },
  { value: 3, label: "It's okay", emoji: '😊' },
  { value: 4, label: 'I like it!', emoji: '😄' },
  { value: 5, label: 'I love it!', emoji: '🤩' },
]

type Screen = 'loading' | 'error' | 'welcome' | 'question' | 'saving' | 'thanks'

interface SessionInfo {
  student_id: string
  school_id: string
}

// ============================================================
// Main component
// ============================================================

export default function InterestSurvey() {
  const { token } = useParams<{ token: string }>()

  const [screen, setScreen] = useState<Screen>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  // Data loaded from session
  const [student, setStudent] = useState<Student | null>(null)
  const [dimensions, setDimensions] = useState<Dimension[]>([])
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)

  // Survey progress
  const [currentIndex, setCurrentIndex] = useState(0)
  const [responses, setResponses] = useState<Record<string, number>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [showNote, setShowNote] = useState(false)
  const [transitioning, setTransitioning] = useState(false)

  // ---------- Validate token & load data ----------
  useEffect(() => {
    if (!token) {
      setErrorMsg('No survey token provided.')
      setScreen('error')
      return
    }

    async function loadSession() {
      // 1. Validate session token
      const { data: session, error: sessionErr } = await supabase
        .from('student_sessions')
        .select('*')
        .eq('token', token)
        .gt('expires_at', new Date().toISOString())
        .single()

      if (sessionErr || !session) {
        setErrorMsg('This survey link has expired or is invalid.')
        setScreen('error')
        return
      }

      // 2. Fetch student
      const { data: studentData, error: studentErr } = await supabase
        .from('students')
        .select('*')
        .eq('id', session.student_id)
        .single()

      if (studentErr || !studentData) {
        setErrorMsg('Learner not found.')
        setScreen('error')
        return
      }

      // 3. Fetch dimensions for this school
      const { data: dims, error: dimsErr } = await supabase
        .from('dimensions')
        .select('*')
        .eq('school_id', studentData.school_id)
        .eq('is_active', true)
        .order('display_order')

      if (dimsErr || !dims || dims.length === 0) {
        setErrorMsg('No learning dimensions found.')
        setScreen('error')
        return
      }

      setStudent(studentData as Student)
      setDimensions(dims as Dimension[])
      setSessionInfo({
        student_id: session.student_id,
        school_id: studentData.school_id,
      })
      setScreen('welcome')
    }

    loadSession()
  }, [token])

  // ---------- Derived values ----------
  const currentDimension = dimensions[currentIndex] ?? null
  const currentScore = currentDimension ? responses[currentDimension.id] : undefined
  const currentNote = currentDimension ? notes[currentDimension.id] ?? '' : ''
  const progress =
    dimensions.length > 0 ? ((currentIndex + 1) / dimensions.length) * 100 : 0

  // ---------- Handlers ----------
  function selectRating(value: number) {
    if (!currentDimension) return
    setResponses((prev) => ({ ...prev, [currentDimension.id]: value }))
  }

  function updateNote(value: string) {
    if (!currentDimension) return
    setNotes((prev) => ({ ...prev, [currentDimension.id]: value }))
  }

  function goNext() {
    if (currentIndex < dimensions.length - 1) {
      setTransitioning(true)
      setTimeout(() => {
        setCurrentIndex((i) => i + 1)
        setShowNote(false)
        setTransitioning(false)
      }, 150)
    } else {
      saveSurvey()
    }
  }

  function goBack() {
    if (currentIndex > 0) {
      setTransitioning(true)
      setTimeout(() => {
        setCurrentIndex((i) => i - 1)
        setShowNote(false)
        setTransitioning(false)
      }, 150)
    }
  }

  async function saveSurvey() {
    if (!sessionInfo) return
    setScreen('saving')

    // Build responses payload:
    // Top-level: { dimension_id: score }
    // _notes: { dimension_id: note_text } for any "say more" text
    const noteEntries = Object.entries(notes).filter(([, v]) => v.trim())
    const payload: Record<string, unknown> = { ...responses }
    if (noteEntries.length > 0) {
      const notesObj: Record<string, string> = {}
      for (const [id, text] of noteEntries) {
        notesObj[id] = text.trim()
      }
      payload._notes = notesObj
    }

    const { error } = await supabase.from('interest_surveys').insert({
      student_id: sessionInfo.student_id,
      school_id: sessionInfo.school_id,
      responses: payload,
    })

    if (error) {
      setErrorMsg('Could not save your answers. Please try again.')
      setScreen('error')
      return
    }

    setScreen('thanks')
  }

  // ========== SCREEN RENDERS ==========

  // ---------- Loading / Saving ----------
  if (screen === 'loading' || screen === 'saving') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-accent-50 to-white">
        <div className="text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-accent-500" />
          <p className="mt-4 text-sm text-text-muted">
            {screen === 'saving'
              ? 'Saving your answers...'
              : 'Getting your survey ready...'}
          </p>
        </div>
      </div>
    )
  }

  // ---------- Error ----------
  if (screen === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-accent-50 to-white px-6">
        <div className="text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-alert-50">
            <span className="text-4xl">😕</span>
          </div>
          <h1 className="mt-5 text-xl font-bold text-text">Oops!</h1>
          <p className="mt-2 max-w-xs text-sm text-text-muted">{errorMsg}</p>
          <p className="mt-1 text-xs text-text-light">
            Please ask your teacher for a new link.
          </p>
        </div>
      </div>
    )
  }

  // ---------- Welcome ----------
  if (screen === 'welcome' && student) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-accent-50 via-white to-primary-50 px-6">
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-accent-100">
            <span className="text-5xl">👋</span>
          </div>
          <h1 className="text-3xl font-bold text-text">
            Hi {student.first_name}!
          </h1>
          <p className="mx-auto mt-3 max-w-xs text-lg text-text-muted">
            Let's find out what you love to learn about.
          </p>
          <p className="mt-2 text-sm text-text-light">
            There are no wrong answers!
          </p>
          <p className="mt-1 text-xs text-text-light">
            {dimensions.length} quick questions
          </p>
          <button
            onClick={() => setScreen('question')}
            className="mt-8 rounded-2xl bg-gradient-to-r from-accent-400 to-accent-500 px-10 py-4 text-lg font-bold text-white shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl active:scale-95"
          >
            Let's Go! 🚀
          </button>
        </div>
      </div>
    )
  }

  // ---------- Thanks ----------
  if (screen === 'thanks' && student) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-accent-50 via-white to-primary-50 px-6">
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-success-50">
            <span className="text-5xl">🎉</span>
          </div>
          <h1 className="text-3xl font-bold text-text">You did it!</h1>
          <p className="mx-auto mt-3 max-w-xs text-lg text-text-muted">
            Thanks for sharing what you love, {student.first_name}!
          </p>
          <div className="mx-auto mt-8 max-w-xs rounded-2xl border border-bg-muted bg-bg-card p-5 shadow-sm">
            <p className="text-sm font-medium text-text">
              📋 Please give this device back to your teacher
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ---------- Question ----------
  if (screen === 'question' && currentDimension) {
    return (
      <div className="flex min-h-screen flex-col bg-gradient-to-b from-accent-50/60 to-white">
        {/* Progress bar */}
        <div className="h-2 w-full bg-bg-muted">
          <div
            className="h-full rounded-r-full bg-gradient-to-r from-accent-300 to-accent-500 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Top bar */}
        <div className="flex items-center justify-between px-4 pt-3">
          <button
            onClick={goBack}
            disabled={currentIndex === 0}
            className={clsx(
              'flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition-colors',
              currentIndex === 0
                ? 'invisible'
                : 'text-text-muted hover:text-text'
            )}
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
          <span className="text-xs font-medium text-text-light">
            {currentIndex + 1} of {dimensions.length}
          </span>
          <div className="w-16" />
        </div>

        {/* Question content */}
        <div
          className={clsx(
            'flex flex-1 flex-col items-center justify-center px-6 pb-28 transition-opacity duration-150',
            transitioning ? 'opacity-0' : 'opacity-100'
          )}
        >
          {/* Dimension icon */}
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-accent-100 shadow-sm">
            <DimensionIcon
              name={currentDimension.icon}
              className="h-10 w-10 text-accent-600"
            />
          </div>

          {/* Dimension name */}
          <h2 className="text-center text-2xl font-bold text-text">
            {currentDimension.name}
          </h2>
          {currentDimension.description && (
            <p className="mx-auto mt-2 max-w-sm text-center text-sm text-text-muted">
              {currentDimension.description}
            </p>
          )}

          {/* Question prompt */}
          <p className="mt-8 text-center text-base font-medium text-text-muted">
            How much do you like this?
          </p>

          {/* Rating circles */}
          <div className="mt-6 flex items-end justify-center gap-3 sm:gap-5">
            {RATING_OPTIONS.map((opt) => {
              const isSelected = currentScore === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => selectRating(opt.value)}
                  className="group flex flex-col items-center gap-2"
                >
                  <div
                    className={clsx(
                      'flex items-center justify-center rounded-full border-[3px] transition-all duration-200',
                      'h-14 w-14 sm:h-[4.5rem] sm:w-[4.5rem]',
                      isSelected
                        ? 'scale-110 border-accent-400 bg-gradient-to-br from-accent-200 to-accent-400 shadow-lg'
                        : 'border-bg-muted bg-white shadow-sm hover:border-accent-200 hover:shadow-md active:scale-95'
                    )}
                  >
                    <span
                      className={clsx(
                        'text-2xl transition-transform duration-200 sm:text-3xl',
                        isSelected && 'scale-110'
                      )}
                    >
                      {opt.emoji}
                    </span>
                  </div>
                  <span
                    className={clsx(
                      'max-w-[64px] text-center text-[11px] font-medium leading-tight transition-colors sm:text-xs',
                      isSelected ? 'text-accent-700' : 'text-text-light'
                    )}
                  >
                    {opt.label}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Optional note */}
          {currentScore !== undefined && (
            <div className="mt-8 w-full max-w-sm">
              {!showNote && !currentNote ? (
                <button
                  onClick={() => setShowNote(true)}
                  className="mx-auto flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-text-light transition-colors hover:bg-bg-muted hover:text-text-muted"
                >
                  💬 Want to say more?
                </button>
              ) : (
                <textarea
                  value={currentNote}
                  onChange={(e) => updateNote(e.target.value)}
                  placeholder="Tell us what you think..."
                  rows={2}
                  className="w-full rounded-xl border border-bg-muted bg-white px-4 py-3 text-sm text-text placeholder:text-text-light focus:border-accent-300 focus:outline-none focus:ring-2 focus:ring-accent-100"
                  autoFocus={showNote && !currentNote}
                />
              )}
            </div>
          )}
        </div>

        {/* Bottom navigation */}
        <div className="fixed inset-x-0 bottom-0 border-t border-bg-muted/60 bg-white/90 px-6 py-4 backdrop-blur-md">
          <div className="mx-auto flex max-w-sm justify-center">
            <button
              onClick={goNext}
              disabled={currentScore === undefined}
              className={clsx(
                'flex items-center gap-2 rounded-2xl px-8 py-3.5 text-base font-bold transition-all duration-200',
                currentScore !== undefined
                  ? 'bg-gradient-to-r from-accent-400 to-accent-500 text-white shadow-lg hover:shadow-xl active:scale-95'
                  : 'bg-bg-muted text-text-light'
              )}
            >
              {currentIndex === dimensions.length - 1 ? (
                <>
                  All Done! <Sparkles className="h-5 w-5" />
                </>
              ) : (
                <>
                  Next <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
