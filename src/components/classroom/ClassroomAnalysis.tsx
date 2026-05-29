import { useState } from 'react'
import { Sparkles, Loader2, TrendingUp, Users, AlertTriangle, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import { useClassroomAnalysis } from '../../lib/classroom-analysis'
import type { Classroom, Dimension, Student } from '../../types/database'
import type { DimensionScore } from '../../lib/student-data'

interface Props {
  classroom: Classroom
  dimensions: Dimension[]
  /** Active learners only. */
  students: Student[]
  studentScoresMap: Map<string, DimensionScore[]>
}

export default function ClassroomAnalysis({
  classroom,
  dimensions,
  students,
  studentScoresMap,
}: Props) {
  const [open, setOpen] = useState(false)
  const { analysis, loading, error, cached, generatedAt, generate } = useClassroomAnalysis(
    classroom.id,
    classroom.school_id,
    classroom.name,
    classroom.grade_level,
    dimensions,
    students,
    studentScoresMap
  )

  function handleGenerate() {
    setOpen(true)
    generate()
  }

  return (
    <section className="glass-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 p-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-100">
            <Sparkles className="h-4 w-4 text-accent-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-text">AI Class Analysis</h2>
            <p className="text-xs text-text-muted">
              Trends, learner clusters for personalized learning, and outliers needing attention.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {analysis && (
            <button
              onClick={() => setOpen((v) => !v)}
              className="rounded-lg p-1.5 text-text-light transition-colors hover:bg-bg-muted hover:text-text"
              title={open ? 'Collapse' : 'Expand'}
            >
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
          <button
            onClick={handleGenerate}
            disabled={loading || students.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-accent-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-accent-600 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : analysis ? (
              <RefreshCw className="h-3.5 w-3.5" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {loading ? 'Analyzing…' : analysis ? 'Regenerate' : 'Generate Analysis'}
          </button>
        </div>
      </div>

      {/* Body */}
      {(open || loading || error) && (
        <div className="border-t border-bg-muted px-5 py-4">
          {error && (
            <div className="rounded-lg border border-alert-200 bg-alert-50 px-4 py-3 text-sm text-alert-700">
              {error}
            </div>
          )}

          {loading && !analysis && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-text-muted">
              <Loader2 className="h-5 w-5 animate-spin text-accent-500" />
              Analyzing {students.length} learner{students.length !== 1 ? 's' : ''}…
            </div>
          )}

          {analysis && !loading && (
            <div className="space-y-5">
              {/* Summary */}
              {analysis.summary && (
                <p className="text-sm leading-relaxed text-text">{analysis.summary}</p>
              )}

              {/* Trends */}
              {analysis.trends?.length > 0 && (
                <div>
                  <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-text-muted">
                    <TrendingUp className="h-3.5 w-3.5 text-primary-500" />
                    Trends
                  </h3>
                  <ul className="space-y-2">
                    {analysis.trends.map((t, i) => (
                      <li key={i} className="rounded-lg bg-bg-muted/40 px-3 py-2">
                        <p className="text-sm font-medium text-text">
                          {t.title}
                          {t.dimension_name && (
                            <span className="ml-2 rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-medium text-primary-700">
                              {t.dimension_name}
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-text-muted">{t.detail}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Clusters */}
              {analysis.clusters?.length > 0 && (
                <div>
                  <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-text-muted">
                    <Users className="h-3.5 w-3.5 text-accent-500" />
                    Learner Clusters
                  </h3>
                  <div className="space-y-2">
                    {analysis.clusters.map((c, i) => (
                      <div key={i} className="rounded-lg border border-accent-100 bg-accent-50/40 px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-accent-100 px-2 py-0.5 text-[11px] font-semibold text-accent-700">
                            {c.dimension_name}
                          </span>
                          {c.students.map((name, j) => (
                            <span
                              key={j}
                              className="rounded-full bg-bg-card px-2 py-0.5 text-[11px] font-medium text-text-muted"
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                        <p className="mt-1.5 text-xs text-text-muted">{c.rationale}</p>
                        <p className="mt-1 text-xs font-medium text-text">
                          Focus: <span className="font-normal text-text-muted">{c.suggested_focus}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Outliers */}
              {analysis.outliers?.length > 0 && (
                <div>
                  <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-text-muted">
                    <AlertTriangle className="h-3.5 w-3.5 text-caution-500" />
                    Outliers Needing Attention
                  </h3>
                  <ul className="space-y-2">
                    {analysis.outliers.map((o, i) => (
                      <li key={i} className="rounded-lg border border-caution-100 bg-caution-50/40 px-3 py-2.5">
                        <p className="text-sm font-medium text-text">{o.student_name}</p>
                        <p className="mt-0.5 text-xs text-text-muted">{o.concern}</p>
                        <p className="mt-1 text-xs font-medium text-text">
                          Action: <span className="font-normal text-text-muted">{o.recommended_action}</span>
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Footer meta */}
              <p className="text-[10px] text-text-light">
                {cached ? 'Cached result' : 'Freshly generated'} · AI-generated guidance — review with professional judgment.
                {generatedAt &&
                  ` · ${new Date(generatedAt).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}`}
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
