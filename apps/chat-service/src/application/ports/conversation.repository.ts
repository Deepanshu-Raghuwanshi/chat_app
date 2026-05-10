import {
  ConversationEntity,
  LastMessageSnapshot,
} from "../../domain/entities/conversation.entity";

export interface CreateConversationInput {
  participant1Id: string;
  participant2Id: string;
}

export interface ConversationRepository {
  findById(id: string): Promise<ConversationEntity | null>;
  findByParticipants(
    userId1: string,
    userId2: string,
  ): Promise<ConversationEntity | null>;
  findByUserId(
    userId: string,
    limit: number,
    before?: string,
  ): Promise<ConversationEntity[]>;
  findByIds(ids: string[]): Promise<ConversationEntity[]>;
  create(data: CreateConversationInput): Promise<ConversationEntity>;
  updateLastMessage(id: string, snapshot: LastMessageSnapshot): Promise<void>;
}
