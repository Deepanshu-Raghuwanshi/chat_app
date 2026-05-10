import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { ConversationRepository } from "../ports/conversation.repository";
import { ConversationParticipantRepository } from "../ports/conversation-participant.repository";
import { KafkaProducerService } from "../../infrastructure/messaging/kafka-producer.service";
import { ChatTopics, MessageReadEventV1 } from "@kafka-events";

export interface MarkConversationReadDto {
  userId: string;
  conversationId: string;
}

export interface MarkConversationReadResult {
  lastReadAt: string;
}

@Injectable()
export class MarkConversationReadUseCase {
  constructor(
    @Inject("ConversationRepository")
    private readonly conversationRepository: ConversationRepository,
    @Inject("ConversationParticipantRepository")
    private readonly participantRepository: ConversationParticipantRepository,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  async execute(
    dto: MarkConversationReadDto,
  ): Promise<MarkConversationReadResult> {
    const { userId, conversationId } = dto;

    const conversation =
      await this.conversationRepository.findById(conversationId);
    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    const participant =
      await this.participantRepository.findByConversationAndUser(
        conversationId,
        userId,
      );
    if (!participant) {
      throw new ForbiddenException(
        "You are not a participant in this conversation",
      );
    }

    const now = new Date();
    await this.participantRepository.updateLastRead(
      conversationId,
      userId,
      now,
    );

    await this.kafkaProducer.emit(ChatTopics.MESSAGE_READ, {
      conversationId,
      readerId: userId,
      senderId: '',
      lastReadAt: now.toISOString(),
    } satisfies MessageReadEventV1);

    return { lastReadAt: now.toISOString() };
  }
}
