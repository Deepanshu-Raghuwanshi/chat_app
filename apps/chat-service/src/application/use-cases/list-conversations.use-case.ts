import { Injectable, Inject } from "@nestjs/common";
import { ConversationRepository } from "../ports/conversation.repository";
import { FriendshipVerifier } from "../ports/friendship-verifier.port";
import { ConversationListView } from "../interfaces/conversation-view.interface";
import { ConversationViewBuilder } from "../services/conversation-view.builder";

export interface ListConversationsDto {
  userId: string;
  limit?: number;
  before?: string;
}

@Injectable()
export class ListConversationsUseCase {
  constructor(
    @Inject("ConversationRepository")
    private readonly conversationRepository: ConversationRepository,
    @Inject("FriendshipVerifier")
    private readonly friendshipVerifier: FriendshipVerifier,
    private readonly viewBuilder: ConversationViewBuilder,
  ) {}

  async execute(dto: ListConversationsDto): Promise<ConversationListView> {
    const limit = dto.limit ?? 20;
    const raw = await this.conversationRepository.findByUserId(
      dto.userId,
      limit + 1,
      dto.before,
    );

    const friendshipChecks = await Promise.all(
      raw.map((c) => {
        const otherId =
          c.participant1Id === dto.userId ? c.participant2Id : c.participant1Id;
        return this.friendshipVerifier.areFriends(dto.userId, otherId);
      }),
    );
    const conversations = raw.filter((_, i) => friendshipChecks[i]);

    const hasMore = conversations.length > limit;
    const page = conversations.slice(0, limit);

    const data = await Promise.all(
      page.map((c) => this.viewBuilder.build(c, dto.userId)),
    );

    return {
      data,
      hasMore,
      nextCursor: hasMore ? page[page.length - 1].id : undefined,
    };
  }
}
