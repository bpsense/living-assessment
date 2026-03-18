import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Message } from '../types/database'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface UseRealtimeMessagesReturn {
  newMessages: Message[]
  isConnected: boolean
  clearNewMessages: () => void
}

/**
 * Subscribe to real-time message inserts for a conversation.
 * Returns new messages received after subscription, plus connection status.
 */
export function useRealtimeMessages(conversationId: string | null): UseRealtimeMessagesReturn {
  const [newMessages, setNewMessages] = useState<Message[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!conversationId) {
      setIsConnected(false)
      setNewMessages([])
      return
    }

    // Clean up previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const msg = payload.new as Message
          setNewMessages((prev) => [...prev, msg])
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED')
      })

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      setIsConnected(false)
    }
  }, [conversationId])

  const clearNewMessages = useCallback(() => {
    setNewMessages([])
  }, [])

  return { newMessages, isConnected, clearNewMessages }
}
