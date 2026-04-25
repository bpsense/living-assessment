import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, UsersRound, Plus, Mail, Send, Eye, UserPlus, UserX, MoreVertical } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { useAccessControl } from '../../lib/access-control'
import { useToast } from '../../components/Toast'
import { useFamilyList, inviteFamily } from '../../lib/family-data'
import { supabase } from '../../lib/supabase'
import { usePageAccess } from '../../lib/role-permissions'

export default function Families() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { canDeactivateUsers } = useAccessControl()
  const { canEdit } = usePageAccess('families')
  const { families, loading, error, refetch } = useFamilyList(profile?.school_id)
  const [actionMenu, setActionMenu] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const handleDeactivate = useCallback(async (userId: string, name: string) => {
    setActionLoading(userId)
    const { error: err } = await supabase
      .from('profiles')
      .update({ is_active: false })
      .eq('id', userId)
    if (err) {
      toast(err.message, 'error')
    } else {
      toast(`${name} has been deactivated`, 'success')
      refetch()
    }
    setActionLoading(null)
    setActionMenu(null)
  }, [toast, refetch])

  // Invite form state
  const [showInvite, setShowInvite] = useState(false)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!profile || !inviteName.trim() || !inviteEmail.trim()) return

    setInviting(true)
    const { error: err } = await inviteFamily(
      inviteEmail.trim(),
      inviteName.trim(),
      profile.school_id
    )

    if (err) {
      toast(err, 'error')
    } else {
      toast(`Invited ${inviteName.trim()}! A password setup email has been sent.`, 'success')
      setInviteName('')
      setInviteEmail('')
      setShowInvite(false)
      refetch()
    }
    setInviting(false)
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl rounded-xl border border-alert-200 bg-alert-50 p-6 text-center">
        <p className="text-sm text-alert-700">{error}</p>
      </div>
    )
  }

  const totalLinked = families.reduce((s, f) => s + f.linked_students.length, 0)

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Families</h1>
          <p className="mt-1 text-sm text-text-muted">
            {families.length} family account{families.length !== 1 ? 's' : ''}
            {' \u00b7 '}
            {totalLinked} student{totalLinked !== 1 ? 's' : ''} linked
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowInvite((v) => !v)}
            className="flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-600"
          >
            <Plus className="h-4 w-4" />
            Invite Family
          </button>
        )}
      </div>

      {/* Invite form */}
      {showInvite && (
        <form
          onSubmit={handleInvite}
          className="glass-card p-5"
        >
          <h3 className="mb-1 text-sm font-semibold text-text">Invite Family Member</h3>
          <p className="mb-4 text-xs text-text-muted">
            They'll receive an email to set up their password. After logging in they can link their children using each learner's unique family code.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">
                Full Name *
              </label>
              <input
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="e.g. Sarah Johnson"
                required
                className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">
                Email *
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light" />
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="parent@example.com"
                  required
                  className="w-full rounded-lg border border-bg-muted bg-bg py-2 pl-10 pr-3 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={inviting}
              className="flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50"
            >
              {inviting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Send Invite
            </button>
            <button
              type="button"
              onClick={() => setShowInvite(false)}
              className="rounded-lg px-4 py-2 text-sm text-text-muted hover:bg-bg-muted"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Family list */}
      {families.length === 0 && !showInvite ? (
        <div className="glass-card p-10 text-center">
          <UsersRound className="mx-auto h-10 w-10 text-text-light" />
          <p className="mt-3 text-sm text-text-muted">
            No family accounts yet. Invite your first family to get started.
          </p>
          <button
            onClick={() => setShowInvite(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-50 px-4 py-2 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-100"
          >
            <UserPlus className="h-4 w-4" />
            Invite Family
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {families.map((family) => {
            const initials = family.full_name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)

            return (
              <div
                key={family.id}
                className="relative glass-card p-5"
              >
                {/* Action menu */}
                {canDeactivateUsers && (
                  <div className="absolute right-3 top-3">
                    <button
                      onClick={() => setActionMenu(actionMenu === family.id ? null : family.id)}
                      className="rounded p-1 text-text-light hover:bg-bg-muted hover:text-text"
                    >
                      {actionLoading === family.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MoreVertical className="h-4 w-4" />
                      )}
                    </button>
                    {actionMenu === family.id && (
                      <div className="absolute right-0 top-full z-10 mt-1 w-40 rounded-lg border border-bg-muted bg-bg-card py-1 shadow-lg">
                        <button
                          onClick={() => {
                            handleDeactivate(family.id, family.full_name)
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-xs text-alert-600 hover:bg-alert-50"
                        >
                          <UserX className="h-3 w-3" />
                          Deactivate
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Avatar + Name */}
                <div className="flex items-center gap-3">
                  {family.avatar_url ? (
                    <img
                      src={family.avatar_url}
                      alt={family.full_name}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-100">
                      <span className="text-sm font-bold text-accent-700">
                        {initials}
                      </span>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-text">
                      {family.full_name}
                    </p>
                    <p className="truncate text-xs text-text-muted">{family.email}</p>
                  </div>
                </div>

                {/* Linked students */}
                <div className="mt-3 flex flex-wrap gap-1">
                  {family.linked_students.length === 0 ? (
                    <span className="rounded-full bg-bg-muted px-2 py-0.5 text-[10px] font-medium text-text-light">
                      No learners linked
                    </span>
                  ) : (
                    family.linked_students.map((s) => (
                      <span
                        key={s.id}
                        className="rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-medium text-primary-700"
                      >
                        {s.first_name} {s.last_name}
                        {s.classroom_name && (
                          <span className="text-primary-400"> &middot; {s.classroom_name}</span>
                        )}
                      </span>
                    ))
                  )}
                </div>

                {/* View as Family button */}
                <div className="mt-3 border-t border-bg-muted pt-3">
                  <button
                    onClick={() => navigate(`/admin/family-view/${family.id}`)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-bg-muted px-3 py-2 text-xs font-medium text-text-muted transition-colors hover:bg-bg-muted hover:text-text"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View as Family
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
