import { useState, useRef, useCallback } from 'react'
import {
  FileText,
  Upload,
  Trash2,
  Download,
  Loader2,
  Plus,
  X,
} from 'lucide-react'
import { useStudentDocuments } from '../../lib/sis-data'
import { useToast } from '../Toast'
import type { StudentDocument } from '../../types/database'

// ============================================================
// Helpers
// ============================================================

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const FILE_ICON_COLORS: Record<string, string> = {
  'application/pdf': 'text-alert-500 bg-alert-50',
  'image/': 'text-primary-500 bg-primary-50',
  'application/vnd': 'text-success-600 bg-success-50',
  'text/': 'text-accent-500 bg-accent-50',
}

function getFileIconColor(mimeType: string): string {
  for (const [prefix, color] of Object.entries(FILE_ICON_COLORS)) {
    if (mimeType.startsWith(prefix)) return color
  }
  return 'text-primary-500 bg-primary-50'
}

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

export default function StudentDocuments({ studentId }: Props) {
  const { toast } = useToast()
  const {
    documents,
    loading,
    uploadDocument,
    updateDescription,
    deleteDocument,
    downloadDocument,
  } = useStudentDocuments(studentId)

  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadDesc, setUploadDesc] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files)
      if (fileArray.length === 0) return

      setUploading(true)
      try {
        for (const file of fileArray) {
          await uploadDocument(file, uploadDesc)
        }
        toast(`${fileArray.length} file${fileArray.length > 1 ? 's' : ''} uploaded`, 'success')
        setUploadDesc('')
        setShowUpload(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Upload failed', 'error')
      } finally {
        setUploading(false)
      }
    },
    [uploadDocument, uploadDesc, toast]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      if (e.dataTransfer.files.length > 0) {
        handleFileUpload(e.dataTransfer.files)
      }
    },
    [handleFileUpload]
  )

  return (
    <div>
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
        <FileText className="h-3.5 w-3.5" /> Documents
        {documents.length > 0 && (
          <span className="rounded-full bg-primary-50 px-1.5 py-0.5 text-[10px] font-bold text-primary-700">
            {documents.length}
          </span>
        )}
        <button
          onClick={() => setShowUpload(true)}
          className="ml-auto flex items-center gap-1 rounded-md bg-primary-50 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-primary-700 transition-colors hover:bg-primary-100"
        >
          <Plus className="h-3 w-3" /> Upload
        </button>
      </h3>

      {/* Upload area */}
      {showUpload && (
        <div className="mb-3 rounded-lg border border-bg-muted bg-bg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text">Upload Document</span>
            <button
              onClick={() => setShowUpload(false)}
              className="text-text-light hover:text-text"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <input
            type="text"
            value={uploadDesc}
            onChange={(e) => setUploadDesc(e.target.value)}
            placeholder="Description (optional)"
            className="w-full rounded-md border border-bg-muted bg-bg-card px-2.5 py-1.5 text-xs text-text placeholder:text-text-light focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />

          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-5 transition-colors ${
              dragOver
                ? 'border-primary-400 bg-primary-50'
                : 'border-bg-muted bg-bg-card hover:border-primary-300 hover:bg-primary-50/50'
            }`}
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary-400" />
            ) : (
              <>
                <Upload className="h-5 w-5 text-text-light" />
                <p className="mt-1.5 text-xs text-text-muted">
                  Drop files here or <span className="font-medium text-primary-600">browse</span>
                </p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(e) => {
                if (e.target.files) handleFileUpload(e.target.files)
              }}
              className="hidden"
            />
          </div>
        </div>
      )}

      {/* Document list */}
      {loading ? (
        <p className="text-xs text-text-light">Loading documents...</p>
      ) : documents.length === 0 ? (
        <p className="text-xs text-text-light">
          No documents uploaded yet. Click Upload to add files.
        </p>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              onDownload={() =>
                downloadDocument(doc).catch((err) =>
                  toast(err instanceof Error ? err.message : 'Download failed', 'error')
                )
              }
              onDelete={async () => {
                try {
                  await deleteDocument(doc)
                  toast('Document deleted', 'success')
                } catch (err) {
                  toast(err instanceof Error ? err.message : 'Delete failed', 'error')
                }
              }}
              onUpdateDescription={async (desc) => {
                try {
                  await updateDescription(doc.id, desc)
                } catch (err) {
                  toast(err instanceof Error ? err.message : 'Update failed', 'error')
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================
// Document card
// ============================================================

function DocumentCard({
  doc,
  onDownload,
  onDelete,
  onUpdateDescription,
}: {
  doc: StudentDocument
  onDownload: () => void
  onDelete: () => void
  onUpdateDescription: (description: string) => void
}) {
  const [desc, setDesc] = useState(doc.description ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-bg-muted bg-bg p-2.5">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${getFileIconColor(doc.file_type)}`}
      >
        <FileText className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-text">{doc.file_name}</p>
        <p className="text-[10px] text-text-light">
          {formatFileSize(doc.file_size)} &middot;{' '}
          {new Date(doc.created_at).toLocaleDateString()}
        </p>
        <input
          type="text"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onBlur={() => {
            if (desc !== (doc.description ?? '')) {
              onUpdateDescription(desc)
            }
          }}
          placeholder="Add description…"
          className="mt-1 w-full rounded border border-bg-muted bg-transparent px-1.5 py-0.5 text-[10px] text-text-muted placeholder:text-text-light focus:border-primary-300 focus:outline-none"
        />
      </div>
      <div className="flex items-center gap-0.5">
        <button
          onClick={onDownload}
          title="Download"
          className="rounded-md p-1 text-text-light transition-colors hover:bg-primary-50 hover:text-primary-600"
        >
          <Download className="h-3.5 w-3.5" />
        </button>
        {confirmDelete ? (
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => {
                onDelete()
                setConfirmDelete(false)
              }}
              className="rounded px-1.5 py-0.5 text-[10px] font-medium text-alert-600 hover:bg-alert-50"
            >
              Delete
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="rounded px-1.5 py-0.5 text-[10px] text-text-muted hover:bg-bg-muted"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            title="Delete"
            className="rounded-md p-1 text-text-light transition-colors hover:bg-alert-50 hover:text-alert-500"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
