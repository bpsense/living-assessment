import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  FileText,
  RefreshCw,
  Copy,
  Check,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react'
import { useStudentContext } from '../../lib/context-document'
import { useToast } from '../Toast'

// ============================================================
// Props
// ============================================================

interface Props {
  studentId: string
  schoolId: string
}

// ============================================================
// Component
// ============================================================

export default function StudentContextDoc({ studentId }: Props) {
  const { document: doc, loading, error, compile, isCompiling } = useStudentContext(studentId)
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleCompile() {
    try {
      await compile()
      toast('Context document compiled', 'success')
    } catch {
      toast('Failed to compile context', 'error')
    }
  }

  async function handleCopy() {
    if (!doc?.markdown) return
    try {
      await navigator.clipboard.writeText(doc.markdown)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast('Failed to copy', 'error')
    }
  }

  return (
    <section className="glass-card">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between p-5"
      >
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-indigo-500" />
          <h2 className="text-sm font-semibold text-text">Learner Context Document</h2>
          {doc && (
            <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600">
              ~{doc.token_estimate.toLocaleString()} tokens
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Compile button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleCompile()
            }}
            disabled={isCompiling}
            className="flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100 disabled:opacity-50"
            title={doc ? 'Recompile with latest data' : 'Generate context document'}
          >
            {isCompiling ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {doc ? 'Recompile' : 'Generate'}
          </button>

          {open ? (
            <ChevronUp className="h-5 w-5 text-text-muted" />
          ) : (
            <ChevronDown className="h-5 w-5 text-text-muted" />
          )}
        </div>
      </button>

      {/* Body */}
      {open && (
        <div className="border-t border-bg-muted px-5 pb-5 pt-4 space-y-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary-400" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 rounded-lg bg-alert-50 px-3 py-2 text-sm text-alert-600">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          ) : !doc ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-sm text-text-light">
                No context document compiled yet. Click "Generate" to create one from this learner's data.
              </p>
              <p className="text-xs text-text-light">
                The context document aggregates observations, competencies, teacher notes, family input, and school context into a single document used by the AI learning guide.
              </p>
            </div>
          ) : (
            <>
              {/* Meta info bar */}
              <div className="flex items-center justify-between text-[10px] text-text-light">
                <span>
                  Compiled {formatDistanceToNow(new Date(doc.compiled_at), { addSuffix: true })}
                </span>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 rounded px-2 py-0.5 text-text-muted hover:bg-bg-muted hover:text-text transition-colors"
                  title="Copy to clipboard"
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-success-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>

              {/* Rendered markdown — simple pre block */}
              <div className="max-h-[600px] overflow-y-auto rounded-lg border border-bg-muted bg-bg p-4">
                <pre className="whitespace-pre-wrap text-xs text-text font-mono leading-relaxed">
                  {doc.markdown}
                </pre>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  )
}
