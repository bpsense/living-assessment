import { useState, useEffect } from 'react'
import { X, Search, Loader2, MessageCircle, Users } from 'lucide-react'
import { searchMessagingUsers, searchParentContactableUsers, createDirectConversation, createGroupConversation } from '../../lib/messaging-data'
import type { Profile } from '../../types/database'

type UserResult = Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'role'>

interface Props {
  open: boolean
  schoolId: string
  currentUserId: string
  userRole?: string
  onClose: () => void
  onCreated: (conversationId: string) => void
}

export default function NewConversationModal({ open, schoolId, currentUserId, userRole, onClose, onCreated }: Props) {
  const isParent = userRole === 'parent'
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UserResult[]>([])
  const [selected, setSelected] = useState<UserResult[]>([])
  const [searching, setSearching] = useState(false)
  const [creating, setCreating] = useState(false)
  const [groupTitle, setGroupTitle] = useState('')
  const [error, setError] = useState<string | null>(null)

  const isGroup = selected.length > 1

  // Search users
  useEffect(() => {
    if (!open || !query.trim() || query.length < 2) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const users = isParent
          ? await searchParentContactableUsers(currentUserId, query)
          : await searchMessagingUsers(schoolId, query, currentUserId)
        // Filter out already selected users
        const selectedIds = new Set(selected.map((s) => s.id))
        setResults(users.filter((u) => !selectedIds.has(u.id)))
      } catch {
        setResults([])
      }
      setSearching(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [query, open, schoolId, currentUserId, selected])

  if (!open) return null

  function handleSelect(user: UserResult) {
    setSelected((prev) => [...prev, user])
    setQuery('')
    setResults([])
  }

  function handleRemove(userId: string) {
    setSelected((prev) => prev.filter((u) => u.id !== userId))
  }

  async function handleCreate() {
    if (selected.length === 0) return

    // Safety guard: parents cannot message learners or other parents
    if (isParent) {
      const blocked = selected.find((u) => u.role === 'learner' || u.role === 'parent')
      if (blocked) {
        setError('You can only message educators and administrators.')
        return
      }
    }

    setCreating(true)
    setError(null)

    try {
      let conversationId: string

      if (selected.length === 1) {
        // Direct message
        conversationId = await createDirectConversation(selected[0].id, currentUserId, schoolId)
      } else {
        // Group message
        const title = groupTitle.trim() || selected.map((s) => s.full_name).join(', ')
        conversationId = await createGroupConversation(
          title,
          selected.map((s) => s.id),
          currentUserId,
          schoolId
        )
      }

      onCreated(conversationId)
      // Reset state
      setSelected([])
      setQuery('')
      setGroupTitle('')
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Failed to create conversation')
    }

    setCreating(false)
  }

  const roleLabel = (role: string) => {
    switch (role) {
      case 'learner': return 'Learner'
      case 'educator': return 'Educator'
      case 'admin': return 'Admin'
      default: return role
    }
  }

  const roleColor = (role: string) => {
    switch (role) {
      case 'learner': return 'bg-blue-100 text-blue-700'
      case 'educator': return 'bg-green-100 text-green-700'
      case 'admin': return 'bg-purple-100 text-purple-700'
      default: return 'bg-slate-100 text-slate-700'
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-bg-card p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-text-muted hover:bg-bg-secondary hover:text-text-secondary transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-4">
          <h3 className="text-lg font-semibold text-text-primary">New Conversation</h3>
          <p className="mt-1 text-sm text-text-secondary">
            {isParent
              ? 'Search for educators and administrators to message.'
              : 'Search for people in your school to message.'}
          </p>
        </div>

        {/* Selected users */}
        {selected.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {selected.map((user) => (
              <span
                key={user.id}
                className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700"
              >
                {user.full_name}
                <button
                  onClick={() => handleRemove(user.id)}
                  className="ml-0.5 rounded-full hover:bg-primary-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Group title (if multi-select) */}
        {isGroup && (
          <div className="mb-3">
            <input
              type="text"
              value={groupTitle}
              onChange={(e) => setGroupTitle(e.target.value)}
              placeholder="Group name (optional)"
              className="w-full rounded-lg border border-bg-muted bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary-300 focus:outline-none focus:ring-1 focus:ring-primary-300"
            />
          </div>
        )}

        {/* Search input */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name…"
            className="w-full rounded-lg border border-bg-muted bg-bg-secondary py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-primary-300 focus:outline-none focus:ring-1 focus:ring-primary-300"
            autoFocus
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-text-muted" />
          )}
        </div>

        {/* Search results */}
        <div className="mb-4 max-h-48 overflow-y-auto rounded-lg border border-bg-muted">
          {results.length === 0 ? (
            <div className="py-6 text-center text-xs text-text-muted">
              {query.length >= 2
                ? searching
                  ? 'Searching…'
                  : 'No results found'
                : 'Type at least 2 characters to search'}
            </div>
          ) : (
            results.map((user) => (
              <button
                key={user.id}
                onClick={() => handleSelect(user)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-bg-secondary transition-colors"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-muted text-xs font-bold text-text-muted">
                  {user.full_name?.charAt(0).toUpperCase() || '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary truncate">{user.full_name}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${roleColor(user.role)}`}>
                  {roleLabel(user.role)}
                </span>
              </button>
            ))
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-3 rounded-lg bg-alert-50 p-2 text-xs text-alert-700">{error}</div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={selected.length === 0 || creating}
            className="flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50 transition-colors"
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isGroup ? (
              <Users className="h-4 w-4" />
            ) : (
              <MessageCircle className="h-4 w-4" />
            )}
            {isGroup ? 'Create Group' : 'Start Chat'}
          </button>
        </div>
      </div>
    </div>
  )
}
