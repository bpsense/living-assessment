import { supabase } from './supabase'
import type {
  Conversation,
  ConversationInsert,
  ConversationParticipant,
  ConversationParticipantInsert,
  Message,
  MessageInsert,
  ConversationType,
  Profile,
} from '../types/database'

// ============================================================
// Composite types for UI
// ============================================================

export interface ConversationWithDetails extends Conversation {
  participants: (ConversationParticipant & { profile: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'role'> })[]
  lastMessage: Message | null
  unreadCount: number
}

export interface MessageWithSender extends Message {
  sender: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'role'>
}

// ============================================================
// Fetch conversations
// ============================================================

/**
 * Fetch all conversations for the current user with last message + unread count.
 */
export async function fetchConversations(userId: string): Promise<ConversationWithDetails[]> {
  // Get conversations
  const { data: conversations, error: convErr } = await supabase
    .from('conversations')
    .select('*')
    .order('updated_at', { ascending: false })

  if (convErr) {
    console.error('[fetchConversations] query failed:', convErr.message)
    throw convErr
  }

  if (!conversations || conversations.length === 0) return []

  const convIds = conversations.map((c) => c.id)

  // Get participants for all conversations
  const { data: participants } = await supabase
    .from('conversation_participants')
    .select('*, profile:profiles(id, full_name, avatar_url, role)')
    .in('conversation_id', convIds)

  // Get last message for each conversation
  // We fetch the latest message per conversation
  const { data: allMessages } = await supabase
    .from('messages')
    .select('*')
    .in('conversation_id', convIds)
    .order('created_at', { ascending: false })

  // Get user's participation data for unread calculation
  const { data: myParticipation } = await supabase
    .from('conversation_participants')
    .select('conversation_id, last_read_at')
    .eq('user_id', userId)

  const myReadMap = new Map(
    (myParticipation || []).map((p) => [p.conversation_id, p.last_read_at])
  )

  // Group data
  const participantMap = new Map<string, typeof participants>()
  for (const p of participants || []) {
    const list = participantMap.get(p.conversation_id) || []
    list.push(p)
    participantMap.set(p.conversation_id, list)
  }

  // Get last message per conversation (first in descending order)
  const lastMessageMap = new Map<string, Message>()
  for (const m of allMessages || []) {
    if (!lastMessageMap.has(m.conversation_id)) {
      lastMessageMap.set(m.conversation_id, m)
    }
  }

  // Calculate unread counts
  const unreadCounts = new Map<string, number>()
  for (const m of allMessages || []) {
    const lastRead = myReadMap.get(m.conversation_id)
    if (!lastRead || new Date(m.created_at) > new Date(lastRead)) {
      if (m.sender_id !== userId) {
        unreadCounts.set(m.conversation_id, (unreadCounts.get(m.conversation_id) || 0) + 1)
      }
    }
  }

  return conversations.map((c) => ({
    ...c,
    participants: (participantMap.get(c.id) || []) as ConversationWithDetails['participants'],
    lastMessage: lastMessageMap.get(c.id) || null,
    unreadCount: unreadCounts.get(c.id) || 0,
  }))
}

/**
 * Fetch a single conversation with participants.
 */
export async function fetchConversation(conversationId: string): Promise<ConversationWithDetails | null> {
  const { data: conv, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .single()

  if (error || !conv) return null

  const { data: participants } = await supabase
    .from('conversation_participants')
    .select('*, profile:profiles(id, full_name, avatar_url, role)')
    .eq('conversation_id', conversationId)

  return {
    ...conv,
    participants: (participants || []) as ConversationWithDetails['participants'],
    lastMessage: null,
    unreadCount: 0,
  }
}

// ============================================================
// Fetch messages (paginated)
// ============================================================

/**
 * Fetch messages for a conversation with sender details.
 * Returns newest first, use cursor for pagination.
 */
export async function fetchMessages(
  conversationId: string,
  limit = 50,
  before?: string
): Promise<MessageWithSender[]> {
  let query = supabase
    .from('messages')
    .select('*, sender:profiles!messages_sender_id_fkey(id, full_name, avatar_url, role)')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (before) {
    query = query.lt('created_at', before)
  }

  const { data, error } = await query

  if (error) {
    console.error('[fetchMessages] query failed:', error.message)
    throw error
  }

  return (data || []).map((m: any) => ({
    ...m,
    sender: m.sender || { id: m.sender_id, full_name: 'Unknown', avatar_url: null, role: 'learner' },
  }))
}

// ============================================================
// Send message
// ============================================================

export async function sendMessage(conversationId: string, content: string, senderId: string): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content,
    } as MessageInsert)
    .select()
    .single()

  if (error) throw new Error(`Failed to send message: ${error.message}`)

  // Update conversation's updated_at to bubble it to the top of the list
  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId)

  return data
}

// ============================================================
// Create conversations
// ============================================================

/**
 * Create or find an existing direct conversation between two users.
 */
export async function createDirectConversation(
  otherUserId: string,
  currentUserId: string,
  schoolId: string
): Promise<string> {
  // Check for existing direct conversation between these two users
  const { data: myConvIds } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', currentUserId)

  if (myConvIds && myConvIds.length > 0) {
    const convIds = myConvIds.map((c) => c.conversation_id)

    const { data: otherInMyConvs } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', otherUserId)
      .in('conversation_id', convIds)

    if (otherInMyConvs && otherInMyConvs.length > 0) {
      // Check if any of these are direct conversations
      const sharedConvIds = otherInMyConvs.map((c) => c.conversation_id)
      const { data: directConvs } = await supabase
        .from('conversations')
        .select('id')
        .in('id', sharedConvIds)
        .eq('conversation_type', 'direct')
        .limit(1)

      if (directConvs && directConvs.length > 0) {
        return directConvs[0].id
      }
    }
  }

  // Create new direct conversation
  const { data: conv, error: convErr } = await supabase
    .from('conversations')
    .insert({
      school_id: schoolId,
      conversation_type: 'direct' as ConversationType,
      created_by: currentUserId,
    } as ConversationInsert)
    .select('id')
    .single()

  if (convErr || !conv) throw new Error(`Failed to create conversation: ${convErr?.message}`)

  // Add both participants
  const { error: partErr } = await supabase
    .from('conversation_participants')
    .insert([
      { conversation_id: conv.id, user_id: currentUserId } as ConversationParticipantInsert,
      { conversation_id: conv.id, user_id: otherUserId } as ConversationParticipantInsert,
    ])

  if (partErr) throw new Error(`Failed to add participants: ${partErr.message}`)

  return conv.id
}

/**
 * Create a group conversation.
 */
export async function createGroupConversation(
  title: string,
  participantIds: string[],
  currentUserId: string,
  schoolId: string
): Promise<string> {
  const { data: conv, error: convErr } = await supabase
    .from('conversations')
    .insert({
      school_id: schoolId,
      conversation_type: 'group' as ConversationType,
      title,
      created_by: currentUserId,
    } as ConversationInsert)
    .select('id')
    .single()

  if (convErr || !conv) throw new Error(`Failed to create group: ${convErr?.message}`)

  const allParticipants = [...new Set([currentUserId, ...participantIds])]
  const inserts: ConversationParticipantInsert[] = allParticipants.map((uid) => ({
    conversation_id: conv.id,
    user_id: uid,
    role: uid === currentUserId ? 'moderator' : 'member',
  }))

  const { error: partErr } = await supabase
    .from('conversation_participants')
    .insert(inserts)

  if (partErr) throw new Error(`Failed to add participants: ${partErr.message}`)

  return conv.id
}

/**
 * Create a class conversation for a classroom.
 * Auto-populates with active students + the creating educator.
 */
export async function createClassConversation(
  classroomId: string,
  classroomName: string,
  currentUserId: string,
  schoolId: string
): Promise<string> {
  // Check for existing class conversation
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('classroom_id', classroomId)
    .eq('conversation_type', 'class')
    .limit(1)

  if (existing && existing.length > 0) return existing[0].id

  // Create new class conversation
  const { data: conv, error: convErr } = await supabase
    .from('conversations')
    .insert({
      school_id: schoolId,
      conversation_type: 'class' as ConversationType,
      title: `${classroomName} Class Chat`,
      classroom_id: classroomId,
      created_by: currentUserId,
    } as ConversationInsert)
    .select('id')
    .single()

  if (convErr || !conv) throw new Error(`Failed to create class conversation: ${convErr?.message}`)

  // Get active students in classroom who have learner profiles
  const { data: students } = await supabase
    .from('students')
    .select('id')
    .eq('classroom_id', classroomId)
    .eq('student_status', 'active')

  const { data: learnerProfiles } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'learner')
    .eq('school_id', schoolId)
    .in('student_id', (students || []).map((s) => s.id))

  const participantIds = [
    currentUserId,
    ...(learnerProfiles || []).map((p) => p.id),
  ]
  const uniqueParticipantIds = [...new Set(participantIds)]

  const inserts: ConversationParticipantInsert[] = uniqueParticipantIds.map((uid) => ({
    conversation_id: conv.id,
    user_id: uid,
    role: uid === currentUserId ? 'moderator' : 'member',
  }))

  if (inserts.length > 0) {
    const { error: partErr } = await supabase
      .from('conversation_participants')
      .insert(inserts)

    if (partErr) console.error('[createClassConversation] Failed to add participants:', partErr.message)
  }

  return conv.id
}

// ============================================================
// Conversation management
// ============================================================

/**
 * Mark a conversation as read (update last_read_at for current user).
 */
export async function markConversationRead(conversationId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('conversation_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)

  if (error) console.error('[markConversationRead] failed:', error.message)
}

/**
 * Flag a message for moderation.
 */
export async function flagMessage(messageId: string, flaggedBy: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ is_flagged: true, flagged_by: flaggedBy })
    .eq('id', messageId)

  if (error) throw new Error(`Failed to flag message: ${error.message}`)
}

// ============================================================
// Parent-specific queries
// ============================================================

/**
 * Fetch conversations visible to a parent through their linked children.
 * Returns read-only view data for the parent dashboard.
 */
export async function fetchParentConversations(parentId: string): Promise<ConversationWithDetails[]> {
  // Use the same fetch but RLS will filter automatically
  // Parents see: their own conversations + children's conversations
  return fetchConversations(parentId)
}

// ============================================================
// User search for new conversations
// ============================================================

/**
 * Search for users in the school that can be messaged.
 */
export async function searchMessagingUsers(
  schoolId: string,
  query: string,
  excludeUserId: string
): Promise<Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'role'>[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, role')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .neq('id', excludeUserId)
    .ilike('full_name', `%${query}%`)
    .in('role', ['learner', 'educator', 'admin'])
    .order('full_name')
    .limit(20)

  if (error) {
    console.error('[searchMessagingUsers] query failed:', error.message)
    return []
  }

  return data || []
}
