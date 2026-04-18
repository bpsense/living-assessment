import { useState, useEffect } from 'react'
import {
  X,
  Target,
  BookOpen,
  Library,
  Sparkles,
  PenLine,
  Hammer,
  ArrowLeft,
} from 'lucide-react'

// ============================================================
// Types
// ============================================================

export type AssignmentChoice =
  | 'skill-library'
  | 'skill-new'
  | 'project-library'
  | 'project-new'

interface Props {
  open: boolean
  onClose: () => void
  onChoice: (choice: AssignmentChoice) => void
}

// ============================================================
// Component
// ============================================================

export default function NewAssignmentChooser({ open, onClose, onChoice }: Props) {
  const [step, setStep] = useState<'type' | 'skill' | 'project'>('type')

  // Reset on open
  useEffect(() => {
    if (open) setStep('type')
  }, [open])

  // Escape to close
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  // Body scroll lock
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  function handleChoice(choice: AssignmentChoice) {
    onChoice(choice)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-text/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="glass-modal relative z-10 w-full max-w-lg rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-bg-muted px-5 py-4">
          <div className="flex items-center gap-2">
            {step !== 'type' && (
              <button
                onClick={() => setStep('type')}
                className="rounded-lg p-1 text-text-muted transition-colors hover:bg-bg-muted hover:text-text"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <h2 className="text-base font-semibold text-text">
              {step === 'type' && 'New Assignment'}
              {step === 'skill' && 'Assign a Skill'}
              {step === 'project' && 'Create a Project'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-text-muted transition-colors hover:bg-bg-muted hover:text-text"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-6">
          {step === 'type' && (
            <>
              <p className="mb-5 text-sm text-text-muted">
                What type of assignment would you like to create?
              </p>
              <div className="grid grid-cols-2 gap-4">
                <ChoiceCard
                  icon={<Target className="h-7 w-7 text-emerald-500" />}
                  iconBg="bg-emerald-50"
                  title="Skill"
                  description="Assess a specific skill with grade-level progression tracking"
                  onClick={() => setStep('skill')}
                />
                <ChoiceCard
                  icon={<BookOpen className="h-7 w-7 text-primary-500" />}
                  iconBg="bg-primary-50"
                  title="Project"
                  description="Create or use a project-based learning assignment"
                  onClick={() => setStep('project')}
                />
              </div>
            </>
          )}

          {step === 'skill' && (
            <>
              <p className="mb-5 text-sm text-text-muted">
                How would you like to assign a skill?
              </p>
              <div className="grid grid-cols-2 gap-4">
                <ChoiceCard
                  icon={<Library className="h-7 w-7 text-emerald-500" />}
                  iconBg="bg-emerald-50"
                  title="From Skill Library"
                  description="Browse standards-aligned skills and progression ladders"
                  onClick={() => handleChoice('skill-library')}
                />
                <ChoiceCard
                  icon={<PenLine className="h-7 w-7 text-violet-500" />}
                  iconBg="bg-violet-50"
                  title="Define New Skill"
                  description="Create a custom skill with grade-level expectations"
                  onClick={() => handleChoice('skill-new')}
                />
              </div>
            </>
          )}

          {step === 'project' && (
            <>
              <p className="mb-5 text-sm text-text-muted">
                How would you like to create a project?
              </p>
              <div className="grid grid-cols-2 gap-4">
                <ChoiceCard
                  icon={<Sparkles className="h-7 w-7 text-primary-500" />}
                  iconBg="bg-primary-50"
                  title="From Project Library"
                  description="Browse and use existing project templates"
                  onClick={() => handleChoice('project-library')}
                />
                <ChoiceCard
                  icon={<Hammer className="h-7 w-7 text-amber-500" />}
                  iconBg="bg-amber-50"
                  title="Build New Project"
                  description="Design a new PBL project from scratch"
                  onClick={() => handleChoice('project-new')}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Sub-components
// ============================================================

function ChoiceCard({
  icon,
  iconBg,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode
  iconBg: string
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-3 rounded-xl border border-bg-muted bg-bg p-5 text-center transition-all hover:border-primary-300 hover:shadow-md"
    >
      <div className={`flex h-14 w-14 items-center justify-center rounded-full ${iconBg}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-text">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-text-muted">{description}</p>
      </div>
    </button>
  )
}
