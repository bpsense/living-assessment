import { useState, useEffect } from 'react'
import { clsx } from 'clsx'
import { X, Loader2 } from 'lucide-react'
import {
  BookOpen,
  Calculator,
  Microscope,
  Globe,
  Palette,
  HeartPulse,
  Users,
  Lightbulb,
  MessageCircle,
  Compass,
} from 'lucide-react'
import type { LucideProps } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../Toast'
import type { Dimension } from '../../types/database'

// ============================================================
// Constants
// ============================================================

const CATEGORIES = [
  'Academic',
  'Creative & Arts',
  'Physical & Health',
  'Social & Emotional',
  'Cognitive',
] as const

const ICON_OPTIONS: { key: string; label: string; Icon: React.FC<LucideProps> }[] = [
  { key: 'book-open', label: 'Book', Icon: BookOpen },
  { key: 'calculator', label: 'Calculator', Icon: Calculator },
  { key: 'microscope', label: 'Microscope', Icon: Microscope },
  { key: 'globe', label: 'Globe', Icon: Globe },
  { key: 'palette', label: 'Palette', Icon: Palette },
  { key: 'heart-pulse', label: 'Heart', Icon: HeartPulse },
  { key: 'users', label: 'People', Icon: Users },
  { key: 'lightbulb', label: 'Lightbulb', Icon: Lightbulb },
  { key: 'message-circle', label: 'Message', Icon: MessageCircle },
  { key: 'compass', label: 'Compass', Icon: Compass },
]

// ============================================================
// Props
// ============================================================

interface Props {
  open: boolean
  onClose: () => void
  dimension: Dimension | null // null = create mode
  schoolId: string
  onSaved: () => void
  existingCount: number
}

// ============================================================
// Component
// ============================================================

export default function DimensionEditModal({
  open,
  onClose,
  dimension,
  schoolId,
  onSaved,
  existingCount,
}: Props) {
  const { toast } = useToast()
  const isEdit = dimension !== null

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<string>('Academic')
  const [icon, setIcon] = useState<string>('book-open')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Populate form on open
  useEffect(() => {
    if (open && dimension) {
      setName(dimension.name)
      setDescription(dimension.description ?? '')
      setCategory(dimension.category)
      setIcon(dimension.icon ?? 'book-open')
      setError(null)
    } else if (open && !dimension) {
      setName('')
      setDescription('')
      setCategory('Academic')
      setIcon('book-open')
      setError(null)
    }
  }, [open, dimension])

  // Escape to close
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose, saving])

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

  async function handleSave() {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Name is required')
      return
    }
    if (trimmedName.length > 100) {
      setError('Name must be 100 characters or less')
      return
    }
    if (!isEdit && existingCount >= 15) {
      setError('Maximum of 15 dimensions reached')
      return
    }

    setSaving(true)
    setError(null)

    if (isEdit) {
      const { error: updateErr } = await supabase
        .from('dimensions')
        .update({
          name: trimmedName,
          description: description.trim() || null,
          category,
          icon,
        })
        .eq('id', dimension!.id)

      setSaving(false)
      if (updateErr) {
        setError(updateErr.message)
        return
      }
      toast('Dimension updated', 'success')
    } else {
      const { error: insertErr } = await supabase.from('dimensions').insert({
        school_id: schoolId,
        name: trimmedName,
        description: description.trim() || null,
        category,
        icon,
        display_order: existingCount + 1,
        is_active: true,
      })

      setSaving(false)
      if (insertErr) {
        setError(insertErr.message)
        return
      }
      toast('Dimension created', 'success')
    }

    onSaved()
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-text/40 backdrop-blur-sm"
        onClick={saving ? undefined : onClose}
      />

      {/* Panel */}
      <div className="glass-modal relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl sm:max-w-lg sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-bg-muted px-5 py-4">
          <h2 className="text-base font-bold text-text">
            {isEdit ? 'Edit Dimension' : 'New Dimension'}
          </h2>
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-1.5 text-text-light transition-colors hover:bg-bg-muted hover:text-text disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* Error */}
          {error && (
            <div className="rounded-lg bg-alert-50 px-3 py-2 text-sm text-alert-600">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text">
              Name <span className="text-alert-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Scientific Inquiry"
              maxLength={100}
              className="w-full rounded-xl border border-bg-muted bg-bg px-4 py-2.5 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what this dimension measures..."
              rows={3}
              maxLength={500}
              className="w-full resize-none rounded-xl border border-bg-muted bg-bg px-4 py-2.5 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>

          {/* Category */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-bg-muted bg-bg px-4 py-2.5 text-sm text-text focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Icon picker */}
          <div>
            <label className="mb-2 block text-sm font-medium text-text">
              Icon
            </label>
            <div className="grid grid-cols-5 gap-2">
              {ICON_OPTIONS.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setIcon(key)}
                  title={label}
                  className={clsx(
                    'flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-2.5 transition-all',
                    icon === key
                      ? 'border-primary-500 bg-primary-50 shadow-sm'
                      : 'border-bg-muted bg-bg-card hover:border-primary-200'
                  )}
                >
                  <Icon
                    className={clsx(
                      'h-5 w-5',
                      icon === key ? 'text-primary-600' : 'text-text-muted'
                    )}
                  />
                  <span
                    className={clsx(
                      'text-[10px]',
                      icon === key
                        ? 'font-medium text-primary-700'
                        : 'text-text-light'
                    )}
                  >
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-bg-muted px-5 py-4">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Add Dimension'}
          </button>
        </div>
      </div>
    </div>
  )
}
