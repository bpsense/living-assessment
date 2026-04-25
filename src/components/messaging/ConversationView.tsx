import { useState, useEffect, useRef, useCallback } from 'react'
import { format } from 'date-fns'
import { Send, Loader2, Flag, ChevronUp, Eye, Shield, Inbox } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import {
  fetchMessages,
  sendMessage,
  markConversationRead,
  flagMessage,
  claimAdminInboxThread,
  type MessageWithSender,
  type ConversationWithDetails,
} from '../../lib/messaging-data'
import { useRealtimeMessages } from '../../hooks/useRealtimeMessages'

interface Props {
  conversation: ConversationWithDetails
  isParentView?: boolean
  childName?: string
  onMessageSent?: () => void
}

export default function ConversationView({ conversation, isParentView = false, childName, onMessageSent }: Props) {
  const { profile } = useAuth()
  const [messages, setMessages] = useState<MessageWithSender[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [input, setInput] = useState('')
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const { newMessages, clearNewMessages } = useRealtimeMessages(conversation.id)

  // Load initial messages
  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const msgs = await fetchMessages(conversation.id, 50)
        setMessages(msgs.reverse()) // oldest first for display
        setHasMore(msgs.length === 50)
      } catch (err) {
        console.error('Failed to load messages:', err)
      }
      setLoading(false)
    }
    load()
    clearNewMessages()
  }, [conversation.id, clearNewMessages])

  // Handle realtime messages
  useEffect(() => {
    if (newMessages.length === 0) return

    const newMsgs: MessageWithSender[] = newMessages.map((m) => {
      const participant = conversation.participants.find((p) => p.user_id === m.sender_id)
      return {
        ...m,
        sender: participant?.profile || {
          id: m.sender_id,
          full_name: 'Unknown',
          avatar_url: null,
          role: 'learner' as const,
        },
      }
    })

    setMessages((prev) => {
      // Deduplicate by ID
      const existingIds = new Set(prev.map((m) => m.id))
      const unique = newMsgs.filter((m) => !existingIds.has(m.id))
      return [...prev, ...unique]
    })

    clearNewMessages()
  }, [newMessages, conversation.participants, clearNewMessages])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Mark as read
  useEffect(() => {
    if (profile && !isParentView) {
      markConversationRead(conversation.id, profile.id)
    }
  }, [conversation.id, profile, isParentView, messages.length])

  // Load older messages
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || messages.length === 0) return
    setLoadingMore(true)
    try {
      const oldest = messages[0]?.created_at
      const older = await fetchMessages(conversation.id, 50, oldest)
      if (older.length < 50) setHasMore(false)
      setMessages((prev) => [...older.reverse(), ...prev])
    } catch (err) {
      console.error('Failed to load more messages:', err)
    }
    setLoadingMore(false)
  }, [conversation.id, messages, hasMore, loadingMore])

  // Send message — optimistically add to local state so it appears immediately
  async function handleSend() {
    if (!input.trim() || !profile || sending) return
    const messageText = input.trim()
    setSending(true)
    setInput('')
    try {
      const sentMsg = await sendMessage(conversation.id, messageText, profile.id)
      // Build the MessageWithSender from the returned message + current profile
      const msgWithSender: MessageWithSender = {
        ...sentMsg,
        sender: {
          id: profile.id,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url ?? null,
          role: profile.role,
        },
      }
      // Add to local messages (dedup in case realtime already delivered it)
      setMessages((prev) => {
        if (prev.some((m) => m.id === sentMsg.id)) return prev
        return [...prev, msgWithSender]
      })
      // Notify parent to refresh conversation list (last message, ordering)
      onMessageSent?.()
    } catch (err) {
      console.error('Failed to send message:', err)
      // Restore input so user doesn't lose their message
      setInput(messageText)
    }
    setSending(false)
  }

  // Handle flag
  async function handleFlag(messageId: string) {
    if (!profile) return
    try {
      await flagMessage(messageId, profile.id)
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, is_flagged: true, flagged_by: profile.id } : m))
      )
    } catch (err) {
      console.error('Failed to flag message:', err)
    }
  }

  const isLearnerConversation = conversation.participants.some(
    (p) => p.profile?.role === 'learner'
  )

  const canModerate = profile?.role === 'educator' || profile?.role === 'admin'
  const canSend = !isParentView

  return (
    <div className="flex h-full flex-col bg-bg-secondary">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-bg-muted bg-bg-card px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            {conversation.title ||
              conversation.participants
                .filter((p) => p.user_id !== profile?.id)
                .map((p) => p.profile?.full_name)
                .join(', ') ||
              'Conversation'}
          </h3>
          <p className="text-xs text-text-muted">
            {conversation.participants.length} participant{conversation.participants.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Parent view banner */}
      {isParentView && childName && (
        <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 text-xs text-blue-700">
          <Eye className="h-3.5 w-3.5 shrink-0" />
          <span>Viewing <strong>{childName}</strong>'s messages — read-only family visibility</span>
        </div>
      )}

      {/* Admin inbox claim banner */}
      {conversation.conversation_type === 'admin_inbox' && (
        <AdminInboxBanner
          conversationId={conversation.id}
          assignedTo={conversation.admin_assigned_to ?? null}
          assignedName={
            conversation.participants.find((p) => p.user_id === conversation.admin_assigned_to)?.profile?.full_name
            ?? null
          }
          currentUserId={profile?.id ?? null}
          isAdmin={profile?.role === 'admin'}
          onChanged={() => onMessageSent?.()}
        />
      )}

      {/* Family visibility reminder for learner conversations */}
      {!isParentView && isLearnerConversation && profile?.role === 'learner' && (
        <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 text-xs text-amber-700">
          <Shield className="h-3.5 w-3.5 shrink-0" />
          <span>Family visible — your linked family members can see these messages</span>
        </div>
      )}

      {/* Messages area */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
          </div>
        ) : (
          <>
            {/* Load more */}
            {hasMore && (
              <div className="mb-4 text-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
                >
                  {loadingMore ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <ChevronUp className="h-3 w-3" />
                  )}
                  Load older messages
                </button>
              </div>
            )}

            {/* Message list */}
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-sm text-text-muted">No messages yet</p>
                {canSend && (
                  <p className="mt-1 text-xs text-text-muted">Send the first message!</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    isOwn={msg.sender_id === profile?.id}
                    canModerate={canModerate}
                    onFlag={() => handleFlag(msg.id)}
                  />
                ))}
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input area */}
      {canSend ? (
        <div className="border-t border-bg-muted bg-bg-card px-4 py-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="Type a message…"
              className="flex-1 rounded-xl border border-bg-muted bg-bg-secondary px-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary-300 focus:outline-none focus:ring-1 focus:ring-primary-300"
              disabled={sending}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="rounded-xl bg-primary-500 px-4 py-2 text-white hover:bg-primary-600 disabled:opacity-50 transition-colors"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="border-t border-bg-muted bg-blue-50 px-4 py-3 text-center text-xs text-blue-600">
          Read-only — Family visibility mode
        </div>
      )}
    </div>
  )
}

function MessageBubble({
  message,
  isOwn,
  canModerate,
  onFlag,
}: {
  message: MessageWithSender
  isOwn: boolean
  canModerate: boolean
  onFlag: () => void
}) {
  const [showActions, setShowActions] = useState(false)

  return (
    <div
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className={`max-w-[80%] ${isOwn ? 'items-end' : 'items-start'}`}>
        {/* Sender name (not for own messages) */}
        {!isOwn && (
          <div className="mb-0.5 flex items-center gap-1.5 px-1">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-bg-muted text-[10px] font-bold text-text-muted">
              {message.sender.full_name?.charAt(0).toUpperCase() || '?'}
            </div>
            <span className="text-xs font-medium text-text-muted">
              {message.sender.full_name}
            </span>
          </div>
        )}

        <div className="relative">
          <div
            className={`rounded-2xl px-4 py-2 text-sm ${
              message.is_flagged
                ? 'border border-amber-300 bg-amber-50 text-amber-800'
                : isOwn
                  ? 'bg-primary-500 text-white'
                  : 'bg-bg-card border border-bg-muted text-text-primary'
            }`}
          >
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          </div>

          {/* Actions */}
          {showActions && canModerate && !message.is_flagged && (
            <button
              onClick={onFlag}
              className="absolute -right-1 -top-1 rounded-full bg-bg-card p-1 shadow-sm border border-bg-muted hover:bg-amber-50 transition-colors"
              title="Flag this message"
            >
              <Flag className="h-3 w-3 text-text-muted hover:text-amber-600" />
            </button>
          )}
        </div>

        {/* Timestamp */}
        <p className={`mt-0.5 text-[10px] text-text-muted ${isOwn ? 'text-right' : 'text-left'} px-1`}>
          {format(new Date(message.created_at), 'h:mm a')}
          {message.is_flagged && ' · Flagged'}
        </p>
      </div>
    </div>
  )
}

// ============================================================
// Admin inbox claim/release banner
// ============================================================

function AdminInboxBanner({
  conversationId,
  assignedTo,
  assignedName,
  currentUserId,
  isAdmin,
  onChanged,
}: {
  conversationId: string
  assignedTo: string | null
  assignedName: string | null
  currentUserId: string | null
  isAdmin: boolean
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)

  async function set(adminId: string | null) {
    setBusy(true)
    try {
      await claimAdminInboxThread(conversationId, adminId)
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  const claimedByMe = assignedTo && assignedTo === currentUserId
  const claimedBySomeoneElse = assignedTo && !claimedByMe

  return (
    <div className="flex items-center justify-between gap-3 bg-accent-50 px-4 py-2 text-xs text-accent-700">
      <div className="flex items-center gap-2">
        <Inbox className="h-3.5 w-3.5 shrink-0" />
        {!assignedTo && <span>Unclaimed admin inbox thread</span>}
        {claimedByMe && <span>Claimed by you</span>}
        {claimedBySomeoneElse && (
          <span>Claimed by <strong>{assignedName ?? 'another admin'}</strong></span>
        )}
      </div>
      {isAdmin && (
        <div className="flex items-center gap-2">
          {!assignedTo && (
            <button
              onClick={() => set(currentUserId)}
              disabled={busy}
              className="rounded-full bg-accent-100 px-2.5 py-0.5 text-[11px] font-medium text-accent-700 hover:bg-accent-200 disabled:opacity-50"
            >
              Claim
            </button>
          )}
          {claimedByMe && (
            <button
              onClick={() => set(null)}
              disabled={busy}
              className="rounded-full bg-accent-100 px-2.5 py-0.5 text-[11px] font-medium text-accent-700 hover:bg-accent-200 disabled:opacity-50"
            >
              Release
            </button>
          )}
          {claimedBySomeoneElse && (
            <button
              onClick={() => set(currentUserId)}
              disabled={busy}
              className="rounded-full bg-accent-100 px-2.5 py-0.5 text-[11px] font-medium text-accent-700 hover:bg-accent-200 disabled:opacity-50"
            >
              Take over
            </button>
          )}
        </div>
      )}
    </div>
  )
}
