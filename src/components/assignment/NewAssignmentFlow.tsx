import { useState, useEffect } from 'react'
import { BookOpen, X } from 'lucide-react'
import type {
  Skill,
  SkillProgressionStep,
  AssignmentTemplate,
} from '../../types/database'
import NewAssignmentChooser, { type AssignmentChoice } from './NewAssignmentChooser'
import ProjectLibraryPicker from './ProjectLibraryPicker'
import TemplateBuilder from './TemplateBuilder'
import CreateAssignmentModal from './CreateAssignmentModal'
import SkillBrowser from '../skills/SkillBrowser'
import SkillAssignmentFlow from '../skills/SkillAssignmentFlow'
import InlineSkillCreator from '../skills/InlineSkillCreator'

interface Props {
  open: boolean
  onClose: () => void
  /** Pre-select a classroom for both skill and project assignments */
  defaultClassroomId?: string
  /** Fired after a project (template-based) assignment is created */
  onAssignmentCreated?: () => void
  /** Fired after a skill assignment is created */
  onSkillAssignmentCreated?: () => void
}

export default function NewAssignmentFlow({
  open,
  onClose,
  defaultClassroomId,
  onAssignmentCreated,
  onSkillAssignmentCreated,
}: Props) {
  const [showChooser, setShowChooser] = useState(false)

  const [showSkillBrowser, setShowSkillBrowser] = useState(false)
  const [showSkillCreator, setShowSkillCreator] = useState(false)
  const [skillAssignFlow, setSkillAssignFlow] = useState<{
    skill: Skill
    step: SkillProgressionStep
  } | null>(null)

  const [showProjectLibrary, setShowProjectLibrary] = useState(false)
  const [showTemplateBuilder, setShowTemplateBuilder] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<AssignmentTemplate | null>(null)
  const [postSaveTemplate, setPostSaveTemplate] = useState<AssignmentTemplate | null>(null)

  useEffect(() => {
    if (open) {
      setShowChooser(true)
    } else {
      setShowChooser(false)
      setShowSkillBrowser(false)
      setShowSkillCreator(false)
      setSkillAssignFlow(null)
      setShowProjectLibrary(false)
      setShowTemplateBuilder(false)
      setShowCreate(false)
      setSelectedTemplate(null)
      setPostSaveTemplate(null)
    }
  }, [open])

  function handleAssignmentChoice(choice: AssignmentChoice) {
    setShowChooser(false)
    switch (choice) {
      case 'skill-library':
        setShowSkillBrowser(true)
        break
      case 'skill-new':
        setShowSkillCreator(true)
        break
      case 'project-library':
        setShowProjectLibrary(true)
        break
      case 'project-new':
        setShowTemplateBuilder(true)
        break
    }
  }

  function handleSkillAssign(skill: Skill, step: SkillProgressionStep) {
    setShowSkillBrowser(false)
    setSkillAssignFlow({ skill, step })
  }

  function handleSkillCreated(skill: Skill, step: SkillProgressionStep) {
    setShowSkillCreator(false)
    setSkillAssignFlow({ skill, step })
  }

  function handleProjectLibrarySelect(template: AssignmentTemplate) {
    setShowProjectLibrary(false)
    setSelectedTemplate(template)
    setShowCreate(true)
  }

  function handleTemplateSaved(template: AssignmentTemplate) {
    setShowTemplateBuilder(false)
    setPostSaveTemplate(template)
  }

  function handleAssignNow() {
    if (!postSaveTemplate) return
    setSelectedTemplate(postSaveTemplate)
    setPostSaveTemplate(null)
    setShowCreate(true)
  }

  if (!open) return null

  return (
    <>
      <NewAssignmentChooser
        open={showChooser}
        onClose={onClose}
        onChoice={handleAssignmentChoice}
      />

      {showSkillBrowser && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4">
          <div
            className="absolute inset-0 bg-text/40 backdrop-blur-sm"
            onClick={() => {
              setShowSkillBrowser(false)
              onClose()
            }}
          />
          <div className="glass-modal relative z-10 my-8 w-full max-w-3xl rounded-2xl">
            <div className="flex items-center justify-between border-b border-bg-muted px-5 py-4">
              <h2 className="text-base font-semibold text-text">Browse Skills to Assign</h2>
              <button
                onClick={() => {
                  setShowSkillBrowser(false)
                  onClose()
                }}
                className="rounded-lg p-1 text-text-muted transition-colors hover:bg-bg-muted hover:text-text"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-5">
              <SkillBrowser
                onAssign={handleSkillAssign}
                showCreateButton={false}
              />
            </div>
          </div>
        </div>
      )}

      <InlineSkillCreator
        open={showSkillCreator}
        onClose={() => {
          setShowSkillCreator(false)
          onClose()
        }}
        onCreated={handleSkillCreated}
      />

      <SkillAssignmentFlow
        open={!!skillAssignFlow}
        onClose={() => {
          setSkillAssignFlow(null)
          onClose()
        }}
        onCreated={() => {
          onSkillAssignmentCreated?.()
          setSkillAssignFlow(null)
          onClose()
        }}
        initialSkill={skillAssignFlow?.skill ?? null}
        initialStep={skillAssignFlow?.step ?? null}
        classroomId={defaultClassroomId}
      />

      <ProjectLibraryPicker
        open={showProjectLibrary}
        onClose={() => {
          setShowProjectLibrary(false)
          onClose()
        }}
        onSelect={handleProjectLibrarySelect}
      />

      <TemplateBuilder
        open={showTemplateBuilder}
        onClose={() => {
          setShowTemplateBuilder(false)
          onClose()
        }}
        onSaved={() => { /* handled via onSavedWithTemplate */ }}
        showSaveDestination
        onSavedWithTemplate={handleTemplateSaved}
      />

      <CreateAssignmentModal
        open={showCreate}
        onClose={() => {
          setShowCreate(false)
          setSelectedTemplate(null)
          onClose()
        }}
        onCreated={() => {
          onAssignmentCreated?.()
          setShowCreate(false)
          setSelectedTemplate(null)
          onClose()
        }}
        template={selectedTemplate ?? undefined}
        classroomId={defaultClassroomId}
      />

      {postSaveTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-text/40 backdrop-blur-sm"
            onClick={() => {
              setPostSaveTemplate(null)
              onClose()
            }}
          />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-bg-card p-6 shadow-2xl text-center">
            <div className="mb-4 flex h-14 w-14 mx-auto items-center justify-center rounded-full bg-emerald-50">
              <BookOpen className="h-7 w-7 text-emerald-500" />
            </div>
            <h3 className="text-base font-semibold text-text">Project Saved!</h3>
            <p className="mt-1.5 text-sm text-text-muted">
              &ldquo;{postSaveTemplate.title}&rdquo; has been saved to your library.
              Would you like to assign it now?
            </p>
            <div className="mt-5 flex gap-3 justify-center">
              <button
                onClick={() => {
                  setPostSaveTemplate(null)
                  onClose()
                }}
                className="rounded-xl px-5 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-bg-muted"
              >
                Done
              </button>
              <button
                onClick={handleAssignNow}
                className="rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-600"
              >
                Assign Now
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
