import { useState, useEffect, useRef } from 'react'
import { clsx } from 'clsx'
import {
  X,
  Loader2,
  Upload,
  FileJson,
  Download,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
} from 'lucide-react'
import { useToast } from '../Toast'
import {
  validateUploadPayload,
  countStandards,
} from '../../lib/standards-data'
import type {
  StandardsUploadPayload,
  StandardUploadNode,
} from '../../lib/standards-data'

// ============================================================
// Props
// ============================================================

interface Props {
  open: boolean
  onClose: () => void
  onUploaded: () => void
  uploadFramework: (payload: StandardsUploadPayload) => Promise<string>
  /** When true, shows "All Schools" banner and adjusts messaging */
  isGlobal?: boolean
}

type UploadStep = 'upload' | 'preview' | 'uploading' | 'complete'

// ============================================================
// Template generator
// ============================================================

function downloadTemplate() {
  const template: StandardsUploadPayload = {
    framework: {
      name: 'Example Standards Framework',
      description: 'Description of the standards framework',
      version: '1.0',
    },
    standards: [
      {
        code: 'ELA.1',
        description: 'Reading and Literature',
        grade_level: '1',
        display_order: 1,
        children: [
          {
            code: 'ELA.1.1',
            description: 'Identify main ideas in a text',
            grade_level: '1',
            display_order: 1,
          },
          {
            code: 'ELA.1.2',
            description: 'Retell key details from a story',
            grade_level: '1',
            display_order: 2,
          },
        ],
      },
      {
        code: 'MATH.1',
        description: 'Number Sense and Operations',
        grade_level: '1',
        display_order: 2,
      },
    ],
  }

  const blob = new Blob([JSON.stringify(template, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'standards_template.json'
  a.click()
  URL.revokeObjectURL(url)
}

// ============================================================
// Tree preview renderer
// ============================================================

function TreePreview({
  nodes,
  depth = 0,
  limit = 30,
}: {
  nodes: StandardUploadNode[]
  depth?: number
  limit?: number
}) {
  let count = 0

  function renderNodes(
    items: StandardUploadNode[],
    d: number
  ): React.ReactNode[] {
    const elements: React.ReactNode[] = []
    for (let i = 0; i < items.length; i++) {
      if (count >= limit) break
      count++
      const node = items[i]
      elements.push(
        <div
          key={`${d}-${i}`}
          className="flex items-start gap-1.5 py-0.5"
          style={{ paddingLeft: `${d * 16}px` }}
        >
          <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-text-light" />
          <span className="text-xs font-semibold text-primary-700">
            {node.code}
          </span>
          <span className="truncate text-xs text-text-muted">
            {node.description}
          </span>
          {node.grade_level && (
            <span className="shrink-0 rounded bg-bg-muted px-1.5 py-0.5 text-[10px] text-text-light">
              {node.grade_level}
            </span>
          )}
        </div>
      )
      if (node.children && node.children.length > 0 && count < limit) {
        elements.push(...renderNodes(node.children, d + 1))
      }
    }
    return elements
  }

  const rendered = renderNodes(nodes, depth)

  return <div className="space-y-0.5">{rendered}</div>
}

// ============================================================
// Component
// ============================================================

export default function UploadStandardsModal({
  open,
  onClose,
  onUploaded,
  uploadFramework,
  isGlobal = false,
}: Props) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<UploadStep>('upload')
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState('')
  const [payload, setPayload] = useState<StandardsUploadPayload | null>(null)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [standardCount, setStandardCount] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep('upload')
      setDragOver(false)
      setFileName('')
      setPayload(null)
      setValidationErrors([])
      setStandardCount(0)
      setUploadError(null)
    }
  }, [open])

  // Escape to close
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && step !== 'uploading') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose, step])

  // Body scroll lock
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  // ── File handling ──────────────────────────────────────

  function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.json')) {
      toast('Please upload a JSON file', 'error')
      return
    }

    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string)
        const result = validateUploadPayload(parsed)

        if (!result.valid) {
          setValidationErrors(result.errors)
          setPayload(null)
          setStep('preview')
          return
        }

        const p = parsed as StandardsUploadPayload
        setPayload(p)
        setValidationErrors([])
        setStandardCount(countStandards(p.standards))
        setStep('preview')
      } catch {
        toast('Invalid JSON file — could not parse', 'error')
      }
    }
    reader.readAsText(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(true)
  }

  function handleDragLeave() {
    setDragOver(false)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0])
    }
  }

  // ── Upload ─────────────────────────────────────────────

  async function handleUpload() {
    if (!payload) return
    setStep('uploading')
    setUploadError(null)

    try {
      await uploadFramework(payload)
      setStep('complete')
      toast('Standards framework uploaded', 'success')
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Failed to upload framework'
      )
      setStep('preview')
    }
  }

  // ── Done ───────────────────────────────────────────────

  function handleDone() {
    onUploaded()
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-text/40 backdrop-blur-sm"
        onClick={step === 'uploading' ? undefined : onClose}
      />

      {/* Panel */}
      <div className="relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl bg-bg-card shadow-2xl sm:max-w-lg sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-bg-muted px-5 py-4">
          <h2 className="text-base font-bold text-text">
            Upload Standards Framework
          </h2>
          <button
            onClick={onClose}
            disabled={step === 'uploading'}
            className="rounded-lg p-1.5 text-text-light transition-colors hover:bg-bg-muted hover:text-text disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* ── Upload step ───────────────────────────── */}
          {step === 'upload' && (
            <div className="space-y-4">
              {isGlobal && (
                <div className="flex items-start gap-2 rounded-lg bg-primary-50 px-3 py-2.5">
                  <span className="mt-0.5 text-xs text-primary-700">
                    This framework will be distributed to <span className="font-semibold">all schools</span>, including any new schools added later.
                  </span>
                </div>
              )}
              <p className="text-sm text-text-muted">
                Upload a JSON file containing a standards framework and its
                standards.{' '}
                {isGlobal
                  ? 'It will be copied to every school automatically.'
                  : 'The framework will appear in the report export dropdown.'}
              </p>

              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={clsx(
                  'flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed px-4 py-10 transition-colors',
                  dragOver
                    ? 'border-primary-400 bg-primary-50'
                    : 'border-bg-muted hover:border-primary-300 hover:bg-bg'
                )}
              >
                <div
                  className={clsx(
                    'flex h-12 w-12 items-center justify-center rounded-full',
                    dragOver ? 'bg-primary-100' : 'bg-bg-muted'
                  )}
                >
                  <Upload
                    className={clsx(
                      'h-6 w-6',
                      dragOver ? 'text-primary-600' : 'text-text-light'
                    )}
                  />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-text">
                    Drop a JSON file here or{' '}
                    <span className="text-primary-500">browse</span>
                  </p>
                  <p className="mt-1 text-xs text-text-light">
                    .json files only
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileInput}
                  className="hidden"
                />
              </div>

              {/* Template download */}
              <button
                onClick={downloadTemplate}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-bg-muted px-4 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-bg-muted hover:text-text"
              >
                <Download className="h-4 w-4" />
                Download template
              </button>
            </div>
          )}

          {/* ── Preview step ──────────────────────────── */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* Validation errors */}
              {validationErrors.length > 0 && (
                <div className="rounded-lg border border-alert-200 bg-alert-50 p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-alert-700">
                    <AlertCircle className="h-4 w-4" />
                    Validation errors in {fileName}
                  </div>
                  <ul className="space-y-1">
                    {validationErrors.map((err, i) => (
                      <li
                        key={i}
                        className="text-xs leading-relaxed text-alert-600"
                      >
                        &bull; {err}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => {
                      setStep('upload')
                      setValidationErrors([])
                      setPayload(null)
                    }}
                    className="mt-3 text-xs font-medium text-alert-700 underline"
                  >
                    Choose a different file
                  </button>
                </div>
              )}

              {/* Upload error */}
              {uploadError && (
                <div className="rounded-lg bg-alert-50 px-3 py-2 text-sm text-alert-600">
                  {uploadError}
                </div>
              )}

              {/* Valid payload preview */}
              {payload && validationErrors.length === 0 && (
                <>
                  {/* File info */}
                  <div className="flex items-center gap-3 rounded-lg border border-bg-muted bg-bg p-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50">
                      <FileJson className="h-5 w-5 text-primary-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text">
                        {fileName}
                      </p>
                      <p className="text-xs text-text-light">
                        {standardCount} standard
                        {standardCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  {/* Framework metadata */}
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wide text-text-light">
                        Framework
                      </span>
                      <p className="text-sm font-medium text-text">
                        {payload.framework.name}
                        {payload.framework.version && (
                          <span className="ml-2 rounded-full bg-bg-muted px-2 py-0.5 text-[10px] text-text-light">
                            v{payload.framework.version}
                          </span>
                        )}
                      </p>
                      {payload.framework.description && (
                        <p className="mt-0.5 text-xs text-text-muted">
                          {payload.framework.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Standards tree preview */}
                  <div>
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-light">
                      Standards preview
                    </span>
                    <div className="max-h-60 overflow-y-auto rounded-lg border border-bg-muted bg-bg p-3">
                      <TreePreview nodes={payload.standards} />
                      {standardCount > 30 && (
                        <p className="mt-2 text-[10px] text-text-light">
                          Showing first 30 of {standardCount} standards...
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Uploading step ────────────────────────── */}
          {step === 'uploading' && (
            <div className="flex flex-col items-center gap-3 py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary-400" />
              <p className="text-sm text-text-muted">
                {isGlobal
                  ? `Uploading and distributing ${standardCount} standards to all schools...`
                  : `Uploading ${standardCount} standards...`}
              </p>
            </div>
          )}

          {/* ── Complete step ─────────────────────────── */}
          {step === 'complete' && payload && (
            <div className="flex flex-col items-center gap-3 py-10">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success-50">
                <CheckCircle2 className="h-7 w-7 text-success-600" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-text">
                  {isGlobal
                    ? 'Framework distributed to all schools'
                    : 'Framework uploaded successfully'}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  {payload.framework.name} — {standardCount} standard
                  {standardCount !== 1 ? 's' : ''} added
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-bg-muted px-5 py-4">
          {step === 'upload' && (
            <button
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-bg-muted"
            >
              Cancel
            </button>
          )}

          {step === 'preview' && (
            <>
              <button
                onClick={() => {
                  setStep('upload')
                  setValidationErrors([])
                  setPayload(null)
                  setUploadError(null)
                }}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-bg-muted"
              >
                Back
              </button>
              <button
                onClick={handleUpload}
                disabled={!payload || validationErrors.length > 0}
                className="flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Upload className="h-4 w-4" />
                Upload Framework
              </button>
            </>
          )}

          {step === 'complete' && (
            <button
              onClick={handleDone}
              className="rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-600"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
