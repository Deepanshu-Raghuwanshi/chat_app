import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { MessageRepository } from "../ports/message.repository";
import { KafkaProducerService } from "../../infrastructure/messaging/kafka-producer.service";
import { MessageView } from "../interfaces/conversation-view.interface";
import { MessageEntity } from "../../domain/entities/message.entity";
import { ChatTopics, MessageEditedEventV1 } from "@kafka-events";

export interface EditMessageDto {
  userId: string;
  conversationId: string;
  messageId: string;
  content: string;
}

@Injectable()
export class EditMessageUseCase {
  constructor(
    @Inject("MessageRepository")
    private readonly messageRepository: MessageRepository,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  async execute(dto: EditMessageDto): Promise<MessageView> {
    const { userId, messageId, content } = dto;

    const message = await this.messageRepository.findById(messageId);
    if (!message || message.conversationId !== dto.conversationId) {
      throw new NotFoundException("Message not found");
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException("You can only edit your own messages");
    }

    if (message.isDeleted) {
      throw new BadRequestException("Cannot edit a deleted message");
    }

    const updated = await this.messageRepository.update(messageId, {
      content: content.trim(),
      isEdited: true,
    });

    await this.kafkaProducer.emit(ChatTopics.MESSAGE_EDITED, {
      messageId: updated.id,
      conversationId: updated.conversationId,
      senderId: userId,
      content: content.trim(),
      editedAt: updated.updatedAt.toISOString(),
    } satisfies MessageEditedEventV1);

    return this.toView(updated);
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
      reactions: message.reactions.map((r) => ({
        emoji: r.emoji,
        userId: r.userId,
        createdAt: r.createdAt.toISOString(),
      })),
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt.toISOString(),
    };
  }
}
