import { useState, useRef, useCallback, useMemo } from 'react'
import {
  FolderPlus,
  FolderOpen,
  Folder,
  FileText,
  Upload,
  Trash2,
  Download,
  Loader2,
  Plus,
  X,
  Pencil,
  Check,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { useTeacherNoteFiles } from '../../lib/sis-data'
import { useToast } from '../Toast'
import type { TeacherNoteFolder, TeacherNoteFile } from '../../types/database'

// ============================================================
// Helpers
// ============================================================

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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

export default function TeacherNoteFiles({ studentId }: Props) {
  const { toast } = useToast()
  const {
    folders,
    files,
    loading,
    createFolder,
    renameFolder,
    deleteFolder,
    uploadFile,
    deleteFile,
    downloadFile,
  } = useTeacherNoteFiles(studentId)

  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [uploadingTo, setUploadingTo] = useState<string | null | undefined>(undefined) // undefined = hidden, null = root, string = folder id
  const [uploading, setUploading] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const rootFiles = useMemo(() => files.filter((f) => !f.folder_id), [files])
  const totalFileCount = files.length

  const toggleFolder = useCallback((id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim()) return
    setCreatingFolder(true)
    try {
      await createFolder(newFolderName.trim())
      toast('Folder created', 'success')
      setNewFolderName('')
      setShowNewFolder(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create folder', 'error')
    } finally {
      setCreatingFolder(false)
    }
  }, [newFolderName, createFolder, toast])

  const handleFileUpload = useCallback(
    async (fileList: FileList | File[], folderId?: string | null) => {
      const arr = Array.from(fileList)
      if (arr.length === 0) return

      setUploading(true)
      try {
        for (const file of arr) {
          await uploadFile(file, folderId)
        }
        toast(`${arr.length} file${arr.length > 1 ? 's' : ''} uploaded`, 'success')
        setUploadingTo(undefined)
        if (fileInputRef.current) fileInputRef.current.value = ''
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Upload failed', 'error')
      } finally {
        setUploading(false)
      }
    },
    [uploadFile, toast]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent, folderId?: string | null) => {
      e.preventDefault()
      setDragOver(false)
      if (e.dataTransfer.files.length > 0) {
        handleFileUpload(e.dataTransfer.files, folderId)
      }
    },
    [handleFileUpload]
  )

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-primary-400" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
          <FolderOpen className="h-3.5 w-3.5" /> Files & Folders
          {totalFileCount > 0 && (
            <span className="rounded-full bg-accent-50 px-1.5 py-0.5 text-[10px] font-bold text-accent-700">
              {totalFileCount}
            </span>
          )}
        </h3>
        <div className="ml-auto flex gap-1.5">
          <button
            onClick={() => setShowNewFolder(true)}
            className="flex items-center gap-1 rounded-md bg-bg-muted px-2 py-0.5 text-[10px] font-medium text-text-muted transition-colors hover:bg-primary-50 hover:text-primary-700"
          >
            <FolderPlus className="h-3 w-3" /> New Folder
          </button>
          <button
            onClick={() => setUploadingTo(null)}
            className="flex items-center gap-1 rounded-md bg-accent-50 px-2 py-0.5 text-[10px] font-medium text-accent-700 transition-colors hover:bg-accent-100"
          >
            <Plus className="h-3 w-3" /> Upload File
          </button>
        </div>
      </div>

      {/* Create folder inline form */}
      {showNewFolder && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-bg-muted bg-bg p-2.5">
          <FolderPlus className="h-4 w-4 shrink-0 text-primary-400" />
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateFolder()
              if (e.key === 'Escape') setShowNewFolder(false)
            }}
            placeholder="Folder name"
            autoFocus
            className="flex-1 rounded-md border border-bg-muted bg-bg-card px-2 py-1 text-xs text-text placeholder:text-text-light focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
          <button
            onClick={handleCreateFolder}
            disabled={creatingFolder || !newFolderName.trim()}
            className="flex items-center gap-1 rounded-md bg-primary-500 px-2.5 py-1 text-[10px] font-medium text-white transition-colors hover:bg-primary-600 disabled:opacity-50"
          >
            {creatingFolder ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Create
          </button>
          <button
            onClick={() => {
              setShowNewFolder(false)
              setNewFolderName('')
            }}
            className="rounded-md p-1 text-text-light hover:text-text"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Upload zone (root level) */}
      {uploadingTo !== undefined && uploadingTo === null && (
        <UploadZone
          dragOver={dragOver}
          uploading={uploading}
          fileInputRef={fileInputRef}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => handleDrop(e, null)}
          onBrowse={() => fileInputRef.current?.click()}
          onFileChange={(e) => {
            if (e.target.files) handleFileUpload(e.target.files, null)
          }}
          onClose={() => setUploadingTo(undefined)}
        />
      )}

      {/* Folders */}
      {folders.length === 0 && rootFiles.length === 0 ? (
        <p className="text-xs text-text-light py-2">
          No files or folders yet. Create a folder or upload a file to get started.
        </p>
      ) : (
        <div className="space-y-2">
          {folders.map((folder) => (
            <FolderCard
              key={folder.id}
              folder={folder}
              files={files.filter((f) => f.folder_id === folder.id)}
              expanded={expandedFolders.has(folder.id)}
              onToggle={() => toggleFolder(folder.id)}
              onRename={renameFolder}
              onDelete={async () => {
                try {
                  await deleteFolder(folder)
                  toast('Folder deleted', 'success')
                } catch (err) {
                  toast(err instanceof Error ? err.message : 'Delete failed', 'error')
                }
              }}
              onUpload={async (fileList) => {
                await handleFileUpload(fileList, folder.id)
              }}
              onDeleteFile={async (file) => {
                try {
                  await deleteFile(file)
                  toast('File deleted', 'success')
                } catch (err) {
                  toast(err instanceof Error ? err.message : 'Delete failed', 'error')
                }
              }}
              onDownloadFile={async (file) => {
                try {
                  await downloadFile(file)
                } catch (err) {
                  toast(err instanceof Error ? err.message : 'Download failed', 'error')
                }
              }}
            />
          ))}

          {/* Root-level files */}
          {rootFiles.length > 0 && (
            <div className="space-y-1.5">
              {folders.length > 0 && (
                <p className="text-[10px] font-semibold uppercase tracking-wider text-text-light pt-1">
                  Unfiled
                </p>
              )}
              {rootFiles.map((file) => (
                <FileCard
                  key={file.id}
                  file={file}
                  onDownload={async () => {
                    try {
                      await downloadFile(file)
                    } catch (err) {
                      toast(err instanceof Error ? err.message : 'Download failed', 'error')
                    }
                  }}
                  onDelete={async () => {
                    try {
                      await deleteFile(file)
                      toast('File deleted', 'success')
                    } catch (err) {
                      toast(err instanceof Error ? err.message : 'Delete failed', 'error')
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================
// Upload zone
// ============================================================

function UploadZone({
  dragOver,
  uploading,
  fileInputRef,
  onDragOver,
  onDragLeave,
  onDrop,
  onBrowse,
  onFileChange,
  onClose,
}: {
  dragOver: boolean
  uploading: boolean
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent) => void
  onBrowse: () => void
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onClose: () => void
}) {
  return (
    <div className="mb-3 rounded-lg border border-bg-muted bg-bg p-2.5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-text">Upload File</span>
        <button onClick={onClose} className="text-text-light hover:text-text">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={onBrowse}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-4 transition-colors ${
          dragOver
            ? 'border-accent-400 bg-accent-50'
            : 'border-bg-muted bg-bg-card hover:border-accent-300 hover:bg-accent-50/50'
        }`}
      >
        {uploading ? (
          <Loader2 className="h-5 w-5 animate-spin text-accent-400" />
        ) : (
          <>
            <Upload className="h-5 w-5 text-text-light" />
            <p className="mt-1 text-xs text-text-muted">
              Drop files here or <span className="font-medium text-accent-600">browse</span>
            </p>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={onFileChange}
          className="hidden"
        />
      </div>
    </div>
  )
}

// ============================================================
// Folder card
// ============================================================

function FolderCard({
  folder,
  files,
  expanded,
  onToggle,
  onRename,
  onDelete,
  onUpload,
  onDeleteFile,
  onDownloadFile,
}: {
  folder: TeacherNoteFolder
  files: TeacherNoteFile[]
  expanded: boolean
  onToggle: () => void
  onRename: (id: string, name: string) => Promise<void>
  onDelete: () => void
  onUpload: (files: FileList | File[]) => Promise<void>
  onDeleteFile: (file: TeacherNoteFile) => Promise<void>
  onDownloadFile: (file: TeacherNoteFile) => Promise<void>
}) {
  const { toast } = useToast()
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(folder.name)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const folderFileRef = useRef<HTMLInputElement>(null)

  const handleRename = async () => {
    if (!editName.trim() || editName.trim() === folder.name) {
      setEditing(false)
      setEditName(folder.name)
      return
    }
    try {
      await onRename(folder.id, editName.trim())
      toast('Folder renamed', 'success')
      setEditing(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Rename failed', 'error')
    }
  }

  const handleUpload = async (fileList: FileList | File[]) => {
    setUploading(true)
    try {
      await onUpload(fileList)
      setShowUpload(false)
      if (folderFileRef.current) folderFileRef.current.value = ''
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="rounded-lg border border-bg-muted bg-bg">
      {/* Folder header */}
      <div className="flex items-center gap-2 p-2.5">
        <button onClick={onToggle} className="shrink-0 text-text-muted hover:text-text">
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <div className="text-accent-500">
          {expanded ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
        </div>

        {editing ? (
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename()
              if (e.key === 'Escape') {
                setEditing(false)
                setEditName(folder.name)
              }
            }}
            autoFocus
            className="flex-1 rounded-md border border-primary-300 bg-bg-card px-2 py-0.5 text-xs text-text focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        ) : (
          <button onClick={onToggle} className="flex-1 text-left">
            <span className="text-xs font-medium text-text">{folder.name}</span>
            <span className="ml-2 text-[10px] text-text-light">
              {files.length} file{files.length !== 1 ? 's' : ''}
            </span>
          </button>
        )}

        <div className="flex items-center gap-0.5">
          <button
            onClick={() => {
              setShowUpload(true)
              if (!expanded) onToggle()
            }}
            title="Upload to folder"
            className="rounded-md p-1 text-text-light transition-colors hover:bg-accent-50 hover:text-accent-600"
          >
            <Upload className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => {
              setEditing(true)
              setEditName(folder.name)
            }}
            title="Rename"
            className="rounded-md p-1 text-text-light transition-colors hover:bg-bg-muted hover:text-text"
          >
            <Pencil className="h-3.5 w-3.5" />
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
              title="Delete folder"
              className="rounded-md p-1 text-text-light transition-colors hover:bg-alert-50 hover:text-alert-500"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-bg-muted px-2.5 pb-2.5 pt-2 space-y-1.5">
          {/* Upload area inside folder */}
          {showUpload && (
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                if (e.dataTransfer.files.length > 0) handleUpload(e.dataTransfer.files)
              }}
              onClick={() => folderFileRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-3 py-3 transition-colors ${
                dragOver
                  ? 'border-accent-400 bg-accent-50'
                  : 'border-bg-muted hover:border-accent-300 hover:bg-accent-50/50'
              }`}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin text-accent-400" />
              ) : (
                <>
                  <Upload className="h-4 w-4 text-text-light" />
                  <p className="mt-1 text-[10px] text-text-muted">
                    Drop files or <span className="font-medium text-accent-600">browse</span>
                  </p>
                </>
              )}
              <input
                ref={folderFileRef}
                type="file"
                multiple
                onChange={(e) => {
                  if (e.target.files) handleUpload(e.target.files)
                }}
                className="hidden"
              />
            </div>
          )}

          {files.length === 0 && !showUpload ? (
            <p className="text-[10px] text-text-light py-1">Empty folder</p>
          ) : (
            files.map((file) => (
              <FileCard
                key={file.id}
                file={file}
                onDownload={() => onDownloadFile(file)}
                onDelete={() => onDeleteFile(file)}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================
// File card
// ============================================================

function FileCard({
  file,
  onDownload,
  onDelete,
}: {
  file: TeacherNoteFile
  onDownload: () => void
  onDelete: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className="flex items-center gap-2 rounded-md border border-bg-muted bg-bg-card px-2.5 py-1.5">
      <FileText className="h-3.5 w-3.5 shrink-0 text-text-light" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-text">{file.file_name}</p>
        <p className="text-[10px] text-text-light">
          {formatFileSize(file.file_size)} &middot;{' '}
          {new Date(file.created_at).toLocaleDateString()}
        </p>
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
