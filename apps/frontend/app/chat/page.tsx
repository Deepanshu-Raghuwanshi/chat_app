import { ChatLayout } from "../../src/features/chat/components/ChatLayout";
import { EmptyConversationState } from "../../src/features/chat/components/EmptyConversationState";

export default function ChatPage() {
  return (
    <ChatLayout>
      <EmptyConversationState />
    </ChatLayout>
  );
}
