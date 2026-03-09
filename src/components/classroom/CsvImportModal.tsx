import { useState, useEffect, useRef } from 'react'
import {
  X,
  Loader2,
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../Toast'
import {
  parseCSV,
  autoMapColumns,
  validateRow,
  transformRowToStudentInsert,
  generateTemplateCSV,
  STUDENT_FIELDS,
} from '../../lib/csv-import'
import type { ColumnMapping, CsvRow, CsvValidationError } from '../../lib/csv-import'

// ============================================================
// Props
// ============================================================

interface Props {
  open: boolean
  onClose: () => void
  classroomId: string
  schoolId: string
  onImported: () => void
}

type ImportStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete'

// ============================================================
// Component
// ============================================================

export default function CsvImportModal({
  open,
  onClose,
  classroomId,
  schoolId,
  onImported,
}: Props) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<ImportStep>('upload')
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState('')

  // Parsed data
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<CsvRow[]>([])
  const [mapping, setMapping] = useState<ColumnMapping>({})

  // Validation
  const [validationErrors, setValidationErrors] = useState<CsvValidationError[]>([])

  // Import progress
  const [importedCount, setImportedCount] = useState(0)
  const [skippedCount, setSkippedCount] = useState(0)
  const [totalToImport, setTotalToImport] = useState(0)

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep('upload')
      setDragOver(false)
      setFileName('')
      setHeaders([])
      setRows([])
      setMapping({})
      setValidationErrors([])
      setImportedCount(0)
      setSkippedCount(0)
      setTotalToImport(0)
    }
  }, [open])

  // Escape to close (not during import)
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && step !== 'importing') onClose()
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
    return () => { document.body.style.overflow = '' }
  }, [open])

  // ── File handling ───────────────────────────────────────

  function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast('Please upload a CSV file', 'error')
      return
    }

    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const result = parseCSV(text)
      setHeaders(result.headers)
      setRows(result.rows)
      setMapping(autoMapColumns(result.headers))
      setStep('mapping')
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

  function downloadTemplate() {
    const csv = generateTemplateCSV()
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'learner_import_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Validation ──────────────────────────────────────────

  function runValidation() {
    const errors: CsvValidationError[] = []
    for (let i = 0; i < rows.length; i++) {
      errors.push(...validateRow(rows[i], mapping, i))
    }
    setValidationErrors(errors)
    return errors
  }

  function goToPreview() {
    const errors = runValidation()
    setStep('preview')
  }

  // ── Import ──────────────────────────────────────────────

  async function startImport() {
    // Determine valid rows
    const errorRowIndices = new Set(validationErrors.map((e) => e.row))
    const validRows = rows.filter((_, i) => !errorRowIndices.has(i))

    setTotalToImport(validRows.length)
    setSkippedCount(errorRowIndices.size)
    setImportedCount(0)
    setStep('importing')

    // Batch insert in chunks of 50
    const BATCH_SIZE = 50
    let imported = 0
    let failedBatches = 0
    let lastError = ''

    try {
      for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
        const batch = validRows.slice(i, i + BATCH_SIZE)
        const inserts = batch.map((row) =>
          transformRowToStudentInsert(row, mapping, schoolId, classroomId)
        )

        const { error } = await supabase.from('students').insert(inserts)

        if (error) {
          failedBatches++
          lastError = error.message
          console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, error.message)
          // Continue with remaining batches
        } else {
          imported += batch.length
        }

        setImportedCount(imported)
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Unknown error during import'
      console.error('Import threw an error:', lastError)
    }

    if (failedBatches > 0 && imported === 0) {
      toast(`Import failed: ${lastError}`, 'error')
    } else if (failedBatches > 0) {
      toast(`Some batches failed: ${lastError}`, 'error')
    }

    setStep('complete')
  }

  function handleClose() {
    if (step === 'complete') {
      onImported()
    }
    onClose()
  }

  if (!open) return null

  // ── Mapping helpers ─────────────────────────────────────

  function updateMapping(csvHeader: string, dbField: string) {
    setMapping((prev) => ({ ...prev, [csvHeader]: dbField }))
  }

  // Check required fields are mapped
  const requiredMapped = STUDENT_FIELDS
    .filter((f) => f.required)
    .every((f) => Object.values(mapping).includes(f.key))

  // Rows with errors
  const errorRowIndices = new Set(validationErrors.map((e) => e.row))
  const validRowCount = rows.length - errorRowIndices.size

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-text/40 backdrop-blur-sm"
        onClick={() => step !== 'importing' && handleClose()}
      />

      {/* Panel */}
      <div className="relative z-10 flex max-h-[90vh] w-full flex-col rounded-t-2xl bg-bg-card shadow-2xl sm:max-w-3xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-bg-muted px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-text">Import Learners from CSV</h2>
            <p className="text-xs text-text-muted">
              {step === 'upload' && 'Upload a CSV file with learner data'}
              {step === 'mapping' && 'Map CSV columns to learner fields'}
              {step === 'preview' && 'Review data before importing'}
              {step === 'importing' && 'Importing learners...'}
              {step === 'complete' && 'Import complete!'}
            </p>
          </div>
          {step !== 'importing' && (
            <button
              onClick={handleClose}
              className="rounded-lg p-1 text-text-muted transition-colors hover:bg-bg-muted hover:text-text"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {/* ──── STEP 1: Upload ──── */}
          {step === 'upload' && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
                  dragOver
                    ? 'border-primary-400 bg-primary-50'
                    : 'border-bg-muted hover:border-primary-300'
                }`}
              >
                <Upload className="mx-auto h-10 w-10 text-text-light" />
                <p className="mt-3 text-sm text-text">
                  Drag and drop a CSV file here, or{' '}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="font-medium text-primary-600 hover:text-primary-700"
                  >
                    browse
                  </button>
                </p>
                <p className="mt-1 text-xs text-text-light">Accepts .csv files</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleFile(e.target.files[0])
                  }}
                />
              </div>

              <button
                onClick={downloadTemplate}
                className="flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700"
              >
                <Download className="h-3.5 w-3.5" />
                Download CSV template
              </button>
            </div>
          )}

          {/* ──── STEP 2: Column Mapping ──── */}
          {step === 'mapping' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <FileSpreadsheet className="h-4 w-4" />
                <span>{fileName}</span>
                <span className="text-text-light">({rows.length} rows)</span>
              </div>

              {!requiredMapped && (
                <div className="flex items-start gap-2 rounded-lg bg-caution-50 px-3 py-2.5 text-xs text-caution-600">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Required fields (First Name, Last Name) must be mapped to continue.
                </div>
              )}

              <div className="overflow-hidden rounded-lg border border-bg-muted">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-bg-muted bg-bg-muted/30">
                      <th className="px-3 py-2 text-left font-medium text-text-muted">
                        CSV Column
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-text-muted">
                        Maps To
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-text-muted">
                        Sample
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {headers.map((header) => (
                      <tr key={header} className="border-b border-bg-muted last:border-0">
                        <td className="px-3 py-2 font-medium text-text">{header}</td>
                        <td className="px-3 py-2">
                          <select
                            value={mapping[header] ?? ''}
                            onChange={(e) => updateMapping(header, e.target.value)}
                            className="w-full rounded border border-bg-muted bg-bg-card px-2 py-1 text-xs text-text focus:border-primary-400 focus:outline-none"
                          >
                            <option value="">(skip)</option>
                            {STUDENT_FIELDS.map((f) => (
                              <option key={f.key} value={f.key}>
                                {f.label} {f.required ? '*' : ''}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2 text-text-light truncate max-w-[200px]">
                          {rows[0]?.[header] ?? ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ──── STEP 3: Preview ──── */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* Error summary */}
              {validationErrors.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg bg-caution-50 px-3 py-2.5 text-xs text-caution-600">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <div>
                    <span className="font-medium">{errorRowIndices.size} row{errorRowIndices.size !== 1 ? 's' : ''}</span> will be skipped due to errors.
                    <span className="ml-1">{validRowCount} row{validRowCount !== 1 ? 's' : ''} will be imported.</span>
                  </div>
                </div>
              )}

              {validationErrors.length === 0 && (
                <div className="flex items-start gap-2 rounded-lg bg-success-50 px-3 py-2.5 text-xs text-success-600">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  All {rows.length} rows are valid and ready to import.
                </div>
              )}

              {/* Preview table (first 10 rows) */}
              <div className="overflow-x-auto rounded-lg border border-bg-muted">
                <table className="w-full text-xs whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-bg-muted bg-bg-muted/30">
                      <th className="px-2 py-2 text-left font-medium text-text-muted">#</th>
                      {Object.entries(mapping)
                        .filter(([, v]) => v)
                        .map(([csvH, dbField]) => (
                          <th key={csvH} className="px-2 py-2 text-left font-medium text-text-muted">
                            {STUDENT_FIELDS.find((f) => f.key === dbField)?.label ?? dbField}
                          </th>
                        ))}
                      <th className="px-2 py-2 text-left font-medium text-text-muted">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 10).map((row, i) => {
                      const rowErrors = validationErrors.filter((e) => e.row === i)
                      const hasError = rowErrors.length > 0
                      return (
                        <tr
                          key={i}
                          className={`border-b border-bg-muted last:border-0 ${hasError ? 'bg-alert-50/50' : ''}`}
                        >
                          <td className="px-2 py-1.5 text-text-light">{i + 1}</td>
                          {Object.entries(mapping)
                            .filter(([, v]) => v)
                            .map(([csvH, dbField]) => {
                              const cellError = rowErrors.find((e) => e.field === dbField)
                              return (
                                <td
                                  key={csvH}
                                  className={`px-2 py-1.5 max-w-[150px] truncate ${cellError ? 'text-alert-600 font-medium' : 'text-text'}`}
                                  title={cellError ? cellError.message : row[csvH]}
                                >
                                  {row[csvH] || '—'}
                                </td>
                              )
                            })}
                          <td className="px-2 py-1.5">
                            {hasError ? (
                              <span className="text-alert-500 text-[10px] font-medium">
                                {rowErrors.map((e) => e.message).join('; ')}
                              </span>
                            ) : (
                              <CheckCircle2 className="h-3.5 w-3.5 text-success-500" />
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {rows.length > 10 && (
                <p className="text-xs text-text-light text-center">
                  Showing first 10 of {rows.length} rows
                </p>
              )}
            </div>
          )}

          {/* ──── STEP 4: Importing ──── */}
          {step === 'importing' && (
            <div className="flex flex-col items-center gap-4 py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
              <p className="text-sm text-text">
                Importing learners... {importedCount} / {totalToImport}
              </p>
              <div className="h-2 w-64 overflow-hidden rounded-full bg-bg-muted">
                <div
                  className="h-full rounded-full bg-primary-500 transition-all"
                  style={{
                    width: `${totalToImport > 0 ? (importedCount / totalToImport) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* ──── STEP 5: Complete ──── */}
          {step === 'complete' && (
            <div className="flex flex-col items-center gap-4 py-10">
              <CheckCircle2 className="h-12 w-12 text-success-500" />
              <div className="text-center">
                <p className="text-lg font-semibold text-text">Import Complete!</p>
                <p className="mt-1 text-sm text-text-muted">
                  Successfully imported {importedCount} learner{importedCount !== 1 ? 's' : ''}
                  {skippedCount > 0 && (
                    <span>. {skippedCount} row{skippedCount !== 1 ? 's' : ''} skipped due to errors.</span>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-bg-muted px-5 py-4">
          <div>
            {step === 'mapping' && (
              <button
                onClick={() => setStep('upload')}
                className="flex items-center gap-1 text-xs text-text-muted hover:text-text"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            )}
            {step === 'preview' && (
              <button
                onClick={() => setStep('mapping')}
                className="flex items-center gap-1 text-xs text-text-muted hover:text-text"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step !== 'importing' && step !== 'complete' && (
              <button
                onClick={handleClose}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-bg-muted"
              >
                Cancel
              </button>
            )}

            {step === 'mapping' && (
              <button
                onClick={goToPreview}
                disabled={!requiredMapped}
                className="flex items-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-600 disabled:opacity-50"
              >
                Preview <ArrowRight className="h-4 w-4" />
              </button>
            )}

            {step === 'preview' && (
              <button
                onClick={startImport}
                disabled={validRowCount === 0}
                className="flex items-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-600 disabled:opacity-50"
              >
                Import {validRowCount} Learner{validRowCount !== 1 ? 's' : ''}
              </button>
            )}

            {step === 'complete' && (
              <button
                onClick={handleClose}
                className="rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-600"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
