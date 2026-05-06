import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { MessageRepository } from "../ports/message.repository";
import { KafkaProducerService } from "../../infrastructure/messaging/kafka-producer.service";
import { MessageView } from "../interfaces/conversation-view.interface";
import { MessageEntity } from "../../domain/entities/message.entity";
import { ChatTopics, MessageDeletedEventV1 } from "@kafka-events";

export interface DeleteMessageDto {
  userId: string;
  conversationId: string;
  messageId: string;
}

@Injectable()
export class DeleteMessageUseCase {
  constructor(
    @Inject("MessageRepository")
    private readonly messageRepository: MessageRepository,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  async execute(dto: DeleteMessageDto): Promise<MessageView> {
    const { userId, messageId } = dto;

    const message = await this.messageRepository.findById(messageId);
    if (!message || message.conversationId !== dto.conversationId) {
      throw new NotFoundException("Message not found");
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException("You can only delete your own messages");
    }

    const deleted = await this.messageRepository.update(messageId, {
      content: "[deleted]",
      isDeleted: true,
    });

    await this.kafkaProducer.emit(ChatTopics.MESSAGE_DELETED, {
      messageId: deleted.id,
      conversationId: deleted.conversationId,
      senderId: userId,
      deletedAt: deleted.updatedAt.toISOString(),
    } satisfies MessageDeletedEventV1);

    return this.toView(deleted);
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
