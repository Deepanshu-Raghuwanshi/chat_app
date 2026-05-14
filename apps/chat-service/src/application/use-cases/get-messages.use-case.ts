import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { ConversationRepository } from "../ports/conversation.repository";
import { ConversationParticipantRepository } from "../ports/conversation-participant.repository";
import { MessageRepository } from "../ports/message.repository";
import {
  MessageListView,
  MessageView,
} from "../interfaces/conversation-view.interface";
import { MessageEntity } from "../../domain/entities/message.entity";
import { KafkaProducerService } from "../../infrastructure/messaging/kafka-producer.service";
import {
  ChatTopics,
  MessageDeliveredEventV1,
  MessageStatus,
} from "@kafka-events";
import { toMessageView } from "../mappers/message.mapper";

export interface GetMessagesDto {
  userId: string;
  conversationId: string;
  limit?: number;
  before?: string;
}

@Injectable()
export class GetMessagesUseCase {
  private readonly logger = new Logger(GetMessagesUseCase.name);

  constructor(
    @Inject("ConversationRepository")
    private readonly conversationRepository: ConversationRepository,
    @Inject("ConversationParticipantRepository")
    private readonly participantRepository: ConversationParticipantRepository,
    @Inject("MessageRepository")
    private readonly messageRepository: MessageRepository,
    private readonly kafkaProducer: KafkaProducerService,
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

    const otherUserId =
      conversation.participant1Id === dto.userId
        ? conversation.participant2Id
        : conversation.participant1Id;

    const limit = dto.limit ?? 50;
    const messages = await this.messageRepository.findByConversationId(
      dto.conversationId,
      limit + 1,
      dto.before,
    );

    const hasMore = messages.length > limit;
    const page = messages.slice(0, limit);

    // Identify SENT messages from the other participant to mark as DELIVERED in-memory
    const sentFromOther = new Set(
      page
        .filter(
          (m) => m.senderId === otherUserId && m.status === MessageStatus.SENT,
        )
        .map((m) => m.id),
    );

    // Fire-and-forget: persist DELIVERED status + emit Kafka event
    if (sentFromOther.size > 0) {
      this.messageRepository
        .updateStatusBySender(
          dto.conversationId,
          otherUserId,
          [MessageStatus.SENT],
          MessageStatus.DELIVERED,
        )
        .then((count) => {
          if (count > 0) {
            return this.kafkaProducer.emit(ChatTopics.MESSAGE_DELIVERED, {
              conversationId: dto.conversationId,
              senderId: otherUserId,
              recipientId: dto.userId,
              deliveredAt: new Date().toISOString(),
            } satisfies MessageDeliveredEventV1);
          }
        })
        .catch((err) =>
          this.logger.error("Failed to update delivery status", err),
        );
    }

    return {
      data: page.map((m) => {
        const view = this.toView(m);
        return sentFromOther.has(m.id)
          ? { ...view, status: MessageStatus.DELIVERED }
          : view;
      }),
      data: page.map((m) => toMessageView(m)),
      hasMore,
      nextCursor: hasMore ? page[page.length - 1].id : undefined,
    };
  }
}
