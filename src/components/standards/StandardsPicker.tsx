/**
 * StandardsPicker.tsx
 *
 * Tree picker over a school's standards framework (e.g. "Boundless
 * Developmental Skill Baseline"). Used by the Assign Project flow
 * and the Personalize editor to pick which standards an assignment
 * (or one student's snapshot) covers.
 */
import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Loader2, Search } from 'lucide-react'
import { clsx } from 'clsx'
import { fetchStandardsFrameworks, fetchStandardsForFramework } from '../../lib/translation-data'
import type { Standard, StandardsFramework } from '../../types/database'

interface Props {
  schoolId: string
  /** Standards already selected. */
  selectedIds: Set<string>
  onChange: (selected: Set<string>) => void
  /** Optional: scope picker to a specific framework; otherwise user chooses. */
  frameworkId?: string
  /** Compact rendering for embedding in narrow modals. */
  compact?: boolean
}

interface TreeNode extends Standard {
  children: TreeNode[]
}

export default function StandardsPicker({
  schoolId,
  selectedIds,
  onChange,
  frameworkId,
  compact = false,
}: Props) {
  const [frameworks, setFrameworks] = useState<StandardsFramework[]>([])
  const [activeFrameworkId, setActiveFrameworkId] = useState<string | null>(frameworkId ?? null)
  const [standards, setStandards] = useState<Standard[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Load frameworks for the school
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchStandardsFrameworks(schoolId)
      .then((rows) => {
        if (cancelled) return
        setFrameworks(rows)
        if (!activeFrameworkId && rows.length > 0) {
          setActiveFrameworkId(rows[0].id)
        }
      })
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId])

  // Load standards for the active framework
  useEffect(() => {
    if (!activeFrameworkId) {
      setStandards([])
      return
    }
    let cancelled = false
    setLoading(true)
    fetchStandardsForFramework(activeFrameworkId)
      .then((rows) => { if (!cancelled) setStandards(rows) })
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [activeFrameworkId])

  // Build a tree from the flat parent_id list
  const tree = useMemo<TreeNode[]>(() => {
    const byId = new Map<string, TreeNode>()
    standards.forEach((s) => byId.set(s.id, { ...s, children: [] }))
    const roots: TreeNode[] = []
    for (const node of byId.values()) {
      if (node.parent_id && byId.has(node.parent_id)) {
        byId.get(node.parent_id)!.children.push(node)
      } else {
        roots.push(node)
      }
    }
    return roots
  }, [standards])

  // Filter to matches (and their ancestors so context is preserved)
  const visibleIds = useMemo(() => {
    if (!search.trim()) return null
    const q = search.toLowerCase()
    const matched = new Set<string>()
    const matches = standards.filter(
      (s) =>
        s.code.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        (s.grade_level ?? '').toLowerCase().includes(q)
    )
    const byId = new Map(standards.map((s) => [s.id, s]))
    for (const m of matches) {
      let cur: Standard | undefined = m
      while (cur) {
        matched.add(cur.id)
        cur = cur.parent_id ? byId.get(cur.parent_id) : undefined
      }
    }
    return matched
  }, [search, standards])

  // Auto-expand ancestors of matched nodes during search
  useEffect(() => {
    if (visibleIds) setExpanded(new Set(visibleIds))
  }, [visibleIds])

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelected(id: string) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(next)
  }

  return (
    <div className="space-y-3">
      {/* Framework selector + search */}
      {!frameworkId && frameworks.length > 1 && (
        <select
          value={activeFrameworkId ?? ''}
          onChange={(e) => setActiveFrameworkId(e.target.value || null)}
          className="w-full rounded-lg border border-bg-muted bg-bg-card px-3 py-2 text-sm text-text"
        >
          {frameworks.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search standards…"
          className="w-full rounded-lg border border-bg-muted bg-bg-card py-2 pl-9 pr-3 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
        />
      </div>

      {/* Tree */}
      <div
        className={clsx(
          'rounded-xl border border-bg-muted bg-bg-card',
          compact ? 'max-h-72 overflow-y-auto' : 'max-h-96 overflow-y-auto'
        )}
      >
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary-400" />
          </div>
        ) : tree.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-text-muted">
            No standards in this framework yet.
          </p>
        ) : (
          <ul className="py-1">
            {tree.map((n) => (
              <TreeRow
                key={n.id}
                node={n}
                depth={0}
                selectedIds={selectedIds}
                expanded={expanded}
                visibleIds={visibleIds}
                onToggle={toggle}
                onToggleSelected={toggleSelected}
              />
            ))}
          </ul>
        )}
      </div>

      {selectedIds.size > 0 && (
        <p className="text-xs text-text-muted">
          {selectedIds.size} standard{selectedIds.size === 1 ? '' : 's'} selected
        </p>
      )}
    </div>
  )
}

function TreeRow({
  node,
  depth,
  selectedIds,
  expanded,
  visibleIds,
  onToggle,
  onToggleSelected,
}: {
  node: TreeNode
  depth: number
  selectedIds: Set<string>
  expanded: Set<string>
  visibleIds: Set<string> | null
  onToggle: (id: string) => void
  onToggleSelected: (id: string) => void
}) {
  if (visibleIds && !visibleIds.has(node.id)) return null

  const hasChildren = node.children.length > 0
  const isOpen = expanded.has(node.id)
  const isSelected = selectedIds.has(node.id)

  return (
    <li>
      <div
        className={clsx(
          'flex items-center gap-1.5 px-2 py-1 hover:bg-bg-muted/40',
          isSelected && 'bg-primary-50'
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => onToggle(node.id)}
            className="rounded p-0.5 text-text-light hover:bg-bg-muted"
          >
            {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <span className="w-5" />
        )}

        <label className="flex flex-1 cursor-pointer items-center gap-2 py-1">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelected(node.id)}
            className="h-3.5 w-3.5 rounded border-bg-muted text-primary-500 focus:ring-primary-400"
          />
          <span className="font-mono text-[11px] text-text-light">{node.code}</span>
          {node.grade_level && (
            <span className="rounded bg-bg-muted px-1.5 py-0.5 text-[10px] text-text-muted">
              {node.grade_level}
            </span>
          )}
          <span className="flex-1 text-xs text-text">{node.description}</span>
        </label>
      </div>

      {hasChildren && isOpen && (
        <ul>
          {node.children.map((c) => (
            <TreeRow
              key={c.id}
              node={c}
              depth={depth + 1}
              selectedIds={selectedIds}
              expanded={expanded}
              visibleIds={visibleIds}
              onToggle={onToggle}
              onToggleSelected={onToggleSelected}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
