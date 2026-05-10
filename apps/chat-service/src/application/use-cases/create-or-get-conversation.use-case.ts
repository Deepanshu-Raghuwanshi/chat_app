import {
  Injectable,
  Inject,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { ConversationRepository } from "../ports/conversation.repository";
import { ConversationParticipantRepository } from "../ports/conversation-participant.repository";
import { FriendshipVerifier } from "../ports/friendship-verifier.port";
import { ConversationView } from "../interfaces/conversation-view.interface";
import { ConversationViewBuilder } from "../services/conversation-view.builder";

export interface CreateOrGetConversationDto {
  userId: string;
  targetUserId: string;
  // Optional profile hints supplied by the client to avoid a round-trip to
  // user-service. Both caller and target fall back to their userId when absent.
  callerUsername?: string;
  callerFullName?: string;
  callerAvatarUrl?: string;
  targetUsername?: string;
  targetFullName?: string;
  targetAvatarUrl?: string;
}

export interface CreateOrGetConversationResult {
  conversation: ConversationView;
  isNew: boolean;
}

@Injectable()
export class CreateOrGetConversationUseCase {
  constructor(
    @Inject("ConversationRepository")
    private readonly conversationRepository: ConversationRepository,
    @Inject("ConversationParticipantRepository")
    private readonly participantRepository: ConversationParticipantRepository,
    @Inject("FriendshipVerifier")
    private readonly friendshipVerifier: FriendshipVerifier,
    private readonly viewBuilder: ConversationViewBuilder,
  ) {}

  async execute(
    dto: CreateOrGetConversationDto,
  ): Promise<CreateOrGetConversationResult> {
    const { userId, targetUserId } = dto;

    if (userId === targetUserId) {
      throw new BadRequestException(
        "You cannot start a conversation with yourself",
      );
    }

    const areFriends = await this.friendshipVerifier.areFriends(
      userId,
      targetUserId,
    );
    if (!areFriends) {
      throw new ForbiddenException(
        "You can only start conversations with friends",
      );
    }

    const existing = await this.conversationRepository.findByParticipants(
      userId,
      targetUserId,
    );
    if (existing) {
      await Promise.all([
        this.participantRepository.updateProfile({
          conversationId: existing.id,
          userId,
          username: dto.callerUsername,
          fullName: dto.callerFullName,
          avatarUrl: dto.callerAvatarUrl,
        }),
        this.participantRepository.updateProfile({
          conversationId: existing.id,
          userId: targetUserId,
          username: dto.targetUsername,
          fullName: dto.targetFullName,
          avatarUrl: dto.targetAvatarUrl,
        }),
      ]);
      return {
        conversation: await this.viewBuilder.build(existing, userId),
        isNew: false,
      };
    }

    const [p1Id, p2Id] = [userId, targetUserId].sort();
    const conversation = await this.conversationRepository.create({
      participant1Id: p1Id,
      participant2Id: p2Id,
    });

    const now = new Date();
    await Promise.all([
      this.participantRepository.create({
        conversationId: conversation.id,
        userId,
        username: dto.callerUsername ?? userId,
        fullName: dto.callerFullName,
        avatarUrl: dto.callerAvatarUrl,
      }),
      this.participantRepository.create({
        conversationId: conversation.id,
        userId: targetUserId,
        username: dto.targetUsername ?? targetUserId,
        fullName: dto.targetFullName,
        avatarUrl: dto.targetAvatarUrl,
      }),
    ]);

    await Promise.all([
      this.participantRepository.updateLastRead(conversation.id, userId, now),
      this.participantRepository.updateLastRead(
        conversation.id,
        targetUserId,
        now,
      ),
    ]);

    return {
      conversation: await this.viewBuilder.build(conversation, userId),
      isNew: true,
    };
  }
}
