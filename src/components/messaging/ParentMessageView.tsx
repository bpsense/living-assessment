import ConversationView from './ConversationView'
import type { ConversationWithDetails } from '../../lib/messaging-data'

interface Props {
  conversation: ConversationWithDetails
  childName: string
}

/**
 * Read-only wrapper around ConversationView for parent family visibility.
 * Shows the child's conversation with a clear "viewing as parent" header
 * and disables the message input.
 */
export default function ParentMessageView({ conversation, childName }: Props) {
  return (
    <ConversationView
      conversation={conversation}
      isParentView={true}
      childName={childName}
    />
  )
}
