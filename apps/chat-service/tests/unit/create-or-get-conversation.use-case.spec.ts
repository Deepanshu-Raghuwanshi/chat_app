import { expect } from "chai";
import * as sinon from "sinon";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { CreateOrGetConversationUseCase } from "../../src/application/use-cases/create-or-get-conversation.use-case";
import { ConversationRepository } from "../../src/application/ports/conversation.repository";
import { ConversationParticipantRepository } from "../../src/application/ports/conversation-participant.repository";
import { FriendshipVerifier } from "../../src/application/ports/friendship-verifier.port";
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

const stubView = {
  id: "conv1",
  participants: [],
  unreadCount: 0,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

describe("CreateOrGetConversationUseCase (Unit)", () => {
  let useCase: CreateOrGetConversationUseCase;
  let conversationRepoMock: Record<string, sinon.SinonStub>;
  let participantRepoMock: Record<string, sinon.SinonStub>;
  let friendshipVerifierMock: Record<string, sinon.SinonStub>;
  let viewBuilderMock: Record<string, sinon.SinonStub>;

  beforeEach(() => {
    conversationRepoMock = {
      findByParticipants: sinon.stub(),
      create: sinon.stub(),
    };
    participantRepoMock = {
      create: sinon.stub(),
      updateLastRead: sinon.stub().resolves(),
    };
    friendshipVerifierMock = {
      areFriends: sinon.stub(),
    };
    viewBuilderMock = {
      build: sinon.stub().resolves(stubView),
    };

    useCase = new CreateOrGetConversationUseCase(
      conversationRepoMock as unknown as ConversationRepository,
      participantRepoMock as unknown as ConversationParticipantRepository,
      friendshipVerifierMock as unknown as FriendshipVerifier,
      viewBuilderMock as unknown as ConversationViewBuilder,
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should throw BadRequestException when userId equals targetUserId", async () => {
    try {
      await useCase.execute({ userId: "user1", targetUserId: "user1" });
      expect.fail("Should have thrown BadRequestException");
    } catch (error) {
      expect(error).to.be.instanceOf(BadRequestException);
    }
  });

  it("should throw ForbiddenException when users are not friends", async () => {
    friendshipVerifierMock.areFriends.resolves(false);

    try {
      await useCase.execute({ userId: "user1", targetUserId: "user2" });
      expect.fail("Should have thrown ForbiddenException");
    } catch (error) {
      expect(error).to.be.instanceOf(ForbiddenException);
    }
  });

  it("should return existing conversation when one already exists", async () => {
    const existing = makeConversation();
    friendshipVerifierMock.areFriends.resolves(true);
    conversationRepoMock.findByParticipants.resolves(existing);

    const result = await useCase.execute({
      userId: "user1",
      targetUserId: "user2",
    });

    expect(result.isNew).to.equal(false);
    expect(result.conversation.id).to.equal("conv1");
    expect(conversationRepoMock.create.called).to.equal(false);
  });

  it("should create a new conversation when none exists", async () => {
    const newConv = makeConversation();
    friendshipVerifierMock.areFriends.resolves(true);
    conversationRepoMock.findByParticipants.resolves(null);
    conversationRepoMock.create.resolves(newConv);
    participantRepoMock.create.resolves(makeParticipant("user1"));

    const result = await useCase.execute({
      userId: "user1",
      targetUserId: "user2",
    });

    expect(result.isNew).to.equal(true);
    expect(result.conversation.id).to.equal("conv1");
    expect(conversationRepoMock.create.calledOnce).to.equal(true);
    expect(participantRepoMock.create.calledTwice).to.equal(true);
  });
});
