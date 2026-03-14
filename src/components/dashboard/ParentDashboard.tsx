import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, ArrowRight, Sparkles, Plus, MessageCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import MiniBlob from './MiniBlob'
import LinkStudentModal from './LinkStudentModal'
import { useAuth } from '../../lib/auth'
import { fetchParentConversations, type ConversationWithDetails } from '../../lib/messaging-data'
import type { ParentDashboardData } from '../../lib/dashboard-data'

interface Props {
  data: ParentDashboardData
  userName: string
  /** Hide the "Add a Learner" button (e.g. when viewed by an admin) */
  hideAddLearner?: boolean
}

export default function ParentDashboard({ data, userName, hideAddLearner }: Props) {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const firstName = userName.split(' ')[0]
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [recentMessages, setRecentMessages] = useState<ConversationWithDetails[]>([])

  useEffect(() => {
    if (!profile?.id) return
    fetchParentConversations(profile.id)
      .then((convs) => {
        // Sort by last message time and take top 5
        const withMessages = convs
          .filter((c) => c.lastMessage)
          .sort(
            (a, b) =>
              new Date(b.lastMessage!.created_at).getTime() -
              new Date(a.lastMessage!.created_at).getTime()
          )
          .slice(0, 5)
        setRecentMessages(withMessages)
      })
      .catch((err) => console.error('[ParentDashboard] Messages fetch failed:', err))
  }, [profile?.id])

  const currentPeriod = new Date().toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="space-y-8">
      {/* ---- Greeting ---- */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            See how your child{data.children.length > 1 ? 'ren are' : ' is'}{' '}
            doing this period.
          </p>
        </div>
        {!hideAddLearner && (
          <button
            onClick={() => setShowLinkModal(true)}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-600"
          >
            <Plus className="h-4 w-4" />
            Add a Learner
          </button>
        )}
      </div>

      {/* ---- Survey Prompts ---- */}
      {data.surveyPrompts.length > 0 && (
        <section className="space-y-2">
          {data.surveyPrompts.map((prompt) => (
            <div
              key={prompt.studentId}
              className="flex items-center gap-3 rounded-xl border border-accent-200 bg-gradient-to-r from-accent-50 to-accent-50/50 px-5 py-4 shadow-sm"
            >
              <Sparkles className="h-5 w-5 shrink-0 text-accent-500" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text">
                  It's time for {prompt.studentName}'s interest check-in!
                </p>
                <p className="mt-0.5 text-xs text-text-muted">
                  Ask their teacher to set up the survey on a shared device.
                </p>
              </div>
              <button
                onClick={() => navigate(`/student/${prompt.studentId}`)}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-accent-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent-600"
              >
                <ClipboardList className="h-3.5 w-3.5" />
                View Profile
              </button>
            </div>
          ))}
        </section>
      )}

      {/* ---- Recent Messages ---- */}
      <section className="rounded-xl border border-bg-muted bg-bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-bg-muted px-5 py-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary-600" />
            <h2 className="text-sm font-bold text-text">Recent Messages</h2>
          </div>
          <button
            onClick={() => navigate('/messages')}
            className="flex items-center gap-1 text-xs font-medium text-primary-600 transition-colors hover:text-primary-700"
          >
            View All Messages <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {recentMessages.length === 0 ? (
          <div className="px-5 py-6 text-center">
            <MessageCircle className="mx-auto mb-2 h-8 w-8 text-text-light" />
            <p className="text-sm text-text-muted">No messages yet</p>
          </div>
        ) : (
          <div className="divide-y divide-bg-muted">
            {recentMessages.map((conv) => {
              const otherParticipants = conv.participants.filter(
                (p) => p.user_id !== profile?.id
              )
              const label =
                conv.conversation_type === 'class'
                  ? conv.title || 'Class Chat'
                  : conv.conversation_type === 'group'
                    ? conv.title || 'Group Chat'
                    : otherParticipants[0]?.profile?.full_name || 'Conversation'
              const senderName =
                conv.lastMessage?.sender_id === profile?.id
                  ? 'You'
                  : conv.participants.find((p) => p.user_id === conv.lastMessage?.sender_id)
                      ?.profile?.full_name?.split(' ')[0] || 'Someone'
              const preview =
                conv.lastMessage?.content && conv.lastMessage.content.length > 60
                  ? conv.lastMessage.content.slice(0, 60) + '…'
                  : conv.lastMessage?.content || ''

              return (
                <button
                  key={conv.id}
                  onClick={() => navigate('/messages')}
                  className="flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-bg"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100">
                    <MessageCircle className="h-4 w-4 text-primary-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-text">{label}</span>
                      {conv.lastMessage && (
                        <span className="shrink-0 text-[10px] text-text-light">
                          {formatDistanceToNow(new Date(conv.lastMessage.created_at), {
                            addSuffix: true,
                          })}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-text-muted">
                      {senderName}: {preview}
                    </p>
                  </div>
                  {conv.unreadCount > 0 && (
                    <span className="mt-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary-500 px-1.5 text-[10px] font-bold text-white">
                      {conv.unreadCount}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </section>

      {/* ---- Child Cards ---- */}
      {data.children.length === 0 ? (
        <div className="rounded-xl border border-bg-muted bg-bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-50">
            <Plus className="h-6 w-6 text-primary-500" />
          </div>
          <p className="text-sm font-medium text-text">
            No learners linked yet
          </p>
          <p className="mt-1 text-xs text-text-muted">
            Use the code provided by your school to link your child to this account.
          </p>
          {!hideAddLearner && (
            <button
              onClick={() => setShowLinkModal(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-600"
            >
              <Plus className="h-4 w-4" />
              Add a Learner
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {data.children.map(({ student, classroom_name, dimensionScores }) => {
            const initials =
              `${student.first_name[0]}${student.last_name[0]}`.toUpperCase()
            const hasScores = dimensionScores.some(
              (d) => d.competency > 0 || d.interest > 0
            )

            return (
              <div
                key={student.id}
                className="rounded-xl border border-bg-muted bg-bg-card shadow-sm"
              >
                {/* Student info header */}
                <div className="flex items-center gap-4 border-b border-bg-muted px-5 pt-5 pb-4">
                  {student.avatar_url ? (
                    <img
                      src={student.avatar_url}
                      alt={`${student.first_name} ${student.last_name}`}
                      className="h-14 w-14 rounded-full border-2 border-bg-muted object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-100">
                      <span className="text-lg font-bold text-primary-700">
                        {initials}
                      </span>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold text-text">
                      {student.first_name} {student.last_name}
                    </h3>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-muted">
                      {classroom_name && <span>{classroom_name}</span>}
                      {student.grade_level && (
                        <>
                          <span className="text-text-light">&middot;</span>
                          <span>Grade {student.grade_level}</span>
                        </>
                      )}
                    </div>
                    <span className="mt-1 inline-block rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-medium text-primary-700">
                      {currentPeriod}
                    </span>
                  </div>
                </div>

                {/* Mini blob chart */}
                <div className="flex justify-center px-5 py-3">
                  {hasScores ? (
                    <div>
                      <div className="mb-1 flex items-center justify-center gap-4 text-[10px] text-text-light">
                        <span className="flex items-center gap-1">
                          <span className="inline-block h-2 w-2 rounded-full bg-primary-500" />
                          Competency
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="inline-block h-2 w-2 rounded-full bg-accent-500" />
                          Interest
                        </span>
                      </div>
                      <MiniBlob dimensionScores={dimensionScores} />
                    </div>
                  ) : (
                    <div className="flex h-[180px] items-center justify-center">
                      <p className="text-center text-xs text-text-light">
                        No assessment data yet
                      </p>
                    </div>
                  )}
                </div>

                {/* Action */}
                <div className="border-t border-bg-muted px-5 py-3">
                  <button
                    onClick={() => navigate(`/student/${student.id}`)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-600"
                  >
                    View Full Profile
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ---- Link Student Modal ---- */}
      {showLinkModal && (
        <LinkStudentModal
          onClose={() => setShowLinkModal(false)}
          onLinked={() => data.refetch()}
        />
      )}
    </div>
  )
}
