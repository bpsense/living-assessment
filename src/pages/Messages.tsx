import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../lib/auth'
import { Loader2, ArrowLeft, MessageCircle, Inbox, X } from 'lucide-react'
import ConversationList from '../components/messaging/ConversationList'
import ConversationView from '../components/messaging/ConversationView'
import NewConversationModal from '../components/messaging/NewConversationModal'
import {
  fetchConversations,
  fetchConversation,
  createAdminInboxThread,
  type ConversationWithDetails,
} from '../lib/messaging-data'
import { useToast } from '../components/Toast'

export default function Messages() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([])
  const [activeConversation, setActiveConversation] = useState<ConversationWithDetails | null>(null)
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showNewMessage, setShowNewMessage] = useState(false)
  const [showContactAdmin, setShowContactAdmin] = useState(false)
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

  const canContactAdmin = profile.role !== 'admin'

  return (
    <div className="mx-auto max-w-6xl">
      {canContactAdmin && (
        <div className="mb-3 flex justify-end">
          <button
            onClick={() => setShowContactAdmin(true)}
            className="flex items-center gap-1.5 rounded-lg bg-accent-50 px-3 py-1.5 text-xs font-medium text-accent-700 hover:bg-accent-100"
          >
            <Inbox className="h-3.5 w-3.5" />
            Contact admin
          </button>
        </div>
      )}

      <div className="glass-card overflow-hidden" style={{ height: 'calc(100vh - 140px)' }}>
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
                onMessageSent={loadConversations}
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
                  onMessageSent={loadConversations}
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

      {/* Contact admin modal */}
      {showContactAdmin && (
        <ContactAdminModal
          schoolId={profile.school_id}
          currentUserId={profile.id}
          onClose={() => setShowContactAdmin(false)}
          onCreated={(convId) => {
            setShowContactAdmin(false)
            handleConversationCreated(convId)
            toast('Sent to admin team', 'success')
          }}
        />
      )}
    </div>
  )
}

function ContactAdminModal({
  schoolId,
  currentUserId,
  onClose,
  onCreated,
}: {
  schoolId: string
  currentUserId: string
  onClose: () => void
  onCreated: (convId: string) => void
}) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!subject.trim() || !body.trim()) return
    setSending(true)
    setError(null)
    try {
      const id = await createAdminInboxThread(schoolId, currentUserId, subject.trim(), body.trim())
      onCreated(id)
    } catch (err) {
      setError((err as Error).message)
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-bg-card p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Inbox className="h-5 w-5 text-accent-600" />
            <h2 className="text-base font-semibold text-text">Contact your school admin team</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-text-light hover:bg-bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-3 text-xs text-text-muted">
          Your message goes to the shared admin inbox. Any school admin can read and respond.
        </p>
        <form onSubmit={handleSend} className="space-y-3">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            required
            className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What can the admin team help with?"
            required
            rows={5}
            className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none"
          />
          {error && <p className="text-xs text-alert-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-2 text-sm text-text-muted hover:bg-bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending || !subject.trim() || !body.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-accent-500 px-3 py-2 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-50"
            >
              {sending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
