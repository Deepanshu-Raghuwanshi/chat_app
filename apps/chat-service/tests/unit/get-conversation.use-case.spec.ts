import { expect } from "chai";
import * as sinon from "sinon";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { GetConversationUseCase } from "../../src/application/use-cases/get-conversation.use-case";
import { ConversationRepository } from "../../src/application/ports/conversation.repository";
import { ConversationParticipantRepository } from "../../src/application/ports/conversation-participant.repository";
import { ConversationViewBuilder } from "../../src/application/services/conversation-view.builder";
import { ConversationEntity } from "../../src/domain/entities/conversation.entity";
import { ConversationParticipantEntity } from "../../src/domain/entities/conversation-participant.entity";

function makeConversation(): ConversationEntity {
  return ConversationEntity.create({
    id: "conv1",
    participant1Id: "user1",
    participant2Id: "user2",
    lastActivityAt: new Date("2024-01-01"),
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  });
}

function makeParticipant(userId: string): ConversationParticipantEntity {
  return ConversationParticipantEntity.create({
    id: `part-${userId}`,
    conversationId: "conv1",
    userId,
    username: `${userId}-name`,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  });
}

describe("GetConversationUseCase (Unit)", () => {
  let useCase: GetConversationUseCase;
  let conversationRepoMock: Record<string, sinon.SinonStub>;
  let participantRepoMock: Record<string, sinon.SinonStub>;
  let viewBuilderMock: Record<string, sinon.SinonStub>;

  beforeEach(() => {
    conversationRepoMock = { findById: sinon.stub() };
    participantRepoMock = {
      findByConversationAndUser: sinon.stub(),
    };
    viewBuilderMock = { build: sinon.stub() };

    useCase = new GetConversationUseCase(
      conversationRepoMock as unknown as ConversationRepository,
      participantRepoMock as unknown as ConversationParticipantRepository,
      viewBuilderMock as unknown as ConversationViewBuilder,
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should return conversation view for a valid participant", async () => {
    const conversation = makeConversation();
    const view = {
      id: "conv1",
      participants: [makeParticipant("user1"), makeParticipant("user2")],
      unreadCount: 2,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };

    conversationRepoMock.findById.resolves(conversation);
    participantRepoMock.findByConversationAndUser.resolves(
      makeParticipant("user1"),
    );
    viewBuilderMock.build.resolves(view);

    const result = await useCase.execute({
      userId: "user1",
      conversationId: "conv1",
    });

    expect(result.id).to.equal("conv1");
    expect(result.unreadCount).to.equal(2);
    expect(viewBuilderMock.build.calledOnce).to.equal(true);
  });

  it("should throw NotFoundException when conversation does not exist", async () => {
    conversationRepoMock.findById.resolves(null);

    try {
      await useCase.execute({ userId: "user1", conversationId: "conv1" });
      expect.fail("Should have thrown NotFoundException");
    } catch (error) {
      expect(error).to.be.instanceOf(NotFoundException);
    }
  });

  it("should throw ForbiddenException when requester is not a participant", async () => {
    conversationRepoMock.findById.resolves(makeConversation());
    participantRepoMock.findByConversationAndUser.resolves(null);

    try {
      await useCase.execute({ userId: "user1", conversationId: "conv1" });
      expect.fail("Should have thrown ForbiddenException");
    } catch (error) {
      expect(error).to.be.instanceOf(ForbiddenException);
    }
  });
});
