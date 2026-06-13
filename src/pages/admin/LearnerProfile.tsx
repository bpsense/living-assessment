import { useState, useEffect, useCallback } from 'react'
import { clsx } from 'clsx'
import { Plus, RotateCcw, Loader2, ChevronDown, AlertCircle, Eye } from 'lucide-react'
import { usePageAccess } from '../../lib/role-permissions'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../components/Toast'
import ConfirmDialog from '../../components/ConfirmDialog'
import DimensionListItem from '../../components/admin/DimensionListItem'
import type { DimensionWithCount } from '../../components/admin/DimensionListItem'
import DimensionEditModal from '../../components/admin/DimensionEditModal'
import DimensionCompetencies from '../../components/admin/DimensionCompetencies'
import StandardsMappingSection from '../../components/admin/StandardsMappingSection'
import type { Dimension } from '../../types/database'

// ============================================================
// Default dimension definitions (must match seed data)
// ============================================================

// The Boundless 8 — the canonical default dimensions (see supabase/seed/boundless_framework.json).
// `name` is the action phrase; `category` mirrors the strand. Resetting re-creates these
// dimensions; competencies are (re)seeded separately by scripts/seed-boundless-framework.ts.
const DEFAULT_DIMENSIONS = [
  { name: 'Think Deeply', description: 'Scientific Thinking & Inquiry', icon: 'microscope', category: 'Academic', strand: 'Academic', learner_profile: 'Thinker', area_of_development: 'Scientific Thinking & Inquiry' },
  { name: 'Create Boldly', description: 'Creative Expression & Innovation', icon: 'palette', category: 'Academic', strand: 'Academic', learner_profile: 'Creative', area_of_development: 'Creative Expression & Innovation' },
  { name: 'Reason & Solve', description: 'Mathematical Thinking & Problem Solving', icon: 'calculator', category: 'Academic', strand: 'Academic', learner_profile: 'Problem solver', area_of_development: 'Mathematical Thinking & Problem Solving' },
  { name: 'Communicate with Impact', description: 'Literacy & Communication', icon: 'book-open', category: 'Academic', strand: 'Academic', learner_profile: 'Communicator', area_of_development: 'Literacy & Communication' },
  { name: 'Know Yourself', description: 'Inner Self & Wellbeing', icon: 'lightbulb', category: 'Social & Emotional', strand: 'Social-Emotional', learner_profile: 'Self-aware', area_of_development: 'Inner Self & Wellbeing' },
  { name: 'Keep Growing', description: 'Physical Wellbeing & Spirit of Growth', icon: 'heart-pulse', category: 'Social & Emotional', strand: 'Social-Emotional', learner_profile: 'Balanced', area_of_development: 'Physical Wellbeing & Spirit of Growth' },
  { name: 'Connect Across Difference', description: 'Collaborative & Relational Skills', icon: 'users', category: 'Social & Emotional', strand: 'Social-Emotional', learner_profile: 'Open-minded', area_of_development: 'Collaborative & Relational Skills' },
  { name: 'Navigate the World', description: 'Global Citizenship & Practical Life', icon: 'globe', category: 'Social & Emotional', strand: 'Social-Emotional', learner_profile: 'Global Citizen', area_of_development: 'Global Citizenship & Practical Life' },
]

const MAX_DIMENSIONS = 15

// ============================================================
// Main page component
// ============================================================

export default function LearnerProfile() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const { canEdit } = usePageAccess('learner-profile')

  // ---- State ----
  const [dimensions, setDimensions] = useState<DimensionWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Edit modal
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingDimension, setEditingDimension] = useState<Dimension | null>(
    null
  )

  // Confirm dialog
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<
    'deactivate' | 'reset' | null
  >(null)
  const [confirmTarget, setConfirmTarget] = useState<Dimension | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)

  // Inactive section
  const [showInactive, setShowInactive] = useState(false)

  // Competency builder: which dimensions are expanded + their competency counts
  const [expandedDims, setExpandedDims] = useState<Set<string>>(new Set())
  const [compCounts, setCompCounts] = useState<Record<string, number>>({})

  function toggleExpand(id: string) {
    setExpandedDims((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ---- Derived state ----
  const activeDimensions = dimensions.filter((d) => d.is_active)
  const inactiveDimensions = dimensions.filter((d) => !d.is_active)
  const activeCount = activeDimensions.length

  // ---- DnD sensors ----
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // ---- Data fetching ----
  const loadDimensions = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    setError(null)

    // Fetch all dimensions (including inactive — admin needs to see them)
    const { data: dims, error: dimsErr } = await supabase
      .from('dimensions')
      .select('*')
      .eq('school_id', profile.school_id)
      .order('display_order')

    if (dimsErr) {
      setError(dimsErr.message)
      setLoading(false)
      return
    }

    const allDims = (dims ?? []) as Dimension[]
    const dimIds = allDims.map((d) => d.id)

    // Fetch observation counts per dimension in a single query
    const obsCounts = new Map<string, number>()
    if (dimIds.length > 0) {
      const { data: obsData } = await supabase
        .from('observations')
        .select('dimension_id')
        .eq('school_id', profile.school_id)
        .in('dimension_id', dimIds)

      for (const row of (obsData ?? []) as { dimension_id: string }[]) {
        obsCounts.set(
          row.dimension_id,
          (obsCounts.get(row.dimension_id) ?? 0) + 1
        )
      }
    }

    // Competency counts per dimension (for the builder badges)
    const compCountMap: Record<string, number> = {}
    if (dimIds.length > 0) {
      const { data: compData } = await supabase
        .from('competencies')
        .select('dimension_id')
        .eq('school_id', profile.school_id)
        .in('dimension_id', dimIds)
      for (const row of (compData ?? []) as { dimension_id: string | null }[]) {
        if (row.dimension_id) compCountMap[row.dimension_id] = (compCountMap[row.dimension_id] ?? 0) + 1
      }
    }
    setCompCounts(compCountMap)

    setDimensions(
      allDims.map((d) => ({
        ...d,
        observation_count: obsCounts.get(d.id) ?? 0,
      }))
    )
    setLoading(false)
  }, [profile])

  useEffect(() => {
    loadDimensions()
  }, [loadDimensions])

  // ---- Drag-and-drop reorder ----
  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = activeDimensions.findIndex((d) => d.id === active.id)
    const newIndex = activeDimensions.findIndex((d) => d.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(activeDimensions, oldIndex, newIndex)

    // Optimistic update
    const previousDimensions = [...dimensions]
    setDimensions([
      ...reordered.map((d, i) => ({ ...d, display_order: i + 1 })),
      ...inactiveDimensions,
    ])

    // Persist
    const results = await Promise.all(
      reordered.map((d, i) =>
        supabase
          .from('dimensions')
          .update({ display_order: i + 1 })
          .eq('id', d.id)
      )
    )

    const failed = results.some((r) => r.error)
    if (failed) {
      setDimensions(previousDimensions)
      toast('Failed to save new order', 'error')
    } else {
      toast('Order updated', 'success')
    }
  }

  // ---- Edit ----
  function handleEdit(dim: Dimension) {
    setEditingDimension(dim)
    setEditModalOpen(true)
  }

  function handleAddNew() {
    setEditingDimension(null)
    setEditModalOpen(true)
  }

  // ---- Deactivate ----
  function requestDeactivate(dim: Dimension) {
    setConfirmTarget(dim)
    setConfirmAction('deactivate')
    setConfirmOpen(true)
  }

  async function executeDeactivate() {
    if (!confirmTarget) return
    setConfirmLoading(true)

    const { error: err } = await supabase
      .from('dimensions')
      .update({ is_active: false })
      .eq('id', confirmTarget.id)

    setConfirmLoading(false)
    setConfirmOpen(false)

    if (err) {
      toast(`Failed to deactivate: ${err.message}`, 'error')
      return
    }
    toast(`"${confirmTarget.name}" deactivated`, 'success')
    setConfirmTarget(null)
    setConfirmAction(null)
    loadDimensions()
  }

  // ---- Toggle family visibility ----
  async function handleToggleFamilyVisibility(dim: Dimension) {
    const newValue = !dim.visible_to_family

    // Optimistic update
    setDimensions((prev) =>
      prev.map((d) =>
        d.id === dim.id ? { ...d, visible_to_family: newValue } : d
      )
    )

    const { error: err } = await supabase
      .from('dimensions')
      .update({ visible_to_family: newValue })
      .eq('id', dim.id)

    if (err) {
      // Revert on failure
      setDimensions((prev) =>
        prev.map((d) =>
          d.id === dim.id ? { ...d, visible_to_family: !newValue } : d
        )
      )
      toast(`Failed to update visibility: ${err.message}`, 'error')
      return
    }

    toast(
      newValue
        ? `"${dim.name}" is now visible to families`
        : `"${dim.name}" is now hidden from families`,
      'success'
    )
  }

  // ---- Reactivate ----
  async function handleReactivate(dim: Dimension) {
    if (activeCount >= MAX_DIMENSIONS) {
      toast(`Maximum of ${MAX_DIMENSIONS} active dimensions reached`, 'error')
      return
    }

    const { error: err } = await supabase
      .from('dimensions')
      .update({ is_active: true, display_order: activeCount + 1 })
      .eq('id', dim.id)

    if (err) {
      toast(`Failed to reactivate: ${err.message}`, 'error')
      return
    }
    toast(`"${dim.name}" reactivated`, 'success')
    loadDimensions()
  }

  // ---- Reset to defaults ----
  function requestReset() {
    setConfirmTarget(null)
    setConfirmAction('reset')
    setConfirmOpen(true)
  }

  async function executeReset() {
    if (!profile) return
    setConfirmLoading(true)

    // Step 1: Deactivate all current dimensions (preserves observation history)
    const { error: deactivateErr } = await supabase
      .from('dimensions')
      .update({ is_active: false })
      .eq('school_id', profile.school_id)
      .eq('is_active', true)

    if (deactivateErr) {
      setConfirmLoading(false)
      setConfirmOpen(false)
      toast(`Failed to reset: ${deactivateErr.message}`, 'error')
      return
    }

    // Step 2: Insert fresh default dimensions
    const { error: insertErr } = await supabase.from('dimensions').insert(
      DEFAULT_DIMENSIONS.map((d, i) => ({
        school_id: profile.school_id,
        name: d.name,
        description: d.description,
        display_order: i + 1,
        icon: d.icon,
        category: d.category,
        strand: d.strand,
        learner_profile: d.learner_profile,
        area_of_development: d.area_of_development,
        is_active: true,
      }))
    )

    setConfirmLoading(false)
    setConfirmOpen(false)

    if (insertErr) {
      toast(`Failed to insert defaults: ${insertErr.message}`, 'error')
      return
    }
    toast('Dimensions reset to defaults', 'success')
    setConfirmAction(null)
    loadDimensions()
  }

  // ---- Confirm dialog handler ----
  function handleConfirm() {
    if (confirmAction === 'deactivate') {
      executeDeactivate()
    } else if (confirmAction === 'reset') {
      executeReset()
    }
  }

  // ---- Loading state ----
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary-400" />
      </div>
    )
  }

  // ---- Confirm dialog text ----
  const confirmTitle =
    confirmAction === 'reset'
      ? 'Reset to Default Dimensions?'
      : `Deactivate "${confirmTarget?.name}"?`

  const confirmMessage =
    confirmAction === 'reset'
      ? 'This will deactivate all current dimensions and create the 8 Boundless default dimensions. Existing observation data will be preserved but linked to the old (inactive) dimensions. Competencies are seeded separately. This cannot be undone.'
      : confirmTarget
        ? `This dimension has ${(confirmTarget as DimensionWithCount).observation_count ?? 0} observation${((confirmTarget as DimensionWithCount).observation_count ?? 0) !== 1 ? 's' : ''}. It will be hidden from all views but historical data will be preserved. You can reactivate it later.`
        : ''

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-0">
      {/* ---- Header ---- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Learner Profile</h1>
          <p className="mt-1 text-sm text-text-muted">
            Customize the learning dimensions for your school. Use the{' '}
            <Eye className="inline h-3.5 w-3.5 text-primary-500" /> toggle to control which
            dimensions families can see.
          </p>
        </div>
        {canEdit && (
          <div className="flex shrink-0 gap-2">
            <button
              onClick={requestReset}
              className="flex items-center gap-1.5 rounded-xl border border-bg-muted px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-bg-muted"
            >
              <RotateCcw className="h-4 w-4" />
              Reset to Defaults
            </button>
            <button
              onClick={handleAddNew}
              disabled={activeCount >= MAX_DIMENSIONS}
              className="flex items-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Add Dimension
            </button>
          </div>
        )}
      </div>

      {/* ---- Active count bar ---- */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-muted">
            <span className="font-semibold text-text">{activeCount}</span> of{' '}
            {MAX_DIMENSIONS} dimensions active
          </span>
          {activeCount >= MAX_DIMENSIONS && (
            <span className="text-xs font-medium text-caution-500">
              Maximum reached
            </span>
          )}
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-bg-muted">
          <div
            className={clsx(
              'h-full rounded-full transition-all duration-300',
              activeCount >= MAX_DIMENSIONS
                ? 'bg-caution-500'
                : 'bg-primary-500'
            )}
            style={{ width: `${(activeCount / MAX_DIMENSIONS) * 100}%` }}
          />
        </div>
      </div>

      {/* ---- Error ---- */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-alert-50 px-4 py-3 text-sm text-alert-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ---- Active dimensions (sortable) ---- */}
      {activeDimensions.length === 0 && !loading ? (
        <div className="rounded-xl border border-dashed border-bg-muted py-12 text-center">
          <p className="text-sm text-text-muted">
            No active dimensions.{' '}
            <button
              onClick={handleAddNew}
              className="font-medium text-primary-500 hover:underline"
            >
              Add one
            </button>{' '}
            or{' '}
            <button
              onClick={requestReset}
              className="font-medium text-primary-500 hover:underline"
            >
              reset to defaults
            </button>
            .
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={activeDimensions.map((d) => d.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {activeDimensions.map((dim) => (
                <div key={dim.id}>
                  <DimensionListItem
                    dimension={dim}
                    onEdit={handleEdit}
                    onDeactivate={requestDeactivate}
                    onReactivate={handleReactivate}
                    onToggleFamilyVisibility={handleToggleFamilyVisibility}
                    onToggleExpand={() => toggleExpand(dim.id)}
                    expanded={expandedDims.has(dim.id)}
                    competencyCount={compCounts[dim.id]}
                  />
                  {expandedDims.has(dim.id) && profile?.school_id && (
                    <div className="mt-2">
                      <DimensionCompetencies
                        schoolId={profile.school_id}
                        dimensionId={dim.id}
                        canEdit={canEdit}
                        onCountChange={(n) =>
                          setCompCounts((p) => ({ ...p, [dim.id]: n }))
                        }
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* ---- Inactive dimensions ---- */}
      {inactiveDimensions.length > 0 && (
        <div className="border-t border-bg-muted pt-4">
          <button
            onClick={() => setShowInactive(!showInactive)}
            className="flex w-full items-center gap-2 text-sm font-medium text-text-muted transition-colors hover:text-text"
          >
            <ChevronDown
              className={clsx(
                'h-4 w-4 transition-transform',
                showInactive && 'rotate-180'
              )}
            />
            {inactiveDimensions.length} inactive dimension
            {inactiveDimensions.length !== 1 ? 's' : ''}
          </button>

          {showInactive && (
            <div className="mt-3 space-y-2">
              {inactiveDimensions.map((dim) => (
                <DimensionListItem
                  key={dim.id}
                  dimension={dim}
                  onEdit={handleEdit}
                  onDeactivate={requestDeactivate}
                  onReactivate={handleReactivate}
                  onToggleFamilyVisibility={handleToggleFamilyVisibility}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---- Standards Mapping ---- */}
      {profile?.school_id && (
        <div className="border-t border-bg-muted pt-6">
          <StandardsMappingSection
            schoolId={profile.school_id}
            dimensions={activeDimensions}
            canEdit={canEdit}
          />
        </div>
      )}

      {/* ---- Edit / Create Modal ---- */}
      <DimensionEditModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        dimension={editingDimension}
        schoolId={profile?.school_id ?? ''}
        onSaved={loadDimensions}
        existingCount={activeCount}
      />

      {/* ---- Confirm Dialog ---- */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false)
          setConfirmAction(null)
          setConfirmTarget(null)
        }}
        onConfirm={handleConfirm}
        title={confirmTitle}
        message={confirmMessage}
        confirmLabel={
          confirmAction === 'reset' ? 'Reset Dimensions' : 'Deactivate'
        }
        confirmVariant="danger"
        loading={confirmLoading}
      />
    </div>
  )
}
