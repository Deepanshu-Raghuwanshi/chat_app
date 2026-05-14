import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { ConversationRepository } from "../ports/conversation.repository";
import { ConversationParticipantRepository } from "../ports/conversation-participant.repository";
import { MessageRepository } from "../ports/message.repository";
import { KafkaProducerService } from "../../infrastructure/messaging/kafka-producer.service";
import { MessageView } from "../interfaces/conversation-view.interface";
import { toMessageView } from "../mappers/message.mapper";
import { ChatTopics, MessageReactionToggledEventV1 } from "@kafka-events";

export interface ToggleReactionInput {
  userId: string;
  conversationId: string;
  messageId: string;
  emoji: string;
}

@Injectable()
export class ToggleReactionUseCase {
  constructor(
    @Inject("ConversationRepository")
    private readonly conversationRepository: ConversationRepository,
    @Inject("ConversationParticipantRepository")
    private readonly participantRepository: ConversationParticipantRepository,
    @Inject("MessageRepository")
    private readonly messageRepository: MessageRepository,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  async execute(dto: ToggleReactionInput): Promise<MessageView> {
    const { userId, conversationId, messageId, emoji } = dto;

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

    const message = await this.messageRepository.findById(messageId);
    if (!message || message.conversationId !== conversationId) {
      throw new NotFoundException("Message not found");
    }

    if (message.isDeleted) {
      throw new BadRequestException("Cannot react to a deleted message");
    }

    const updatedMessage = await this.messageRepository.toggleReaction(
      messageId,
      emoji,
      userId,
    );

    const action = updatedMessage.reactions.some(
      (r) => r.emoji === emoji && r.userId === userId,
    )
      ? "added"
      : "removed";

    await this.kafkaProducer.emit(ChatTopics.MESSAGE_REACTION_TOGGLED, {
      messageId,
      conversationId,
      senderId: message.senderId,
      reactorId: userId,
      emoji,
      action,
      toggledAt: new Date().toISOString(),
    } satisfies MessageReactionToggledEventV1);

    return toMessageView(updatedMessage);
  }
}
