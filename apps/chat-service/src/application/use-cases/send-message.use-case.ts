import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { ConversationRepository } from "../ports/conversation.repository";
import { ConversationParticipantRepository } from "../ports/conversation-participant.repository";
import { MessageRepository, ReplyToInput } from "../ports/message.repository";
import { FriendshipVerifier } from "../ports/friendship-verifier.port";
import { KafkaProducerService } from "../../infrastructure/messaging/kafka-producer.service";
import { MessageView } from "../interfaces/conversation-view.interface";
import { toMessageView } from "../mappers/message.mapper";
import { ChatTopics, MessageSentEventV1, MessageType } from "@kafka-events";

export interface SendMessageDto {
  userId: string;
  conversationId: string;
  content: string;
  type?: string;
  quotedMessageId?: string;
}

@Injectable()
export class SendMessageUseCase {
  constructor(
    @Inject("ConversationRepository")
    private readonly conversationRepository: ConversationRepository,
    @Inject("ConversationParticipantRepository")
    private readonly participantRepository: ConversationParticipantRepository,
    @Inject("MessageRepository")
    private readonly messageRepository: MessageRepository,
    @Inject("FriendshipVerifier")
    private readonly friendshipVerifier: FriendshipVerifier,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  async execute(dto: SendMessageDto): Promise<MessageView> {
    const { userId, conversationId, content } = dto;

    if (!content || content.trim().length === 0) {
      throw new BadRequestException("Message content cannot be empty");
    }

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

    const receiverId =
      conversation.participant1Id === userId
        ? conversation.participant2Id
        : conversation.participant1Id;

    const areFriends = await this.friendshipVerifier.areFriends(
      userId,
      receiverId,
    );
    if (!areFriends) {
      throw new ForbiddenException("You can no longer message this user");
    }

    let replyTo: ReplyToInput | undefined;

    if (dto.quotedMessageId) {
      const quoted = await this.messageRepository.findById(dto.quotedMessageId);
      if (!quoted || quoted.conversationId !== conversationId) {
        throw new NotFoundException("Quoted message not found");
      }
      if (quoted.isDeleted) {
        throw new BadRequestException("Cannot reply to a deleted message");
      }
      replyTo = {
        messageId: quoted.id,
        senderId: quoted.senderId,
        content: quoted.content.slice(0, 200),
      };
    }

    const message = await this.messageRepository.create({
      conversationId,
      senderId: userId,
      content: content.trim(),
      type: dto.type ?? MessageType.TEXT,
      replyTo,
    });

    await this.conversationRepository.updateLastMessage(conversationId, {
      messageId: message.id,
      senderId: userId,
      content: content.trim(),
      sentAt: message.createdAt,
    });

    await this.kafkaProducer.emit(ChatTopics.MESSAGE_SENT, {
      messageId: message.id,
      conversationId,
      senderId: userId,
      receiverId,
      content: content.trim(),
      type: (dto.type ?? MessageType.TEXT) as MessageType,
      sentAt: message.createdAt.toISOString(),
      ...(replyTo ? { replyTo } : {}),
    } satisfies MessageSentEventV1);

    return toMessageView(message);
  }
}
