import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  StickyNote,
  Plus,
  Lock,
  Unlock,
  Pencil,
  Trash2,
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useTeacherNotes } from '../../lib/sis-data'
import { useAuth } from '../../lib/auth'
import { useToast } from '../Toast'
import TeacherNoteFiles from './TeacherNoteFiles'
import type { NoteType, TeacherNoteWithAuthor } from '../../types/database'

// ============================================================
// Note type badge colours
// ============================================================

const NOTE_TYPE_STYLES: Record<NoteType, string> = {
  general: 'bg-bg-muted text-text-muted',
  academic: 'bg-primary-50 text-primary-700',
  behavioral: 'bg-caution-50 text-caution-600',
  'social-emotional': 'bg-purple-50 text-purple-700',
  medical: 'bg-alert-50 text-alert-600',
}

const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  general: 'General',
  academic: 'Academic',
  behavioral: 'Behavioral',
  'social-emotional': 'Social-Emotional',
  medical: 'Medical',
}

const ALL_NOTE_TYPES: NoteType[] = ['general', 'academic', 'behavioral', 'social-emotional', 'medical']

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

export default function TeacherNotes({ studentId, schoolId }: Props) {
  const { profile, actualRole } = useAuth()
  const { toast } = useToast()
  const { notes, loading, addNote, updateNote, deleteNote } = useTeacherNotes(studentId)

  const [open, setOpen] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [filterType, setFilterType] = useState<NoteType | 'all'>('all')
  const [editingId, setEditingId] = useState<string | null>(null)

  // Add form state
  const [newContent, setNewContent] = useState('')
  const [newType, setNewType] = useState<NoteType>('general')
  const [newConfidential, setNewConfidential] = useState(true)
  const [saving, setSaving] = useState(false)

  // Edit form state
  const [editContent, setEditContent] = useState('')
  const [editType, setEditType] = useState<NoteType>('general')
  const [editConfidential, setEditConfidential] = useState(true)

  const filteredNotes =
    filterType === 'all' ? notes : notes.filter((n) => n.note_type === filterType)

  const isAdmin = actualRole === 'admin'

  async function handleAddNote() {
    if (!newContent.trim() || !profile) return
    setSaving(true)
    try {
      await addNote({
        content: newContent.trim(),
        note_type: newType,
        is_confidential: newConfidential,
        school_id: schoolId,
        author_id: profile.id,
      })
      toast('Note added', 'success')
      setNewContent('')
      setNewType('general')
      setNewConfidential(true)
      setShowAddForm(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to add note', 'error')
    } finally {
      setSaving(false)
    }
  }

  function startEdit(note: TeacherNoteWithAuthor) {
    setEditingId(note.id)
    setEditContent(note.content)
    setEditType(note.note_type)
    setEditConfidential(note.is_confidential)
  }

  async function handleUpdateNote() {
    if (!editingId || !editContent.trim()) return
    setSaving(true)
    try {
      await updateNote(editingId, {
        content: editContent.trim(),
        note_type: editType,
        is_confidential: editConfidential,
      })
      toast('Note updated', 'success')
      setEditingId(null)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update note', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteNote(id: string) {
    try {
      await deleteNote(id)
      toast('Note deleted', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to delete note', 'error')
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
          <StickyNote className="h-5 w-5 text-accent-500" />
          <h2 className="text-sm font-semibold text-text">Teacher Notes</h2>
          {notes.length > 0 && (
            <span className="rounded-full bg-accent-50 px-1.5 py-0.5 text-[10px] font-bold text-accent-700">
              {notes.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowAddForm(true)
              setOpen(true)
            }}
            className="flex items-center gap-1 rounded-lg bg-accent-50 px-2.5 py-1 text-xs font-medium text-accent-700 transition-colors hover:bg-accent-100"
          >
            <Plus className="h-3.5 w-3.5" /> Add Note
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
        <div className="border-t border-bg-muted px-5 pb-5 pt-4 space-y-4">
          {/* Filter pills */}
          {notes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <FilterPill
                label="All"
                active={filterType === 'all'}
                count={notes.length}
                onClick={() => setFilterType('all')}
              />
              {ALL_NOTE_TYPES.map((type) => {
                const count = notes.filter((n) => n.note_type === type).length
                if (count === 0) return null
                return (
                  <FilterPill
                    key={type}
                    label={NOTE_TYPE_LABELS[type]}
                    active={filterType === type}
                    count={count}
                    onClick={() => setFilterType(type)}
                  />
                )
              })}
            </div>
          )}

          {/* Add note form */}
          {showAddForm && (
            <div className="rounded-lg border border-bg-muted bg-bg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-text">New Note</h3>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="text-text-light hover:text-text"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Write your note..."
                rows={3}
                className="w-full resize-none rounded-lg border border-bg-muted bg-bg-card px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />

              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as NoteType)}
                  className="rounded-lg border border-bg-muted bg-bg-card px-2.5 py-1.5 text-xs text-text focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                >
                  {ALL_NOTE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {NOTE_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>

                <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newConfidential}
                    onChange={(e) => setNewConfidential(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-bg-muted text-primary-500 focus:ring-primary-300"
                  />
                  <Lock className="h-3 w-3" />
                  Confidential (hidden from families)
                </label>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleAddNote}
                  disabled={saving || !newContent.trim()}
                  className="flex items-center gap-1.5 rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-600 disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                  Save Note
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="rounded-lg px-3 py-1.5 text-xs text-text-muted hover:bg-bg-muted"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Notes list */}
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary-400" />
            </div>
          ) : filteredNotes.length === 0 ? (
            <p className="text-center text-sm text-text-light py-4">
              {notes.length === 0
                ? 'No teacher notes yet. Click "Add Note" to create one.'
                : 'No notes match the selected filter.'}
            </p>
          ) : (
            <div className="space-y-3">
              {filteredNotes.map((note) => (
                <div key={note.id}>
                  {editingId === note.id ? (
                    /* Edit form */
                    <div className="rounded-lg border border-primary-200 bg-bg p-4 space-y-3">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={3}
                        className="w-full resize-none rounded-lg border border-bg-muted bg-bg-card px-3 py-2 text-sm text-text focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                      />
                      <div className="flex flex-wrap items-center gap-3">
                        <select
                          value={editType}
                          onChange={(e) => setEditType(e.target.value as NoteType)}
                          className="rounded-lg border border-bg-muted bg-bg-card px-2.5 py-1.5 text-xs text-text focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                        >
                          {ALL_NOTE_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {NOTE_TYPE_LABELS[type]}
                            </option>
                          ))}
                        </select>
                        <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editConfidential}
                            onChange={(e) => setEditConfidential(e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-bg-muted text-primary-500 focus:ring-primary-300"
                          />
                          <Lock className="h-3 w-3" />
                          Confidential
                        </label>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleUpdateNote}
                          disabled={saving || !editContent.trim()}
                          className="flex items-center gap-1.5 rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-600 disabled:opacity-50"
                        >
                          {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="rounded-lg px-3 py-1.5 text-xs text-text-muted hover:bg-bg-muted"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Note display */
                    <NoteCard
                      note={note}
                      canEdit={note.author_id === profile?.id || isAdmin}
                      onEdit={() => startEdit(note)}
                      onDelete={() => handleDeleteNote(note.id)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Files & Folders ─────────────────── */}
          <div className="border-t border-bg-muted pt-4">
            <TeacherNoteFiles studentId={studentId} schoolId={schoolId} />
          </div>
        </div>
      )}
    </section>
  )
}

// ============================================================
// Filter pill
// ============================================================

function FilterPill({
  label,
  active,
  count,
  onClick,
}: {
  label: string
  active: boolean
  count: number
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? 'bg-primary-500 text-white'
          : 'bg-bg-muted text-text-muted hover:bg-primary-50 hover:text-primary-700'
      }`}
    >
      {label} ({count})
    </button>
  )
}

// ============================================================
// Note card
// ============================================================

function NoteCard({
  note,
  canEdit,
  onEdit,
  onDelete,
}: {
  note: TeacherNoteWithAuthor
  canEdit: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="rounded-lg border border-bg-muted bg-bg p-3">
      {/* Meta line */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-text">{note.author_name}</span>
          <span className="text-[10px] text-text-light">
            {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${NOTE_TYPE_STYLES[note.note_type]}`}
          >
            {NOTE_TYPE_LABELS[note.note_type]}
          </span>
          {note.is_confidential ? (
            <span className="flex items-center gap-0.5 text-[10px] text-text-light" title="Confidential — not visible to families">
              <Lock className="h-2.5 w-2.5" />
            </span>
          ) : (
            <span className="flex items-center gap-0.5 text-[10px] text-success-500" title="Visible to families">
              <Unlock className="h-2.5 w-2.5" />
            </span>
          )}
        </div>

        {canEdit && (
          <div className="flex items-center gap-0.5">
            <button
              onClick={onEdit}
              className="rounded-lg p-1 text-text-light transition-colors hover:bg-bg-muted hover:text-text"
              title="Edit note"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onDelete}
              className="rounded-lg p-1 text-text-light transition-colors hover:bg-alert-50 hover:text-alert-500"
              title="Delete note"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <p className="mt-2 text-sm text-text whitespace-pre-wrap">{note.content}</p>
    </div>
  )
}
