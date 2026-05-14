import { MessageEntity } from "../../domain/entities/message.entity";
import { MessageView } from "../interfaces/conversation-view.interface";

export function toMessageView(message: MessageEntity): MessageView {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    content: message.content,
    type: message.type,
    status: message.status,
    isDeleted: message.isDeleted,
    isEdited: message.isEdited,
    reactions: message.reactions.map((r) => ({
      emoji: r.emoji,
      userId: r.userId,
      createdAt: r.createdAt.toISOString(),
    })),
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
  };
}
