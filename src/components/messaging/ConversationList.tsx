import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Search, Plus, Users, User, MessageCircle, Hash, Eye, Inbox } from 'lucide-react'
import type { ConversationWithDetails } from '../../lib/messaging-data'

interface Props {
  conversations: ConversationWithDetails[]
  activeConversationId: string | null
  currentUserId: string
  isParent?: boolean
  onSelect: (conversationId: string) => void
  onNewMessage: () => void
}

export default function ConversationList({
  conversations,
  activeConversationId,
  currentUserId,
  isParent = false,
  onSelect,
  onNewMessage,
}: Props) {
  const [search, setSearch] = useState('')

  const filtered = conversations.filter((c) => {
    if (!search.trim()) return true
    const label = getConversationLabel(c, currentUserId).toLowerCase()
    return label.includes(search.toLowerCase())
  })

  // Split conversations for parent view
  const ownConversations = filtered.filter((c) => !c.isChildConversation)
  const childConversations = filtered.filter((c) => c.isChildConversation)

  return (
    <div className="flex h-full flex-col border-r border-bg-muted bg-bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-bg-muted px-4 py-3">
        <h2 className="text-base font-bold text-text-primary">Messages</h2>
        <button
          onClick={onNewMessage}
          className="rounded-lg bg-primary-500 p-2 text-white hover:bg-primary-600 transition-colors"
          title="New conversation"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search conversations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-bg-muted bg-bg-secondary py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-primary-300 focus:outline-none focus:ring-1 focus:ring-primary-300"
          />
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageCircle className="mb-2 h-8 w-8 text-text-muted" />
            <p className="text-sm text-text-muted">
              {search ? 'No conversations match your search' : 'No conversations yet'}
            </p>
            {!search && (
              <button
                onClick={onNewMessage}
                className="mt-2 text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                Start your first conversation
              </button>
            )}
          </div>
        ) : isParent ? (
          <>
            {/* Parent's own conversations */}
            {ownConversations.length > 0 && (
              <>
                <div className="px-4 pt-3 pb-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                    My Conversations
                  </h3>
                </div>
                {ownConversations.map((conv) => (
                  <ConversationRow
                    key={conv.id}
                    conversation={conv}
                    isActive={conv.id === activeConversationId}
                    currentUserId={currentUserId}
                    onClick={() => onSelect(conv.id)}
                  />
                ))}
              </>
            )}

            {/* Children's conversations (read-only) */}
            {childConversations.length > 0 && (
              <>
                <div className="px-4 pt-4 pb-1">
                  <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
                    <Eye className="h-3 w-3" />
                    Learner Messages
                  </h3>
                </div>
                {childConversations.map((conv) => (
                  <ConversationRow
                    key={conv.id}
                    conversation={conv}
                    isActive={conv.id === activeConversationId}
                    currentUserId={currentUserId}
                    isReadOnly
                    onClick={() => onSelect(conv.id)}
                  />
                ))}
              </>
            )}

            {/* Empty state for own section when parent has no own conversations */}
            {ownConversations.length === 0 && childConversations.length > 0 && (
              <div className="px-4 py-3 text-center">
                <button
                  onClick={onNewMessage}
                  className="text-xs font-medium text-primary-600 hover:text-primary-700"
                >
                  + Start a conversation with an educator
                </button>
              </div>
            )}
          </>
        ) : (
          filtered.map((conv) => (
            <ConversationRow
              key={conv.id}
              conversation={conv}
              isActive={conv.id === activeConversationId}
              currentUserId={currentUserId}
              onClick={() => onSelect(conv.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}

function ConversationRow({
  conversation,
  isActive,
  currentUserId,
  isReadOnly,
  onClick,
}: {
  conversation: ConversationWithDetails
  isActive: boolean
  currentUserId: string
  isReadOnly?: boolean
  onClick: () => void
}) {
  const label = getConversationLabel(conversation, currentUserId)
  const preview = conversation.lastMessage?.content || 'No messages yet'
  const time = conversation.lastMessage?.created_at
    ? formatDistanceToNow(new Date(conversation.lastMessage.created_at), { addSuffix: true })
    : ''
  const unread = conversation.unreadCount

  const icon =
    conversation.conversation_type === 'class' ? (
      <Hash className="h-4 w-4" />
    ) : conversation.conversation_type === 'group' ? (
      <Users className="h-4 w-4" />
    ) : conversation.conversation_type === 'admin_inbox' ? (
      <Inbox className="h-4 w-4" />
    ) : (
      <User className="h-4 w-4" />
    )

  const isAdminInbox = conversation.conversation_type === 'admin_inbox'

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
        isActive
          ? 'bg-primary-50 border-l-2 border-primary-500'
          : 'hover:bg-bg-secondary border-l-2 border-transparent'
      }`}
    >
      {/* Avatar */}
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
          isActive ? 'bg-primary-100 text-primary-700' : 'bg-bg-muted text-text-muted'
        }`}
      >
        {icon}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            {isAdminInbox && (
              <span className="rounded-full bg-accent-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-accent-700">
                Inbox
              </span>
            )}
            <span className={`text-sm font-medium truncate ${unread > 0 ? 'text-text-primary' : 'text-text-secondary'}`}>
              {label}
            </span>
          </div>
          <div className="ml-2 flex shrink-0 items-center gap-1">
            {isReadOnly && (
              <Eye className="h-3 w-3 text-blue-400" aria-label="Read-only — learner messages" />
            )}
            {time && (
              <span className="text-xs text-text-muted">{time}</span>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className={`text-xs truncate ${unread > 0 ? 'font-medium text-text-secondary' : 'text-text-muted'}`}>
            {preview}
          </p>
          {unread > 0 && (
            <span className="ml-2 shrink-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-500 px-1.5 text-xs font-bold text-white">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

/**
 * Generate display label for a conversation.
 */
function getConversationLabel(conv: ConversationWithDetails, currentUserId: string): string {
  if (conv.title) return conv.title

  if (conv.conversation_type === 'direct') {
    const otherParticipant = conv.participants.find((p) => p.user_id !== currentUserId)
    return otherParticipant?.profile?.full_name || 'Unknown'
  }

  // Group: list participant names
  const names = conv.participants
    .filter((p) => p.user_id !== currentUserId)
    .map((p) => p.profile?.full_name || 'Unknown')
    .slice(0, 3)

  if (names.length === 0) return 'Empty conversation'
  if (conv.participants.length > 4) return `${names.join(', ')} +${conv.participants.length - 4}`
  return names.join(', ')
}
