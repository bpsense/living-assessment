import { useState, useEffect, useCallback } from 'react'
import { clsx } from 'clsx'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../components/Toast'
import {
  fetchFrameworksWithCounts,
  deleteFramework,
  type FrameworkWithCounts,
} from '../../lib/competency-framework-data'
import UploadCompetencyFrameworkModal from '../../components/admin/UploadCompetencyFrameworkModal'
import SkillsLibrarySection from '../../components/admin/SkillsLibrarySection'
import {
  Plus,
  Trash2,
  FileSpreadsheet,
  Loader2,
  BookOpen,
  ChevronRight,
  Tag,
} from 'lucide-react'
import { Link } from 'react-router-dom'

type Tab = 'frameworks' | 'skills'

export default function CompetencyFrameworks() {
  const { profile } = useAuth()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<Tab>('frameworks')
  const [frameworks, setFrameworks] = useState<FrameworkWithCounts[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const loadFrameworks = useCallback(async () => {
    if (!profile?.school_id) return
    setLoading(true)
    try {
      const data = await fetchFrameworksWithCounts(profile.school_id)
      setFrameworks(data)
    } catch (err) {
      toast('Failed to load frameworks', 'error')
    } finally {
      setLoading(false)
    }
  }, [profile?.school_id, toast])

  useEffect(() => {
    loadFrameworks()
  }, [loadFrameworks])

  async function handleDelete(fw: FrameworkWithCounts) {
    if (!confirm(`Delete "${fw.name}" and all its competencies? This cannot be undone.`)) return

    setDeleting(fw.id)
    try {
      await deleteFramework(fw.id)
      toast('Framework deleted', 'success')
      loadFrameworks()
    } catch (err) {
      toast('Failed to delete framework', 'error')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text">Competency & Skills</h1>
        <p className="mt-1 text-sm text-text-muted">
          Manage competency frameworks and the skills library for assignments.
        </p>
      </div>

      {/* Tab bar */}
      <div className="mb-6 flex gap-1 rounded-lg bg-bg-muted p-1">
        <button
          onClick={() => setActiveTab('frameworks')}
          className={clsx(
            'flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'frameworks'
              ? 'bg-bg-card text-text shadow-sm'
              : 'text-text-muted hover:text-text'
          )}
        >
          <BookOpen className="h-4 w-4" />
          Competency Frameworks
        </button>
        <button
          onClick={() => setActiveTab('skills')}
          className={clsx(
            'flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'skills'
              ? 'bg-bg-card text-text shadow-sm'
              : 'text-text-muted hover:text-text'
          )}
        >
          <Tag className="h-4 w-4" />
          Skills Library
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'frameworks' && (
        <>
          {/* Framework header actions */}
          <div className="mb-4 flex justify-end">
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-600"
            >
              <Plus className="h-4 w-4" />
              Upload Framework
            </button>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-primary-400" />
            </div>
          )}

          {/* Empty state */}
          {!loading && frameworks.length === 0 && (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-bg-muted bg-bg-card px-6 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-50">
                <BookOpen className="h-7 w-7 text-primary-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text">No competency frameworks yet</p>
                <p className="mt-1 text-sm text-text-muted">
                  Upload a spreadsheet with your school's competencies to get started.
                </p>
              </div>
              <button
                onClick={() => setShowUpload(true)}
                className="flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-600"
              >
                <Plus className="h-4 w-4" />
                Upload Framework
              </button>
            </div>
          )}

          {/* Framework list */}
          {!loading && frameworks.length > 0 && (
            <div className="space-y-3">
              {frameworks.map((fw) => (
                <div
                  key={fw.id}
                  className="flex items-center gap-4 rounded-xl border border-bg-muted bg-bg-card px-4 py-4 transition-colors hover:border-primary-200"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-50">
                    <FileSpreadsheet className="h-5 w-5 text-primary-500" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-text">{fw.name}</p>
                      {fw.is_default && (
                        <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-medium text-primary-600">
                          Default
                        </span>
                      )}
                      {fw.version && (
                        <span className="rounded-full bg-bg-muted px-2 py-0.5 text-[10px] text-text-light">
                          v{fw.version}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {fw.domain_count} domain{fw.domain_count !== 1 ? 's' : ''} &middot;{' '}
                      {fw.competency_count} competenc{fw.competency_count !== 1 ? 'ies' : 'y'}
                      {fw.description && ` — ${fw.description}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      to={`/admin/competency-framework/${fw.id}`}
                      className="rounded-lg p-2 text-text-light transition-colors hover:bg-bg-muted hover:text-text"
                      title="View details"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                    <button
                      onClick={() => handleDelete(fw)}
                      disabled={deleting === fw.id}
                      className="rounded-lg p-2 text-text-light transition-colors hover:bg-alert-50 hover:text-alert-600 disabled:opacity-50"
                      title="Delete framework"
                    >
                      {deleting === fw.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Upload modal */}
          <UploadCompetencyFrameworkModal
            open={showUpload}
            onClose={() => setShowUpload(false)}
            onUploaded={loadFrameworks}
          />
        </>
      )}

      {activeTab === 'skills' && <SkillsLibrarySection />}
    </div>
  )
}
