import { useState, useEffect } from 'react'
import { clsx } from 'clsx'
import {
  BookOpen,
  Upload,
  Loader2,
  AlertCircle,
  Trash2,
  ChevronDown,
  ChevronRight,
  Globe,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useToast } from '../components/Toast'
import { useStandardsManager } from '../lib/standards-data'
import type { GlobalFrameworkWithStandards } from '../lib/standards-data'
import UploadStandardsModal from '../components/admin/UploadStandardsModal'
import ConfirmDialog from '../components/ConfirmDialog'
import { supabase } from '../lib/supabase'
import type { Standard, GlobalStandard } from '../types/database'
import type { StandardsFrameworkWithStandards } from '../lib/school-data'

// ============================================================
// Build tree from flat standards array (school-level)
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

// Build tree from global standards (no school_id)
interface GlobalTreeNode extends GlobalStandard {
  children: GlobalTreeNode[]
}

function buildGlobalTree(standards: GlobalStandard[]): GlobalTreeNode[] {
  const byParent = new Map<string | null, GlobalStandard[]>()
  for (const std of standards) {
    const key = std.parent_id ?? '__root__'
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push(std)
  }

  function getChildren(parentId: string | null): GlobalTreeNode[] {
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
// Recursive tree renderer (works for both school + global nodes)
// ============================================================

function StandardsTree({
  nodes,
  depth = 0,
}: {
  nodes: (StandardTreeNode | GlobalTreeNode)[]
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
// View mode type
// ============================================================

type ViewMode = 'all_schools' | 'school'

// ============================================================
// Page component
// ============================================================

export default function Standards() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const {
    frameworks,
    globalFrameworks,
    loading,
    error,
    reload,
    uploadFramework,
    deleteFramework,
    uploadGlobalFramework,
    deleteGlobalFramework,
  } = useStandardsManager(profile?.school_id)

  const [viewMode, setViewMode] = useState<ViewMode>('all_schools')
  const [schoolName, setSchoolName] = useState<string>('')
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deletingFw, setDeletingFw] =
    useState<StandardsFrameworkWithStandards | null>(null)
  const [deletingGlobalFw, setDeletingGlobalFw] =
    useState<GlobalFrameworkWithStandards | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)

  // Fetch school name
  useEffect(() => {
    if (!profile?.school_id) return
    supabase
      .from('schools')
      .select('name')
      .eq('id', profile.school_id)
      .single()
      .then(({ data }) => {
        if (data?.name) setSchoolName(data.name)
      })
  }, [profile?.school_id])

  const isGlobal = viewMode === 'all_schools'

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

  // ── Delete (school-specific) ────────────────────────────

  function handleDeleteClick(fw: StandardsFrameworkWithStandards) {
    setDeletingFw(fw)
    setDeletingGlobalFw(null)
    setConfirmOpen(true)
  }

  // ── Delete (global) ─────────────────────────────────────

  function handleDeleteGlobalClick(gfw: GlobalFrameworkWithStandards) {
    setDeletingGlobalFw(gfw)
    setDeletingFw(null)
    setConfirmOpen(true)
  }

  async function handleDeleteConfirm() {
    setConfirmLoading(true)

    try {
      if (deletingGlobalFw) {
        await deleteGlobalFramework(deletingGlobalFw.id)
        toast('Global framework deleted', 'success')
      } else if (deletingFw) {
        await deleteFramework(deletingFw.id)
        toast('Framework deleted', 'success')
      }
    } catch (err) {
      toast(
        err instanceof Error ? err.message : 'Failed to delete framework',
        'error'
      )
    } finally {
      setConfirmLoading(false)
      setConfirmOpen(false)
      setDeletingFw(null)
      setDeletingGlobalFw(null)
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

  // ── Determine which list to render ────────────────────

  const displayFrameworks = isGlobal ? [] : frameworks
  const displayGlobalFrameworks = isGlobal ? globalFrameworks : []
  const isEmpty = isGlobal
    ? globalFrameworks.length === 0
    : frameworks.length === 0

  // ── Confirm dialog text ───────────────────────────────

  const confirmTitle = deletingGlobalFw
    ? 'Delete Global Framework'
    : 'Delete Framework'

  const confirmMessage = deletingGlobalFw
    ? `This will delete the global template "${deletingGlobalFw.name}" and its ${deletingGlobalFw.standards.length} standard${deletingGlobalFw.standards.length !== 1 ? 's' : ''}. Existing school copies will NOT be removed. This cannot be undone.`
    : deletingFw
      ? `This will permanently delete "${deletingFw.name}" and all ${deletingFw.standards.length} standard${deletingFw.standards.length !== 1 ? 's' : ''} within it. Any dimension-standard mappings will also be removed. This cannot be undone.`
      : ''

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Standards</h1>
          <p className="mt-1 text-sm text-text-muted">
            {isGlobal
              ? 'Manage global standards that are distributed to all schools.'
              : 'Manage standards frameworks for student reports.'}
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

      {/* View mode selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-text-muted">View:</span>
        <div className="flex rounded-lg border border-bg-muted bg-bg-card p-0.5">
          <button
            onClick={() => setViewMode('all_schools')}
            className={clsx(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              isGlobal
                ? 'bg-primary-500 text-white shadow-sm'
                : 'text-text-muted hover:text-text'
            )}
          >
            <Globe className="h-3.5 w-3.5" />
            All Schools
          </button>
          <button
            onClick={() => setViewMode('school')}
            className={clsx(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              !isGlobal
                ? 'bg-primary-500 text-white shadow-sm'
                : 'text-text-muted hover:text-text'
            )}
          >
            {schoolName || 'My School'}
          </button>
        </div>
      </div>

      {/* Info banner for global mode */}
      {isGlobal && (
        <div className="flex items-start gap-2 rounded-xl bg-primary-50 px-4 py-3">
          <Globe className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" />
          <p className="text-xs leading-relaxed text-primary-700">
            Frameworks uploaded here are automatically distributed to{' '}
            <span className="font-semibold">all schools</span>, including any
            new schools added later. Deleting a global template does not remove
            copies already distributed to individual schools.
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-alert-200 bg-alert-50 px-4 py-3 text-sm text-alert-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Empty state */}
      {isEmpty && !error && (
        <div className="rounded-xl border border-dashed border-bg-muted py-12 text-center">
          <BookOpen className="mx-auto h-10 w-10 text-text-light" />
          <p className="mt-3 text-sm text-text-muted">
            {isGlobal
              ? 'No global standards frameworks uploaded yet.'
              : 'No standards frameworks uploaded yet.'}
          </p>
          <button
            onClick={() => setUploadModalOpen(true)}
            className="mt-2 text-sm font-medium text-primary-500 hover:underline"
          >
            Upload your first framework
          </button>
        </div>
      )}

      {/* Global framework cards */}
      {displayGlobalFrameworks.length > 0 && (
        <div className="space-y-3">
          {displayGlobalFrameworks.map((gfw) => {
            const isExpanded = expandedIds.has(gfw.id)
            const tree = isExpanded ? buildGlobalTree(gfw.standards) : []

            return (
              <div
                key={gfw.id}
                className="overflow-hidden rounded-xl border border-bg-muted bg-bg-card shadow-sm"
              >
                {/* Card header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Expand button */}
                  <button
                    onClick={() => toggleExpand(gfw.id)}
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
                        {gfw.name}
                      </span>
                      {gfw.version && (
                        <span className="rounded-full bg-bg-muted px-2 py-0.5 text-[10px] font-medium text-text-light">
                          v{gfw.version}
                        </span>
                      )}
                      <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-medium text-primary-600">
                        Global
                      </span>
                    </div>
                    {gfw.description && (
                      <p className="mt-0.5 truncate text-xs text-text-muted">
                        {gfw.description}
                      </p>
                    )}
                  </div>

                  {/* Standard count */}
                  <span className="shrink-0 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700">
                    {gfw.standards.length} standard
                    {gfw.standards.length !== 1 ? 's' : ''}
                  </span>

                  {/* Delete */}
                  <button
                    onClick={() => handleDeleteGlobalClick(gfw)}
                    title="Delete global framework"
                    className="shrink-0 rounded-lg p-1.5 text-text-light transition-colors hover:bg-alert-50 hover:text-alert-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Expanded body */}
                {isExpanded && (
                  <div className="border-t border-bg-muted px-4 py-3">
                    {gfw.standards.length === 0 ? (
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

      {/* School-specific framework cards */}
      {displayFrameworks.length > 0 && (
        <div className="space-y-3">
          {displayFrameworks.map((fw) => {
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
                      {fw.global_framework_id && (
                        <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-medium text-primary-600">
                          From All Schools
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
        uploadFramework={isGlobal ? uploadGlobalFramework : uploadFramework}
        isGlobal={isGlobal}
      />

      {/* Confirm delete dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false)
          setDeletingFw(null)
          setDeletingGlobalFw(null)
        }}
        onConfirm={handleDeleteConfirm}
        title={confirmTitle}
        message={confirmMessage}
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={confirmLoading}
      />
    </div>
  )
}
