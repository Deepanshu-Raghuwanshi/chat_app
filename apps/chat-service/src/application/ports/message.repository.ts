import { MessageEntity } from "../../domain/entities/message.entity";

export interface CreateMessageInput {
  conversationId: string;
  senderId: string;
  content: string;
  type: string;
}

export interface UpdateMessageInput {
  content?: string;
  isDeleted?: boolean;
  isEdited?: boolean;
}

export interface MessageRepository {
  findById(id: string): Promise<MessageEntity | null>;
  findByConversationId(
    conversationId: string,
    limit: number,
    before?: string,
  ): Promise<MessageEntity[]>;
  create(data: CreateMessageInput): Promise<MessageEntity>;
  update(id: string, data: UpdateMessageInput): Promise<MessageEntity>;
  countUnread(
    conversationId: string,
    since: Date,
    excludeSenderId: string,
  ): Promise<number>;
}
