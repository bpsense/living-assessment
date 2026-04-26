import { useCallback, useEffect, useState } from 'react'
import { clsx } from 'clsx'
import {
  AlertCircle,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'

import { useAuth } from '../../lib/auth'
import { useToast } from '../../components/Toast'
import ConfirmDialog from '../../components/ConfirmDialog'
import {
  cloneDefaultProfileForSchool,
  createDomain,
  deleteDomain,
  fetchActiveProfile,
  reorderDomains,
  resetToDefaultProfile,
  updateDomain,
} from '../../lib/learner-profile-data'
import type {
  LearnerProfileDomain,
  LearnerProfileWithDomains,
} from '../../types/learner-profile'

const DEFAULT_DOMAIN_COLOR = '#6366F1'

interface DomainDraft {
  id?: string
  name: string
  description: string
  color: string
}

const emptyDraft = (): DomainDraft => ({
  name: '',
  description: '',
  color: DEFAULT_DOMAIN_COLOR,
})

export default function LearnerProfileAdmin() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const schoolId = profile?.school_id ?? null

  const [activeProfile, setActiveProfile] = useState<LearnerProfileWithDomains | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'clone' | 'reset' | 'reorder' | null>(null)

  const [editorOpen, setEditorOpen] = useState(false)
  const [draft, setDraft] = useState<DomainDraft>(emptyDraft())
  const [saving, setSaving] = useState(false)

  const [confirmDelete, setConfirmDelete] = useState<LearnerProfileDomain | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const load = useCallback(async () => {
    if (!schoolId) return
    setLoading(true)
    setError(null)
    try {
      const result = await fetchActiveProfile(schoolId)
      setActiveProfile(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load Learner Profile')
    } finally {
      setLoading(false)
    }
  }, [schoolId])

  useEffect(() => {
    void load()
  }, [load])

  const isDefault = activeProfile?.is_default ?? true
  const editable = !!activeProfile && !isDefault

  // ---- Clone the default into an editable working copy ----
  async function handleClone() {
    if (!schoolId || busy) return
    setBusy('clone')
    try {
      const cloned = await cloneDefaultProfileForSchool(schoolId)
      setActiveProfile(cloned)
      toast('Created an editable copy of the default profile', 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to clone profile', 'error')
    } finally {
      setBusy(null)
    }
  }

  // ---- Reset to default (deletes the school's working copy) ----
  async function handleReset() {
    if (!schoolId || busy) return
    setBusy('reset')
    try {
      const fresh = await resetToDefaultProfile(schoolId)
      setActiveProfile(fresh)
      toast('Reset to the default Learner Profile', 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to reset', 'error')
    } finally {
      setBusy(null)
      setConfirmReset(false)
    }
  }

  // ---- Drag-to-reorder ----
  async function handleDragEnd(event: DragEndEvent) {
    if (!activeProfile || !editable) return
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = activeProfile.domains.findIndex((d) => d.id === active.id)
    const newIndex = activeProfile.domains.findIndex((d) => d.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(activeProfile.domains, oldIndex, newIndex).map((d, i) => ({
      ...d,
      sort_order: i,
    }))
    const previous = activeProfile
    setActiveProfile({ ...activeProfile, domains: reordered })

    setBusy('reorder')
    try {
      await reorderDomains(
        activeProfile.id,
        reordered.map((d) => d.id)
      )
    } catch (e) {
      setActiveProfile(previous)
      toast(e instanceof Error ? e.message : 'Failed to save order', 'error')
    } finally {
      setBusy(null)
    }
  }

  // ---- Add / edit domain ----
  function openCreate() {
    setDraft(emptyDraft())
    setEditorOpen(true)
  }

  function openEdit(domain: LearnerProfileDomain) {
    setDraft({
      id: domain.id,
      name: domain.name,
      description: domain.description ?? '',
      color: domain.color ?? DEFAULT_DOMAIN_COLOR,
    })
    setEditorOpen(true)
  }

  async function handleSaveDraft() {
    if (!activeProfile || saving) return
    const name = draft.name.trim()
    if (!name) {
      toast('Domain name is required', 'error')
      return
    }
    setSaving(true)
    try {
      if (draft.id) {
        await updateDomain(draft.id, {
          name,
          description: draft.description.trim() || null,
          color: draft.color,
        })
      } else {
        await createDomain(activeProfile.id, {
          name,
          description: draft.description.trim() || null,
          color: draft.color,
        })
      }
      setEditorOpen(false)
      await load()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to save domain', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteConfirm() {
    if (!confirmDelete) return
    try {
      await deleteDomain(confirmDelete.id)
      toast(`"${confirmDelete.name}" removed`, 'success')
      setConfirmDelete(null)
      await load()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to delete domain', 'error')
    }
  }

  // ---- Render ----
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary-400" />
      </div>
    )
  }

  if (!activeProfile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="rounded-xl border border-dashed border-bg-muted bg-bg-card p-8 text-center">
          <p className="text-sm text-text-muted">
            No Learner Profile found for this school yet. The default template should be
            seeded automatically — try refreshing the page.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-0">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">{activeProfile.name}</h1>
          <p className="mt-1 text-sm text-text-muted">
            {isDefault
              ? 'This is the system-managed default template — clone it to make a school-owned, editable copy.'
              : 'Customize the competency domains that drive your school’s amoeba visualization.'}
          </p>
          {activeProfile.description && (
            <p className="mt-2 text-xs text-text-light">{activeProfile.description}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {isDefault ? (
            <button
              onClick={handleClone}
              disabled={!!busy}
              className="flex items-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === 'clone' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Clone & Customize
            </button>
          ) : (
            <>
              <button
                onClick={() => setConfirmReset(true)}
                disabled={!!busy}
                className="flex items-center gap-1.5 rounded-xl border border-bg-muted px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" />
                Reset to Default
              </button>
              <button
                onClick={openCreate}
                className="flex items-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-600"
              >
                <Plus className="h-4 w-4" />
                Add Domain
              </button>
            </>
          )}
        </div>
      </div>

      {/* Status badge */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span
          className={clsx(
            'rounded-full px-2 py-0.5 font-medium',
            isDefault ? 'bg-bg-muted text-text-muted' : 'bg-primary-50 text-primary-700'
          )}
        >
          {isDefault ? 'Default template (read-only)' : 'School-owned'}
        </span>
        <span className="text-text-light">
          {activeProfile.domains.length} domain
          {activeProfile.domains.length === 1 ? '' : 's'}
        </span>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-alert-50 px-4 py-3 text-sm text-alert-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Domain list */}
      {activeProfile.domains.length === 0 ? (
        <div className="rounded-xl border border-dashed border-bg-muted py-12 text-center">
          <p className="text-sm text-text-muted">
            No domains yet.{' '}
            {editable && (
              <button
                onClick={openCreate}
                className="font-medium text-primary-500 hover:underline"
              >
                Add the first one
              </button>
            )}
          </p>
        </div>
      ) : editable ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={activeProfile.domains.map((d) => d.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="space-y-2">
              {activeProfile.domains.map((domain) => (
                <SortableDomainRow
                  key={domain.id}
                  domain={domain}
                  onEdit={() => openEdit(domain)}
                  onDelete={() => setConfirmDelete(domain)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      ) : (
        <ul className="space-y-2">
          {activeProfile.domains.map((domain) => (
            <ReadOnlyDomainRow key={domain.id} domain={domain} />
          ))}
        </ul>
      )}

      {/* Editor modal */}
      {editorOpen && (
        <DomainEditor
          draft={draft}
          onChange={setDraft}
          onClose={() => setEditorOpen(false)}
          onSave={handleSaveDraft}
          saving={saving}
        />
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDeleteConfirm}
        title={`Remove "${confirmDelete?.name ?? ''}"?`}
        message="This domain will no longer appear on the amoeba. Skills and assignments tagged to it (added in a later phase) would need to be re-tagged. This cannot be undone."
        confirmLabel="Remove"
        confirmVariant="danger"
      />

      {/* Reset confirm */}
      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={handleReset}
        title="Reset to Default Learner Profile?"
        message="Your school-owned profile will be deleted and replaced with a fresh copy of the default template. This cannot be undone."
        confirmLabel="Reset"
        confirmVariant="danger"
        loading={busy === 'reset'}
      />
    </div>
  )
}

// ============================================================
// Sortable row
// ============================================================

interface RowProps {
  domain: LearnerProfileDomain
  onEdit: () => void
  onDelete: () => void
}

function SortableDomainRow({ domain, onEdit, onDelete }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: domain.id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={clsx(
        'flex items-center gap-3 rounded-xl border border-bg-muted bg-bg-card px-3 py-3 shadow-sm',
        isDragging && 'shadow-lg ring-2 ring-primary-200'
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none rounded p-1 text-text-light hover:bg-bg-muted hover:text-text-muted active:cursor-grabbing"
        aria-label={`Drag ${domain.name}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span
        className="h-8 w-8 shrink-0 rounded-full border border-white/60 shadow-inner"
        style={{ backgroundColor: domain.color ?? '#94A3B8' }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text">{domain.name}</p>
        {domain.description && (
          <p className="truncate text-xs text-text-light">{domain.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="rounded-lg p-1.5 text-text-light transition-colors hover:bg-bg-muted hover:text-text"
        aria-label={`Edit ${domain.name}`}
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="rounded-lg p-1.5 text-text-light transition-colors hover:bg-alert-50 hover:text-alert-500"
        aria-label={`Delete ${domain.name}`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  )
}

function ReadOnlyDomainRow({ domain }: { domain: LearnerProfileDomain }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-bg-muted bg-bg-card px-3 py-3">
      <span
        className="h-8 w-8 shrink-0 rounded-full border border-white/60 shadow-inner"
        style={{ backgroundColor: domain.color ?? '#94A3B8' }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text">{domain.name}</p>
        {domain.description && (
          <p className="text-xs text-text-light">{domain.description}</p>
        )}
      </div>
    </li>
  )
}

// ============================================================
// Domain editor modal
// ============================================================

interface EditorProps {
  draft: DomainDraft
  onChange: (next: DomainDraft) => void
  onClose: () => void
  onSave: () => void
  saving: boolean
}

function DomainEditor({ draft, onChange, onClose, onSave, saving }: EditorProps) {
  const isEdit = !!draft.id

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={() => !saving && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-text">
          {isEdit ? 'Edit Domain' : 'Add Domain'}
        </h2>

        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-text-muted">Name</span>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => onChange({ ...draft, name: e.target.value })}
              className="mt-1 w-full rounded-lg border border-bg-muted bg-white px-3 py-2 text-sm text-text shadow-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
              placeholder="e.g. Mathematical Thinking"
              autoFocus
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-text-muted">Description</span>
            <textarea
              value={draft.description}
              onChange={(e) => onChange({ ...draft, description: e.target.value })}
              rows={3}
              className="mt-1 w-full rounded-lg border border-bg-muted bg-white px-3 py-2 text-sm text-text shadow-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
              placeholder="What kinds of growth does this domain capture?"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-text-muted">Color</span>
            <div className="mt-1 flex items-center gap-3">
              <input
                type="color"
                value={draft.color}
                onChange={(e) => onChange({ ...draft, color: e.target.value })}
                className="h-10 w-14 cursor-pointer rounded border border-bg-muted bg-white"
                aria-label="Domain color"
              />
              <input
                type="text"
                value={draft.color}
                onChange={(e) => onChange({ ...draft, color: e.target.value })}
                className="flex-1 rounded-lg border border-bg-muted bg-white px-3 py-2 font-mono text-sm uppercase text-text shadow-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
                placeholder="#6366F1"
              />
            </div>
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? 'Save changes' : 'Add domain'}
          </button>
        </div>
      </div>
    </div>
  )
}
