import { useState } from 'react'
import { clsx } from 'clsx'
import {
  BookOpen,
  Upload,
  Loader2,
  AlertCircle,
  Trash2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useToast } from '../components/Toast'
import { useStandardsManager } from '../lib/standards-data'
import UploadStandardsModal from '../components/admin/UploadStandardsModal'
import ConfirmDialog from '../components/ConfirmDialog'
import type { Standard } from '../types/database'
import type { StandardsFrameworkWithStandards } from '../lib/school-data'

// ============================================================
// Build tree from flat standards array
// ============================================================

interface StandardTreeNode extends Standard {
  children: StandardTreeNode[]
}

function buildTree(standards: Standard[]): StandardTreeNode[] {
  const byParent = new Map<string | null, Standard[]>()
  for (const std of standards) {
    const key = std.parent_id ?? '__root__'
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push(std)
  }

  function getChildren(parentId: string | null): StandardTreeNode[] {
    const key = parentId ?? '__root__'
    return (byParent.get(key) ?? [])
      .sort((a, b) => a.display_order - b.display_order)
      .map((std) => ({
        ...std,
        children: getChildren(std.id),
      }))
  }

  return getChildren(null)
}

// ============================================================
// Recursive tree renderer
// ============================================================

function StandardsTree({
  nodes,
  depth = 0,
}: {
  nodes: StandardTreeNode[]
  depth?: number
}) {
  return (
    <>
      {nodes.map((node) => (
        <div key={node.id}>
          <div
            className="flex items-start gap-1.5 py-1"
            style={{ paddingLeft: `${depth * 20}px` }}
          >
            {node.children.length > 0 ? (
              <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-400" />
            ) : (
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-bg-muted" />
            )}
            <span className="text-xs font-semibold text-primary-700">
              {node.code}
            </span>
            <span className="text-xs text-text-muted">{node.description}</span>
            {node.grade_level && (
              <span className="shrink-0 rounded bg-bg-muted px-1.5 py-0.5 text-[10px] text-text-light">
                {node.grade_level}
              </span>
            )}
          </div>
          {node.children.length > 0 && (
            <StandardsTree nodes={node.children} depth={depth + 1} />
          )}
        </div>
      ))}
    </>
  )
}

// ============================================================
// Page component
// ============================================================

export default function Standards() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const {
    frameworks,
    loading,
    error,
    reload,
    uploadFramework,
    deleteFramework,
  } = useStandardsManager(profile?.school_id)

  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deletingFw, setDeletingFw] =
    useState<StandardsFrameworkWithStandards | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)

  // ── Toggle expand ──────────────────────────────────────

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // ── Delete ─────────────────────────────────────────────

  function handleDeleteClick(fw: StandardsFrameworkWithStandards) {
    setDeletingFw(fw)
    setConfirmOpen(true)
  }

  async function handleDeleteConfirm() {
    if (!deletingFw) return
    setConfirmLoading(true)

    try {
      await deleteFramework(deletingFw.id)
      toast('Framework deleted', 'success')
    } catch (err) {
      toast(
        err instanceof Error ? err.message : 'Failed to delete framework',
        'error'
      )
    } finally {
      setConfirmLoading(false)
      setConfirmOpen(false)
      setDeletingFw(null)
    }
  }

  // ── Loading ────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary-400" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Standards</h1>
          <p className="mt-1 text-sm text-text-muted">
            Manage standards frameworks for student reports. These appear in
            the framework dropdown when exporting a learner profile.
          </p>
        </div>
        <button
          onClick={() => setUploadModalOpen(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-600"
        >
          <Upload className="h-4 w-4" />
          Upload Framework
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-alert-200 bg-alert-50 px-4 py-3 text-sm text-alert-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Empty state */}
      {frameworks.length === 0 && !error && (
        <div className="rounded-xl border border-dashed border-bg-muted py-12 text-center">
          <BookOpen className="mx-auto h-10 w-10 text-text-light" />
          <p className="mt-3 text-sm text-text-muted">
            No standards frameworks uploaded yet.
          </p>
          <button
            onClick={() => setUploadModalOpen(true)}
            className="mt-2 text-sm font-medium text-primary-500 hover:underline"
          >
            Upload your first framework
          </button>
        </div>
      )}

      {/* Framework cards */}
      {frameworks.length > 0 && (
        <div className="space-y-3">
          {frameworks.map((fw) => {
            const isExpanded = expandedIds.has(fw.id)
            const tree = isExpanded ? buildTree(fw.standards) : []

            return (
              <div
                key={fw.id}
                className="overflow-hidden rounded-xl border border-bg-muted bg-bg-card shadow-sm"
              >
                {/* Card header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Expand button */}
                  <button
                    onClick={() => toggleExpand(fw.id)}
                    className="rounded-lg p-1 text-text-light transition-colors hover:bg-bg-muted hover:text-text"
                  >
                    <ChevronDown
                      className={clsx(
                        'h-4 w-4 transition-transform',
                        isExpanded ? 'rotate-0' : '-rotate-90'
                      )}
                    />
                  </button>

                  {/* Framework info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-text">
                        {fw.name}
                      </span>
                      {fw.version && (
                        <span className="rounded-full bg-bg-muted px-2 py-0.5 text-[10px] font-medium text-text-light">
                          v{fw.version}
                        </span>
                      )}
                    </div>
                    {fw.description && (
                      <p className="mt-0.5 truncate text-xs text-text-muted">
                        {fw.description}
                      </p>
                    )}
                  </div>

                  {/* Standard count */}
                  <span className="shrink-0 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700">
                    {fw.standards.length} standard
                    {fw.standards.length !== 1 ? 's' : ''}
                  </span>

                  {/* Delete */}
                  <button
                    onClick={() => handleDeleteClick(fw)}
                    title="Delete framework"
                    className="shrink-0 rounded-lg p-1.5 text-text-light transition-colors hover:bg-alert-50 hover:text-alert-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Expanded body */}
                {isExpanded && (
                  <div className="border-t border-bg-muted px-4 py-3">
                    {fw.standards.length === 0 ? (
                      <p className="py-4 text-center text-xs text-text-light">
                        No standards in this framework.
                      </p>
                    ) : (
                      <div className="max-h-96 overflow-y-auto">
                        <StandardsTree nodes={tree} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Upload modal */}
      <UploadStandardsModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onUploaded={reload}
        uploadFramework={uploadFramework}
      />

      {/* Confirm delete dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false)
          setDeletingFw(null)
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Framework"
        message={
          deletingFw
            ? `This will permanently delete "${deletingFw.name}" and all ${deletingFw.standards.length} standard${deletingFw.standards.length !== 1 ? 's' : ''} within it. Any dimension-standard mappings will also be removed. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={confirmLoading}
      />
    </div>
  )
}
