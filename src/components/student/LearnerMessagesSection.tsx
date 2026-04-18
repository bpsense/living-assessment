import { useState, useEffect } from 'react'
import { Loader2, MessageCircle, Eye, ArrowLeft } from 'lucide-react'
import { fetchLearnerConversations, type ConversationWithDetails } from '../../lib/messaging-data'
import ConversationView from '../messaging/ConversationView'
import { formatDistanceToNow } from 'date-fns'

interface Props {
  studentId: string
  parentId: string
  childName: string
}

export default function LearnerMessagesSection({ studentId, parentId, childName }: Props) {
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedConv, setSelectedConv] = useState<ConversationWithDetails | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const convs = await fetchLearnerConversations(parentId, studentId)
        setConversations(convs)
      } catch (err) {
        console.error('Failed to load learner conversations:', err)
      }
      setLoading(false)
    }
    load()
  }, [parentId, studentId])

  if (loading) {
    return (
      <section>
        <div className="glass-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Eye className="h-5 w-5 text-blue-500" />
            <h2 className="text-lg font-bold text-text">Messages</h2>
          </div>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
          </div>
        </div>
      </section>
    )
  }

  if (conversations.length === 0) {
    return (
      <section>
        <div className="glass-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Eye className="h-5 w-5 text-blue-500" />
            <h2 className="text-lg font-bold text-text">Messages</h2>
          </div>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <MessageCircle className="mb-2 h-8 w-8 text-text-muted" />
            <p className="text-sm text-text-muted">No messages yet for {childName}</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section>
      <div className="glass-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-bg-muted px-5 py-3">
          {selectedConv && (
            <button
              onClick={() => setSelectedConv(null)}
              className="rounded-lg p-1 text-text-muted hover:bg-bg-secondary md:hidden"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <Eye className="h-5 w-5 text-blue-500" />
          <h2 className="text-lg font-bold text-text">Messages</h2>
          <span className="ml-auto rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
            Read-only
          </span>
        </div>

        {/* Two-panel layout at md+, stacked on mobile */}
        <div className="flex" style={{ height: '400px' }}>
          {/* Conversation list panel */}
          <div
            className={`w-full border-r border-bg-muted md:w-64 md:shrink-0 md:block overflow-y-auto ${
              selectedConv ? 'hidden md:block' : ''
            }`}
          >
            {conversations.map((conv) => {
              const label =
                conv.title ||
                conv.participants
                  .map((p) => p.profile?.full_name)
                  .filter(Boolean)
                  .join(', ') ||
                'Conversation'
              const preview = conv.lastMessage?.content || 'No messages yet'
              const time = conv.lastMessage?.created_at
                ? formatDistanceToNow(new Date(conv.lastMessage.created_at), { addSuffix: true })
                : ''
              const isActive = selectedConv?.id === conv.id

              return (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConv(conv)}
                  className={`flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors ${
                    isActive
                      ? 'bg-primary-50 border-l-2 border-primary-500'
                      : 'hover:bg-bg-secondary border-l-2 border-transparent'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-text-primary truncate">
                        {label}
                      </span>
                      {time && (
                        <span className="ml-1 shrink-0 text-[10px] text-text-muted">{time}</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-text-muted truncate">{preview}</p>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Chat panel */}
          <div
            className={`flex-1 ${
              !selectedConv ? 'hidden md:flex' : 'flex'
            } flex-col`}
          >
            {selectedConv ? (
              <ConversationView
                conversation={selectedConv}
                isParentView={true}
                childName={childName}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center px-4">
                <MessageCircle className="mb-2 h-8 w-8 text-text-muted" />
                <p className="text-sm text-text-muted">
                  Select a conversation to view {childName}'s messages
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
