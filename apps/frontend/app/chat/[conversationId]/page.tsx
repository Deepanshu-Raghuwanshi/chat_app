"use client";

import { useParams } from "next/navigation";
import { ChatLayout } from "../../../src/features/chat/components/ChatLayout";
import { ConversationView } from "../../../src/features/chat/components/ConversationView";

export default function ConversationPage() {
  const { conversationId } = useParams();

  return (
    <ChatLayout>
      <ConversationView conversationId={conversationId as string} />
    </ChatLayout>
  );
}
