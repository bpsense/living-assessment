import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../Toast'
import ConfirmDialog from '../ConfirmDialog'
import CompetencyEditModal from './CompetencyEditModal'
import type { Competency } from '../../types/database'

interface Props {
  schoolId: string
  dimensionId: string
  canEdit: boolean
  /** Bubble the competency count up so the parent can show a badge. */
  onCountChange?: (count: number) => void
}

export default function DimensionCompetencies({
  schoolId,
  dimensionId,
  canEdit,
  onCountChange,
}: Props) {
  const { toast } = useToast()
  const [competencies, setCompetencies] = useState<Competency[]>([])
  const [loading, setLoading] = useState(true)

  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<Competency | null>(null)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Competency | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('competencies')
      .select('*')
      .eq('school_id', schoolId)
      .eq('dimension_id', dimensionId)
      .order('display_order')
      .order('name')
    const rows = (data ?? []) as Competency[]
    setCompetencies(rows)
    setLoading(false)
    onCountChange?.(rows.length)
  }, [schoolId, dimensionId, onCountChange])

  useEffect(() => {
    load()
  }, [load])

  // Group by standard_label, preserving first-seen order.
  const groups: { label: string; items: Competency[] }[] = []
  for (const c of competencies) {
    const label = c.standard_label ?? 'Other'
    let g = groups.find((x) => x.label === label)
    if (!g) {
      g = { label, items: [] }
      groups.push(g)
    }
    g.items.push(c)
  }

  const standardLabels = Array.from(
    new Set(competencies.map((c) => c.standard_label).filter((s): s is string => !!s))
  )
  const nextOrder = competencies.reduce((m, c) => Math.max(m, c.display_order ?? 0), 0) + 1

  function handleAdd() {
    setEditing(null)
    setEditOpen(true)
  }
  function handleEdit(c: Competency) {
    setEditing(c)
    setEditOpen(true)
  }
  function requestDelete(c: Competency) {
    setDeleteTarget(c)
    setConfirmOpen(true)
  }

  async function executeDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await supabase.from('competencies').delete().eq('id', deleteTarget.id)
    setDeleting(false)
    setConfirmOpen(false)
    if (error) {
      toast(`Failed to delete: ${error.message}`, 'error')
      return
    }
    toast(`"${deleteTarget.name}" deleted`, 'success')
    setDeleteTarget(null)
    load()
  }

  function ageLabel(c: Competency): string {
    if (c.age_band_start == null || c.age_band_end == null) return ''
    return `ages ${c.age_band_start}–${c.age_band_end}`
  }

  return (
    <div className="ml-11 mr-1 rounded-xl border border-bg-muted bg-bg/60 px-3 py-3">
      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-primary-400" />
        </div>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-light">
              {competencies.length} competenc{competencies.length === 1 ? 'y' : 'ies'}
            </span>
            {canEdit && (
              <button
                onClick={handleAdd}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary-600 transition-colors hover:bg-primary-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Add competency
              </button>
            )}
          </div>

          {competencies.length === 0 ? (
            <p className="py-3 text-center text-xs text-text-muted">
              No competencies yet.{canEdit && ' Add the first one.'}
            </p>
          ) : (
            <div className="space-y-3">
              {groups.map((g) => (
                <div key={g.label}>
                  <p className="mb-1 text-[11px] font-semibold text-text-muted">{g.label}</p>
                  <div className="space-y-1">
                    {g.items.map((c) => (
                      <div
                        key={c.id}
                        className="group flex items-center gap-2 rounded-lg bg-bg-card px-3 py-1.5"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm text-text">{c.name}</span>
                        {ageLabel(c) && (
                          <span className="shrink-0 rounded-full bg-bg-muted px-2 py-0.5 text-[10px] font-medium text-text-muted">
                            {ageLabel(c)}
                          </span>
                        )}
                        {canEdit && (
                          <>
                            <button
                              onClick={() => handleEdit(c)}
                              className="shrink-0 rounded p-1 text-text-light transition-colors hover:bg-bg-muted hover:text-text"
                              title="Edit competency"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => requestDelete(c)}
                              className="shrink-0 rounded p-1 text-text-light transition-colors hover:bg-alert-50 hover:text-alert-500"
                              title="Delete competency"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <CompetencyEditModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        competency={editing}
        schoolId={schoolId}
        dimensionId={dimensionId}
        standardLabels={standardLabels}
        nextOrder={nextOrder}
        onSaved={load}
      />

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false)
          setDeleteTarget(null)
        }}
        onConfirm={executeDelete}
        title={`Delete "${deleteTarget?.name}"?`}
        message="This permanently removes the competency from this dimension. Observations already linked to it will keep their dimension but lose the competency link. This cannot be undone."
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deleting}
      />
    </div>
  )
}
