import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { Bell } from 'lucide-react'
import { useUnreadIncidentNotifications, markNotificationRead } from '../../lib/incident-data'

const NOTIF_LABELS: Record<string, string> = {
  new_incident: 'New incident reported',
  assigned: 'You have been assigned to an incident',
  follow_up: 'New follow-up on an incident',
  status_change: 'Incident status changed',
}

interface Props {
  profileId: string
}

export default function NotificationBell({ profileId }: Props) {
  const navigate = useNavigate()
  const { count, notifications, refetch } = useUnreadIncidentNotifications(profileId)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    const interval = setInterval(refetch, 30000)
    return () => clearInterval(interval)
  }, [refetch])

  // Close on click outside
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function handleClick(notifId: string, incidentId: string) {
    await markNotificationRead(notifId)
    refetch()
    setOpen(false)
    navigate(`/incident/${incidentId}`)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-1.5 text-text-light transition-colors hover:bg-bg-muted hover:text-text"
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-alert-500 px-1 text-[9px] font-bold text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="glass-modal absolute right-0 top-full z-50 mt-2 w-80 rounded-xl">
          <div className="border-b border-bg-muted px-4 py-3">
            <h3 className="text-sm font-semibold text-text">Notifications</h3>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-text-light">No new notifications</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n.id, n.incident_report_id)}
                  className="flex w-full items-start gap-3 border-b border-bg-muted px-4 py-3 text-left transition-colors last:border-0 hover:bg-bg-muted/30"
                >
                  <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-alert-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text">
                      {NOTIF_LABELS[n.notification_type] ?? 'Notification'}
                    </p>
                    <p className="text-[11px] text-text-light">
                      {format(new Date(n.created_at), 'MMM d, h:mm a')}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
