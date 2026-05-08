import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { ConversationRepository } from "../ports/conversation.repository";
import { ConversationParticipantRepository } from "../ports/conversation-participant.repository";
import { ConversationView } from "../interfaces/conversation-view.interface";
import { ConversationViewBuilder } from "../services/conversation-view.builder";

export interface GetConversationDto {
  userId: string;
  conversationId: string;
}

@Injectable()
export class GetConversationUseCase {
  constructor(
    @Inject("ConversationRepository")
    private readonly conversationRepository: ConversationRepository,
    @Inject("ConversationParticipantRepository")
    private readonly participantRepository: ConversationParticipantRepository,
    private readonly viewBuilder: ConversationViewBuilder,
  ) {}

  async execute(dto: GetConversationDto): Promise<ConversationView> {
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

    return this.viewBuilder.build(conversation, dto.userId);
  }
}
