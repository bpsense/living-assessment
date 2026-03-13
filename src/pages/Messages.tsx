import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../lib/auth'
import { Loader2, ArrowLeft, MessageCircle } from 'lucide-react'
import ConversationList from '../components/messaging/ConversationList'
import ConversationView from '../components/messaging/ConversationView'
import NewConversationModal from '../components/messaging/NewConversationModal'
import {
  fetchConversations,
  fetchConversation,
  type ConversationWithDetails,
} from '../lib/messaging-data'

export default function Messages() {
  const { profile } = useAuth()
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([])
  const [activeConversation, setActiveConversation] = useState<ConversationWithDetails | null>(null)
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showNewMessage, setShowNewMessage] = useState(false)
  const [mobileShowChat, setMobileShowChat] = useState(false)

  // Load conversations
  const loadConversations = useCallback(async () => {
    if (!profile) return
    try {
      const convs = await fetchConversations(profile.id)
      setConversations(convs)
    } catch (err) {
      console.error('Failed to load conversations:', err)
    }
    setLoading(false)
  }, [profile])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  // Load active conversation details
  useEffect(() => {
    if (!activeConvId) {
      setActiveConversation(null)
      return
    }

    async function load() {
      const conv = await fetchConversation(activeConvId!)
      setActiveConversation(conv)
    }
    load()
  }, [activeConvId])

  function handleSelectConversation(convId: string) {
    setActiveConvId(convId)
    setMobileShowChat(true)
  }

  function handleConversationCreated(convId: string) {
    setActiveConvId(convId)
    setMobileShowChat(true)
    loadConversations()
  }

  function handleBackToList() {
    setMobileShowChat(false)
    setActiveConvId(null)
    setActiveConversation(null)
  }

  if (!profile) return null

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    )
  }

  // Check if parent is viewing a child's conversation
  const isParentViewingChildConv =
    profile.role === 'parent' &&
    activeConversation &&
    !activeConversation.participants.some((p) => p.user_id === profile.id)

  return (
    <div className="mx-auto max-w-6xl">
      <div className="overflow-hidden rounded-xl border border-bg-muted bg-bg-card shadow-sm" style={{ height: 'calc(100vh - 140px)' }}>
        {/* Desktop: two-panel layout */}
        <div className="hidden h-full md:flex">
          {/* Left panel - conversation list */}
          <div className="w-80 shrink-0">
            <ConversationList
              conversations={conversations}
              activeConversationId={activeConvId}
              currentUserId={profile.id}
              isParent={profile.role === 'parent'}
              onSelect={handleSelectConversation}
              onNewMessage={() => setShowNewMessage(true)}
            />
          </div>

          {/* Right panel - conversation view */}
          <div className="flex-1">
            {activeConversation ? (
              <ConversationView
                conversation={activeConversation}
                isParentView={isParentViewingChildConv || false}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <MessageCircle className="mb-3 h-12 w-12 text-text-muted" />
                <h3 className="text-base font-semibold text-text-secondary">
                  Select a conversation
                </h3>
                <p className="mt-1 text-sm text-text-muted">
                  Choose from your conversations or start a new one
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Mobile: stack layout */}
        <div className="flex h-full flex-col md:hidden">
          {mobileShowChat && activeConversation ? (
            <>
              {/* Back button */}
              <div className="flex items-center gap-2 border-b border-bg-muted bg-bg-card px-3 py-2">
                <button
                  onClick={handleBackToList}
                  className="rounded-lg p-1 text-text-muted hover:bg-bg-secondary"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <span className="text-sm font-medium text-text-primary truncate">
                  {activeConversation.title ||
                    activeConversation.participants
                      .filter((p) => p.user_id !== profile.id)
                      .map((p) => p.profile?.full_name)
                      .join(', ')}
                </span>
              </div>
              <div className="flex-1">
                <ConversationView
                  conversation={activeConversation}
                  isParentView={isParentViewingChildConv || false}
                />
              </div>
            </>
          ) : (
            <ConversationList
              conversations={conversations}
              activeConversationId={activeConvId}
              currentUserId={profile.id}
              isParent={profile.role === 'parent'}
              onSelect={handleSelectConversation}
              onNewMessage={() => setShowNewMessage(true)}
            />
          )}
        </div>
      </div>

      {/* New conversation modal */}
      {showNewMessage && (
        <NewConversationModal
          open={showNewMessage}
          schoolId={profile.school_id}
          currentUserId={profile.id}
          userRole={profile.role}
          onClose={() => setShowNewMessage(false)}
          onCreated={handleConversationCreated}
        />
      )}
    </div>
  )
}
