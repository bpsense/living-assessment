/**
 * SmartSelect.tsx
 *
 * A reusable dropdown component with:
 * - Searchable/filterable list when > 8 options
 * - "Create New" option that opens an inline input
 * - Color indicator support (for dimension domains)
 * - Clear / unset option
 * - Keyboard navigation
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronDown, X, Plus, Search, Check } from 'lucide-react'
import { clsx } from 'clsx'

// ============================================================
// Types
// ============================================================

export interface SmartSelectOption {
  value: string
  label: string
  /** Optional color dot shown beside the label */
  color?: string
  /** Optional secondary text (shown dimmer) */
  detail?: string
}

interface Props {
  /** Currently-selected value (empty string = nothing selected) */
  value: string
  /** Called when user picks or clears a value */
  onChange: (value: string) => void
  /** The options to display */
  options: SmartSelectOption[]
  /** Placeholder when nothing is selected */
  placeholder?: string
  /** Label shown above the field */
  label?: string
  /** Show "(optional)" after label */
  optional?: boolean
  /** Enable "Create New" row at the bottom */
  allowCreate?: boolean
  /** Called when user creates a new value via inline input. Should return the value to auto-select. */
  onCreateNew?: (input: string) => Promise<string> | string
  /** Placeholder for the create-new inline input */
  createPlaceholder?: string
  /** Disable the control */
  disabled?: boolean
}

// ============================================================
// Styles
// ============================================================

const SEARCH_THRESHOLD = 8

// ============================================================
// Component
// ============================================================

export default function SmartSelect({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  label,
  optional,
  allowCreate = false,
  onCreateNew,
  createPlaceholder = 'Type a new value…',
  disabled = false,
}: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [newValue, setNewValue] = useState('')
  const [saving, setSaving] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const createRef = useRef<HTMLInputElement>(null)

  const showSearch = options.length > SEARCH_THRESHOLD

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setCreating(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && showSearch) {
      setTimeout(() => searchRef.current?.focus(), 0)
    }
  }, [isOpen, showSearch])

  // Focus create input when creating
  useEffect(() => {
    if (creating) {
      setTimeout(() => createRef.current?.focus(), 0)
    }
  }, [creating])

  const filtered = search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options

  const selectedOption = options.find((o) => o.value === value)

  const handleSelect = useCallback(
    (val: string) => {
      onChange(val)
      setIsOpen(false)
      setCreating(false)
      setSearch('')
    },
    [onChange]
  )

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onChange('')
    },
    [onChange]
  )

  async function handleCreateSubmit() {
    const trimmed = newValue.trim()
    if (!trimmed || !onCreateNew) return
    setSaving(true)
    try {
      const result = await onCreateNew(trimmed)
      handleSelect(result)
      setNewValue('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="mb-1.5 block text-xs font-semibold text-text-light">
          {label}
          {optional && <span className="font-normal text-text-light"> (optional)</span>}
        </label>
      )}

      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'flex w-full items-center gap-2 rounded-lg border bg-bg px-3 py-2 text-left text-sm transition-colors',
          isOpen
            ? 'border-primary-400 ring-1 ring-primary-400'
            : 'border-bg-muted hover:border-primary-300',
          disabled && 'cursor-not-allowed opacity-60'
        )}
      >
        {selectedOption ? (
          <span className="flex min-w-0 flex-1 items-center gap-2">
            {selectedOption.color && (
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: selectedOption.color }}
              />
            )}
            <span className="truncate text-text">{selectedOption.label}</span>
          </span>
        ) : (
          <span className="flex-1 truncate text-text-light">{placeholder}</span>
        )}

        {value && !disabled ? (
          <span
            role="button"
            tabIndex={-1}
            onClick={handleClear}
            className="shrink-0 rounded p-0.5 text-text-light transition-colors hover:bg-bg-muted hover:text-text"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        ) : (
          <ChevronDown
            className={clsx(
              'h-4 w-4 shrink-0 text-text-light transition-transform',
              isOpen && 'rotate-180'
            )}
          />
        )}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-lg border border-bg-muted bg-bg-card shadow-lg">
          {/* Search */}
          {showSearch && (
            <div className="border-b border-bg-muted px-2 py-1.5">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-light" />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search…"
                  className="w-full rounded-md bg-bg py-1.5 pl-7 pr-2 text-xs text-text placeholder:text-text-light focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Options list */}
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <div className="px-3 py-3 text-center text-xs text-text-muted">No matches</div>
            )}
            {filtered.map((opt) => {
              const selected = opt.value === value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  className={clsx(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                    selected ? 'bg-primary-50 text-primary-700' : 'text-text hover:bg-bg-muted'
                  )}
                >
                  {opt.color && (
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: opt.color }}
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                  {opt.detail && (
                    <span className="shrink-0 text-[10px] text-text-muted">{opt.detail}</span>
                  )}
                  {selected && <Check className="h-3.5 w-3.5 shrink-0 text-primary-500" />}
                </button>
              )
            })}
          </div>

          {/* Create new */}
          {allowCreate && onCreateNew && (
            <div className="border-t border-bg-muted">
              {!creating ? (
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-primary-600 transition-colors hover:bg-primary-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create New
                </button>
              ) : (
                <div className="flex items-center gap-1.5 px-2 py-2">
                  <input
                    ref={createRef}
                    type="text"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateSubmit()
                      if (e.key === 'Escape') {
                        setCreating(false)
                        setNewValue('')
                      }
                    }}
                    placeholder={createPlaceholder}
                    className="min-w-0 flex-1 rounded-md border border-bg-muted bg-bg px-2 py-1.5 text-xs text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
                  />
                  <button
                    type="button"
                    disabled={!newValue.trim() || saving}
                    onClick={handleCreateSubmit}
                    className="shrink-0 rounded-md bg-primary-500 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-600 disabled:opacity-50"
                  >
                    {saving ? '…' : 'Add'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
