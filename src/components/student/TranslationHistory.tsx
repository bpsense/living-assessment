import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import {
  Languages,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  FileText,
} from 'lucide-react'
import { clsx } from 'clsx'
import { fetchTranslationHistory } from '../../lib/translation-data'
import type { TranslationRecordWithDetails } from '../../types/database'

interface TranslationHistoryProps {
  studentId: string
}

export default function TranslationHistory({ studentId }: TranslationHistoryProps) {
  const navigate = useNavigate()
  const [records, setRecords] = useState<TranslationRecordWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(true)

  useEffect(() => {
    fetchTranslationHistory(studentId)
      .then(setRecords)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [studentId])

  if (loading) return null
  // Don't render section if no translations exist
  if (records.length === 0) return null

  return (
    <section>
      <button
        onClick={() => setExpanded(!expanded)}
        className="mb-3 flex w-full items-center gap-2 text-left"
      >
        <Languages className="h-5 w-5 text-primary-500" />
        <h2 className="text-base font-bold text-text">Translation History</h2>
        <span className="rounded-full bg-bg-muted px-2 py-0.5 text-xs font-medium text-text-muted">
          {records.length}
        </span>
        <span className="ml-auto">
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-text-light" />
          ) : (
            <ChevronDown className="h-4 w-4 text-text-light" />
          )}
        </span>
      </button>

      {expanded && (
        <div className="space-y-2">
          {records.map((record) => (
            <div
              key={record.id}
              className="flex items-center gap-3 rounded-lg border border-bg-muted bg-bg-card p-3"
            >
              <div
                className={clsx(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                  record.reviewed ? 'bg-success-100' : 'bg-caution-100'
                )}
              >
                {record.reviewed ? (
                  <CheckCircle2 className="h-4 w-4 text-success-600" />
                ) : (
                  <Clock className="h-4 w-4 text-caution-600" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text">
                  {record.framework?.name || 'Unknown Framework'}
                </p>
                <p className="text-xs text-text-muted">
                  {format(new Date(record.created_at), 'MMM d, yyyy')}
                  {record.translator_name && ` by ${record.translator_name}`}
                  {record.reviewed && record.reviewer_name && (
                    <span className="ml-1 text-success-600">
                      — Reviewed by {record.reviewer_name}
                    </span>
                  )}
                </p>
              </div>

              <span
                className={clsx(
                  'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                  record.reviewed
                    ? 'bg-success-100 text-success-700'
                    : 'bg-caution-100 text-caution-700'
                )}
              >
                {record.reviewed ? 'Reviewed' : 'Pending'}
              </span>
            </div>
          ))}

          <button
            onClick={() => navigate(`/translate?student=${studentId}`)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-primary-300 py-2.5 text-sm font-medium text-primary-600 transition-colors hover:bg-primary-50"
          >
            <FileText className="h-4 w-4" />
            New Translation
          </button>
        </div>
      )}
    </section>
  )
}
