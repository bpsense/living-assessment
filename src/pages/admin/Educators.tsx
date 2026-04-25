import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Users, ClipboardPen, School, Plus, Mail, Send, UserX, MoreVertical } from 'lucide-react'
import { usePageAccess } from '../../lib/role-permissions'
import { useAuth } from '../../lib/auth'
import { useAccessControl } from '../../lib/access-control'
import { useToast } from '../../components/Toast'
import { useEducatorList, inviteEducator } from '../../lib/educator-data'
import { supabase } from '../../lib/supabase'

export default function Educators() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { canDeactivateUsers } = useAccessControl()
  const { canEdit } = usePageAccess('educators')
  const { educators, loading, error, refetch } = useEducatorList(profile?.school_id)
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
    const { error: err } = await inviteEducator(
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

  const totalObs = educators.reduce((s, e) => s + e.total_observations, 0)
  const totalThisMonth = educators.reduce((s, e) => s + e.observations_this_month, 0)

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Educators</h1>
          <p className="mt-1 text-sm text-text-muted">
            {educators.length} educator{educators.length !== 1 ? 's' : ''}
            {' \u00b7 '}
            {totalThisMonth} observations this month
            {' \u00b7 '}
            {totalObs} total
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowInvite((v) => !v)}
            className="flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-600"
          >
            <Plus className="h-4 w-4" />
            Invite Educator
          </button>
        )}
      </div>

      {/* Invite form */}
      {showInvite && (
        <form
          onSubmit={handleInvite}
          className="glass-card p-5"
        >
          <h3 className="mb-1 text-sm font-semibold text-text">Invite New Educator</h3>
          <p className="mb-4 text-xs text-text-muted">
            They'll receive an email to set up their password and log in.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">
                Full Name *
              </label>
              <input
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="e.g. Jane Smith"
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
                  placeholder="jane@school.edu"
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

      {/* Educator list */}
      {educators.length === 0 && !showInvite ? (
        <div className="glass-card p-10 text-center">
          <Users className="mx-auto h-10 w-10 text-text-light" />
          <p className="mt-3 text-sm text-text-muted">
            No educators yet. Invite your first educator to get started.
          </p>
          <button
            onClick={() => setShowInvite(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-50 px-4 py-2 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-100"
          >
            <Plus className="h-4 w-4" />
            Invite Educator
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {educators.map((edu) => {
            const initials = edu.full_name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)

            return (
              <div
                key={edu.id}
                className="glass-card glass-card-interactive group relative p-5 text-left"
              >
                {/* Action menu */}
                {canDeactivateUsers && (
                  <div className="absolute right-3 top-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setActionMenu(actionMenu === edu.id ? null : edu.id)
                      }}
                      className="rounded p-1 text-text-light hover:bg-bg-muted hover:text-text"
                    >
                      {actionLoading === edu.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MoreVertical className="h-4 w-4" />
                      )}
                    </button>
                    {actionMenu === edu.id && (
                      <div className="absolute right-0 top-full z-10 mt-1 w-40 rounded-lg border border-bg-muted bg-bg-card py-1 shadow-lg">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/admin/educator/${edu.id}`)
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text hover:bg-bg-muted"
                        >
                          View Profile
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeactivate(edu.id, edu.full_name)
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

                {/* Clickable card body */}
                <button
                  onClick={() => navigate(`/admin/educator/${edu.id}`)}
                  className="w-full text-left"
                >
                {/* Avatar + Name */}
                <div className="flex items-center gap-3">
                  {edu.avatar_url ? (
                    <img
                      src={edu.avatar_url}
                      alt={edu.full_name}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100">
                      <span className="text-sm font-bold text-primary-700">
                        {initials}
                      </span>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-text">
                      {edu.full_name}
                    </p>
                    <p className="truncate text-xs text-text-muted">{edu.email}</p>
                  </div>
                </div>

                {/* Classrooms */}
                <div className="mt-3 flex flex-wrap gap-1">
                  {edu.classrooms.length === 0 ? (
                    <span className="rounded-full bg-bg-muted px-2 py-0.5 text-[10px] font-medium text-text-light">
                      No classrooms
                    </span>
                  ) : (
                    edu.classrooms.map((c) => (
                      <span
                        key={c.id}
                        className="rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-medium text-primary-700"
                      >
                        {c.name}
                      </span>
                    ))
                  )}
                </div>

                {/* Stats */}
                <div className="mt-3 flex items-center gap-4 text-xs text-text-muted">
                  <span className="flex items-center gap-1">
                    <ClipboardPen className="h-3.5 w-3.5" />
                    {edu.observations_this_month} this month
                  </span>
                  <span className="flex items-center gap-1">
                    <School className="h-3.5 w-3.5" />
                    {edu.total_observations} total
                  </span>
                </div>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
