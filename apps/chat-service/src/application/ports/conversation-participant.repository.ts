import { ConversationParticipantEntity } from "../../domain/entities/conversation-participant.entity";

export interface CreateParticipantInput {
  conversationId: string;
  userId: string;
  username: string;
  fullName?: string;
  avatarUrl?: string;
}

export interface UpdateParticipantProfileInput {
  conversationId: string;
  userId: string;
  username?: string;
  fullName?: string;
  avatarUrl?: string;
}

export interface UpdateParticipantProfileByUserInput {
  userId: string;
  username?: string;
  fullName?: string;
  avatarUrl?: string;
}

export interface ConversationParticipantRepository {
  findByConversationAndUser(
    conversationId: string,
    userId: string,
  ): Promise<ConversationParticipantEntity | null>;
  findByConversationId(
    conversationId: string,
  ): Promise<ConversationParticipantEntity[]>;
  create(data: CreateParticipantInput): Promise<ConversationParticipantEntity>;
  updateLastRead(
    conversationId: string,
    userId: string,
    lastReadAt: Date,
  ): Promise<void>;
  updateProfile(data: UpdateParticipantProfileInput): Promise<void>;
  updateProfileByUserId(data: UpdateParticipantProfileByUserInput): Promise<void>;
  findConversationIdsByParticipantName(
    userId: string,
    query: string,
  ): Promise<string[]>;
}
