import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { ConversationRepository } from "../ports/conversation.repository";
import { ConversationParticipantRepository } from "../ports/conversation-participant.repository";
import { MessageRepository } from "../ports/message.repository";
import {
  MessageListView,
  MessageView,
} from "../interfaces/conversation-view.interface";
import { MessageEntity } from "../../domain/entities/message.entity";

export interface GetMessagesDto {
  userId: string;
  conversationId: string;
  limit?: number;
  before?: string;
}

@Injectable()
export class GetMessagesUseCase {
  constructor(
    @Inject("ConversationRepository")
    private readonly conversationRepository: ConversationRepository,
    @Inject("ConversationParticipantRepository")
    private readonly participantRepository: ConversationParticipantRepository,
    @Inject("MessageRepository")
    private readonly messageRepository: MessageRepository,
  ) {}

  async execute(dto: GetMessagesDto): Promise<MessageListView> {
    const conversation = await this.conversationRepository.findById(
      dto.conversationId,
    );
    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    const participant =
      await this.participantRepository.findByConversationAndUser(
        dto.conversationId,
        dto.userId,
      );
    if (!participant) {
      throw new ForbiddenException(
        "You are not a participant in this conversation",
      );
    }

    const limit = dto.limit ?? 50;
    const messages = await this.messageRepository.findByConversationId(
      dto.conversationId,
      limit + 1,
      dto.before,
    );

    const hasMore = messages.length > limit;
    const page = messages.slice(0, limit);

    return {
      data: page.map((m) => this.toView(m)),
      hasMore,
      nextCursor: hasMore ? page[page.length - 1].id : undefined,
    };
  }

  private toView(message: MessageEntity): MessageView {
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      content: message.content,
      type: message.type,
      status: message.status,
      isDeleted: message.isDeleted,
      isEdited: message.isEdited,
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt.toISOString(),
    };
  }
}
