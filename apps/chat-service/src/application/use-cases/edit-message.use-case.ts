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
import { toMessageView } from "../mappers/message.mapper";
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

    return toMessageView(updated);
  }
}
