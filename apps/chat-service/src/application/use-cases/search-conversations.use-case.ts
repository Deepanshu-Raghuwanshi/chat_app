import { Injectable, Inject } from "@nestjs/common";
import { ConversationParticipantRepository } from "../ports/conversation-participant.repository";
import { ConversationRepository } from "../ports/conversation.repository";
import { ConversationViewBuilder } from "../services/conversation-view.builder";
import { ConversationListView } from "../interfaces/conversation-view.interface";

export interface SearchConversationsDto {
  userId: string;
  q: string;
}

@Injectable()
export class SearchConversationsUseCase {
  constructor(
    @Inject("ConversationParticipantRepository")
    private readonly participantRepository: ConversationParticipantRepository,
    @Inject("ConversationRepository")
    private readonly conversationRepository: ConversationRepository,
    private readonly viewBuilder: ConversationViewBuilder,
  ) {}

  async execute(dto: SearchConversationsDto): Promise<ConversationListView> {
    const matchedIds =
      await this.participantRepository.findConversationIdsByParticipantName(
        dto.userId,
        dto.q,
      );

    if (matchedIds.length === 0) {
      return { data: [], hasMore: false };
    }

    const conversations =
      await this.conversationRepository.findByIds(matchedIds);

    const data = await Promise.all(
      conversations.map((c) => this.viewBuilder.build(c, dto.userId)),
    );

    return { data, hasMore: false };
  }
}
