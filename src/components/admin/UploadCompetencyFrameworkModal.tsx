import { useState, useEffect, useRef } from 'react'
import { clsx } from 'clsx'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import {
  X,
  Loader2,
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ChevronDown,
} from 'lucide-react'
import { useToast } from '../Toast'
import { useAuth } from '../../lib/auth'
import {
  parseMultiSheetData,
  parseSingleSheetData,
  validateParsedFramework,
  saveFrameworkToDb,
  type ParsedFramework,
  type ParsedDomain,
  type ValidationResult,
} from '../../lib/competency-framework-data'
import { triggerCompetencyMapping } from '../../lib/ai-mapping'

// ============================================================
// Props
// ============================================================

interface Props {
  open: boolean
  onClose: () => void
  onUploaded: () => void
}

type UploadStep = 'upload' | 'preview' | 'uploading' | 'complete'

// ============================================================
// Template generator
// ============================================================

function downloadTemplate() {
  const headers = [
    'Domain', 'Sub-domain', 'Standard (Competency)', 'Code', 'Objective',
    'Step E1', 'Step E2', 'Step E3', 'Step E4', 'Step E5', 'Step E6',
    'Step 1', 'Step 2', 'Step 3', 'Step 4', 'Step 5', 'Step 6',
    'Step 7', 'Step 8', 'Step 9', 'Step 10',
  ]
  const sampleRow = [
    '1. Intrapersonal', '1.1 Inner Self & Identity', 'Self-Awareness', 'Intra111',
    "Understanding one's unique traits, preferences, and sense of self.",
    'N/A', 'Shows early body-awareness.', 'Recognizes personal preferences.',
    'Identifies simple personal traits.', 'Names personal characteristics.',
    'Notices what feels "me / not me".', 'Describes self with multiple attributes.',
    'Recognizes personal patterns.', 'Reflects on changes in self over time.',
    'Understands identity has layers.', 'Connects identity with belonging.',
    'Recognizes inner contradictions.', 'Expresses coherent evolving self.',
    'Reflects on identity in contexts.', 'Understands identity as dynamic.',
    'Embodies mature personal identity.',
  ]

  const csv = [headers.join(','), sampleRow.map((v) => `"${v}"`).join(',')].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'competency_framework_template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

// ============================================================
// Domain preview component
// ============================================================

function DomainPreview({ domain, index }: { domain: ParsedDomain; index: number }) {
  const [expanded, setExpanded] = useState(index === 0)
  const totalComps = domain.subdomains.reduce((sum, sd) => sum + sd.competencies.length, 0)

  return (
    <div className="rounded-lg border border-bg-muted">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-bg"
      >
        {expanded
          ? <ChevronDown className="h-4 w-4 shrink-0 text-text-light" />
          : <ChevronRight className="h-4 w-4 shrink-0 text-text-light" />}
        <span className="flex-1 text-sm font-semibold text-text">{domain.name}</span>
        <span className="shrink-0 rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-medium text-primary-600">
          {totalComps} competencies
        </span>
      </button>

      {expanded && (
        <div className="border-t border-bg-muted px-3 py-2 space-y-2">
          {domain.subdomains.map((sd, si) => (
            <div key={si}>
              <p className="text-xs font-medium text-text-muted mb-1">{sd.name}</p>
              <div className="space-y-0.5 pl-3">
                {sd.competencies.slice(0, 5).map((c, ci) => (
                  <div key={ci} className="flex items-start gap-1.5 py-0.5">
                    <span className="text-xs font-semibold text-primary-700">{c.code}</span>
                    <span className="text-xs text-text-muted truncate">{c.name}</span>
                    <span className="shrink-0 rounded bg-bg-muted px-1.5 py-0.5 text-[10px] text-text-light">
                      {Object.keys(c.stepDescriptors).length} steps
                    </span>
                  </div>
                ))}
                {sd.competencies.length > 5 && (
                  <p className="text-[10px] text-text-light">
                    +{sd.competencies.length - 5} more...
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================
// Component
// ============================================================

export default function UploadCompetencyFrameworkModal({ open, onClose, onUploaded }: Props) {
  const { toast } = useToast()
  const { profile } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<UploadStep>('upload')
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState('')
  const [frameworkName, setFrameworkName] = useState('')
  const [parsed, setParsed] = useState<ParsedFramework | null>(null)
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep('upload')
      setDragOver(false)
      setFileName('')
      setFrameworkName('')
      setParsed(null)
      setValidation(null)
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
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  // ── File handling ──────────────────────────────────────

  async function handleFile(file: File) {
    const ext = file.name.toLowerCase().split('.').pop()
    setFileName(file.name)

    // Default framework name from file name
    const nameFromFile = file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ')
    setFrameworkName(nameFromFile)

    try {
      let framework: ParsedFramework

      if (ext === 'xlsx' || ext === 'xls') {
        // Parse XLSX with SheetJS
        const buffer = await file.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: 'array' })

        const sheets: Record<string, Record<string, string>[]> = {}
        for (const sheetName of workbook.SheetNames) {
          const ws = workbook.Sheets[sheetName]
          const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })
          if (rows.length > 0) sheets[sheetName] = rows
        }

        if (Object.keys(sheets).length === 0) {
          toast('No data found in spreadsheet', 'error')
          return
        }

        framework = parseMultiSheetData(sheets, nameFromFile)
      } else if (ext === 'csv') {
        // Parse CSV with PapaParse
        const text = await file.text()
        const result = Papa.parse<Record<string, string>>(text, {
          header: true,
          skipEmptyLines: true,
        })

        if (result.errors.length > 0) {
          toast(`CSV parse error: ${result.errors[0].message}`, 'error')
          return
        }

        framework = parseSingleSheetData(result.data, nameFromFile)
      } else {
        toast('Please upload an XLSX or CSV file', 'error')
        return
      }

      const v = validateParsedFramework(framework)
      setParsed(framework)
      setValidation(v)
      setStep('preview')
    } catch (err) {
      toast(
        `Failed to parse file: ${err instanceof Error ? err.message : 'Unknown error'}`,
        'error'
      )
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0])
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(true)
  }

  function handleDragLeave() {
    setDragOver(false)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) handleFile(e.target.files[0])
  }

  // ── Upload ─────────────────────────────────────────────

  async function handleUpload() {
    if (!parsed || !validation?.valid || !profile?.school_id) return

    // Update name if user changed it
    parsed.name = frameworkName.trim() || parsed.name

    setStep('uploading')
    setUploadError(null)

    try {
      await saveFrameworkToDb(profile.school_id, parsed)
      setStep('complete')
      toast('Competency framework uploaded', 'success')

      // Auto-trigger AI mapping in the background
      triggerCompetencyMapping(profile.school_id).then((result) => {
        if (result.mapped > 0) {
          toast(`AI mapped ${result.mapped} competency-dimension links`, 'success')
        }
      }).catch(() => {
        // Non-blocking — mapping can be retried later
      })
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload framework')
      setStep('preview')
    }
  }

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
      <div className="relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl bg-bg-card shadow-2xl sm:max-w-xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-bg-muted px-5 py-4">
          <h2 className="text-base font-bold text-text">Upload Competency Framework</h2>
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
              <p className="text-sm text-text-muted">
                Upload a spreadsheet containing your competency framework. Each sheet represents
                a domain, with columns for Sub-domain, Competency, Code, Objective, and Step
                descriptors (E1-E6, 1-10).
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
                    className={clsx('h-6 w-6', dragOver ? 'text-primary-600' : 'text-text-light')}
                  />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-text">
                    Drop an XLSX or CSV file here or{' '}
                    <span className="text-primary-500">browse</span>
                  </p>
                  <p className="mt-1 text-xs text-text-light">.xlsx, .xls, .csv files</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
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
                Download CSV template
              </button>
            </div>
          )}

          {/* ── Preview step ──────────────────────────── */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* Validation errors */}
              {validation && !validation.valid && (
                <div className="rounded-lg border border-alert-200 bg-alert-50 p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-alert-700">
                    <AlertCircle className="h-4 w-4" />
                    Validation errors in {fileName}
                  </div>
                  <ul className="space-y-1">
                    {validation.errors.map((err, i) => (
                      <li key={i} className="text-xs leading-relaxed text-alert-600">
                        &bull; {err}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => {
                      setStep('upload')
                      setValidation(null)
                      setParsed(null)
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

              {/* Valid preview */}
              {parsed && validation?.valid && (
                <>
                  {/* File info */}
                  <div className="flex items-center gap-3 rounded-lg border border-bg-muted bg-bg p-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50">
                      <FileSpreadsheet className="h-5 w-5 text-primary-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text">{fileName}</p>
                      <p className="text-xs text-text-light">
                        {validation.stats.domains} domains, {validation.stats.subdomains} sub-domains,{' '}
                        {validation.stats.competencies} competencies
                      </p>
                    </div>
                  </div>

                  {/* Framework name (editable) */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-light">
                      Framework Name
                    </label>
                    <input
                      type="text"
                      value={frameworkName}
                      onChange={(e) => setFrameworkName(e.target.value)}
                      className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
                    />
                  </div>

                  {/* Domain tree preview */}
                  <div>
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-light">
                      Domains Preview
                    </span>
                    <div className="max-h-80 space-y-2 overflow-y-auto">
                      {parsed.domains.map((domain, i) => (
                        <DomainPreview key={i} domain={domain} index={i} />
                      ))}
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
                Uploading {validation?.stats.competencies || 0} competencies across{' '}
                {validation?.stats.domains || 0} domains...
              </p>
            </div>
          )}

          {/* ── Complete step ─────────────────────────── */}
          {step === 'complete' && parsed && validation && (
            <div className="flex flex-col items-center gap-3 py-10">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success-50">
                <CheckCircle2 className="h-7 w-7 text-success-600" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-text">Framework uploaded successfully</p>
                <p className="mt-1 text-xs text-text-muted">
                  {parsed.name} — {validation.stats.competencies} competencies across{' '}
                  {validation.stats.domains} domains
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
                  setValidation(null)
                  setParsed(null)
                  setUploadError(null)
                }}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-bg-muted"
              >
                Back
              </button>
              <button
                onClick={handleUpload}
                disabled={!parsed || !validation?.valid || !frameworkName.trim()}
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
