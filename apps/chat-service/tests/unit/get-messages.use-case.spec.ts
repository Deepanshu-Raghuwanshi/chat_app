import { expect } from "chai";
import * as sinon from "sinon";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { GetMessagesUseCase } from "../../src/application/use-cases/get-messages.use-case";
import { ConversationRepository } from "../../src/application/ports/conversation.repository";
import { ConversationParticipantRepository } from "../../src/application/ports/conversation-participant.repository";
import { MessageRepository } from "../../src/application/ports/message.repository";
import { ConversationEntity } from "../../src/domain/entities/conversation.entity";
import { ConversationParticipantEntity } from "../../src/domain/entities/conversation-participant.entity";
import { MessageEntity } from "../../src/domain/entities/message.entity";

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

function makeMessage(id: string): MessageEntity {
  return MessageEntity.create({
    id,
    conversationId: "conv1",
    senderId: "user1",
    content: `message ${id}`,
    type: "TEXT",
    status: "SENT",
    isDeleted: false,
    isEdited: false,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  });
}

describe("GetMessagesUseCase (Unit)", () => {
  let useCase: GetMessagesUseCase;
  let conversationRepoMock: Record<string, sinon.SinonStub>;
  let participantRepoMock: Record<string, sinon.SinonStub>;
  let messageRepoMock: Record<string, sinon.SinonStub>;

  beforeEach(() => {
    conversationRepoMock = {
      findById: sinon.stub(),
    };
    participantRepoMock = {
      findByConversationAndUser: sinon.stub(),
    };
    messageRepoMock = {
      findByConversationId: sinon.stub(),
    };

    useCase = new GetMessagesUseCase(
      conversationRepoMock as unknown as ConversationRepository,
      participantRepoMock as unknown as ConversationParticipantRepository,
      messageRepoMock as unknown as MessageRepository,
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should return paginated messages for a valid participant", async () => {
    conversationRepoMock.findById.resolves(makeConversation());
    participantRepoMock.findByConversationAndUser.resolves(
      makeParticipant("user1"),
    );
    messageRepoMock.findByConversationId.resolves([
      makeMessage("msg1"),
      makeMessage("msg2"),
    ]);

    const result = await useCase.execute({
      userId: "user1",
      conversationId: "conv1",
      limit: 50,
    });

    expect(result.data).to.have.length(2);
    expect(result.hasMore).to.equal(false);
    expect(result.nextCursor).to.equal(undefined);
    expect(messageRepoMock.findByConversationId.calledOnce).to.equal(true);
  });

  it("should return hasMore: true and set nextCursor when a full page is returned", async () => {
    const messages = Array.from({ length: 11 }, (_, i) =>
      makeMessage(`msg${i}`),
    );
    conversationRepoMock.findById.resolves(makeConversation());
    participantRepoMock.findByConversationAndUser.resolves(
      makeParticipant("user1"),
    );
    messageRepoMock.findByConversationId.resolves(messages);

    const result = await useCase.execute({
      userId: "user1",
      conversationId: "conv1",
      limit: 10,
    });

    expect(result.hasMore).to.equal(true);
    expect(result.data).to.have.length(10);
    expect(result.nextCursor).to.equal("msg9");
  });

  it("should pass the before cursor to the repository", async () => {
    conversationRepoMock.findById.resolves(makeConversation());
    participantRepoMock.findByConversationAndUser.resolves(
      makeParticipant("user1"),
    );
    messageRepoMock.findByConversationId.resolves([makeMessage("msg5")]);

    await useCase.execute({
      userId: "user1",
      conversationId: "conv1",
      limit: 10,
      before: "cursor-id",
    });

    const [, , before] = messageRepoMock.findByConversationId.firstCall.args;
    expect(before).to.equal("cursor-id");
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
      await useCase.execute({ userId: "user3", conversationId: "conv1" });
      expect.fail("Should have thrown ForbiddenException");
    } catch (error) {
      expect(error).to.be.instanceOf(ForbiddenException);
    }
  });
});
