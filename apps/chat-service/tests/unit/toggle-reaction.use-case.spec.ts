import { expect } from "chai";
import * as sinon from "sinon";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { ToggleReactionUseCase } from "../../src/application/use-cases/toggle-reaction.use-case";
import { ConversationRepository } from "../../src/application/ports/conversation.repository";
import { ConversationParticipantRepository } from "../../src/application/ports/conversation-participant.repository";
import { MessageRepository } from "../../src/application/ports/message.repository";
import { KafkaProducerService } from "../../src/infrastructure/messaging/kafka-producer.service";
import { ConversationEntity } from "../../src/domain/entities/conversation.entity";
import { ConversationParticipantEntity } from "../../src/domain/entities/conversation-participant.entity";
import { MessageEntity } from "../../src/domain/entities/message.entity";
import { ChatTopics } from "@kafka-events";

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

function makeMessage(
  overrides: Partial<{
    id: string;
    conversationId: string;
    senderId: string;
    isDeleted: boolean;
    reactions: { emoji: string; userId: string; createdAt: Date }[];
  }> = {},
): MessageEntity {
  return MessageEntity.create({
    id: "msg1",
    conversationId: "conv1",
    senderId: "user1",
    content: "hello",
    type: "TEXT",
    status: "SENT",
    isDeleted: false,
    isEdited: false,
    reactions: [],
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  });
}

describe("ToggleReactionUseCase (Unit)", () => {
  let useCase: ToggleReactionUseCase;
  let conversationRepoMock: Record<string, sinon.SinonStub>;
  let participantRepoMock: Record<string, sinon.SinonStub>;
  let messageRepoMock: Record<string, sinon.SinonStub>;
  let kafkaProducerMock: Record<string, sinon.SinonStub>;

  beforeEach(() => {
    conversationRepoMock = {
      findById: sinon.stub(),
    };
    participantRepoMock = {
      findByConversationAndUser: sinon.stub(),
    };
    messageRepoMock = {
      findById: sinon.stub(),
      toggleReaction: sinon.stub(),
    };
    kafkaProducerMock = {
      emit: sinon.stub().resolves(),
    };

    useCase = new ToggleReactionUseCase(
      conversationRepoMock as unknown as ConversationRepository,
      participantRepoMock as unknown as ConversationParticipantRepository,
      messageRepoMock as unknown as MessageRepository,
      kafkaProducerMock as unknown as KafkaProducerService,
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should toggle reaction, emit Kafka with action=added when reaction is newly present", async () => {
    conversationRepoMock.findById.resolves(makeConversation());
    participantRepoMock.findByConversationAndUser.resolves(
      makeParticipant("user2"),
    );
    messageRepoMock.findById.resolves(makeMessage({ senderId: "user1" }));
    const reactionAdded = makeMessage({
      reactions: [
        { emoji: "👍", userId: "user2", createdAt: new Date("2024-01-01") },
      ],
    });
    messageRepoMock.toggleReaction.resolves(reactionAdded);

    const result = await useCase.execute({
      userId: "user2",
      conversationId: "conv1",
      messageId: "msg1",
      emoji: "👍",
    });

    expect(result.id).to.equal("msg1");
    expect(result.reactions).to.have.length(1);
    expect(result.reactions[0].emoji).to.equal("👍");
    expect(
      messageRepoMock.toggleReaction.calledOnceWith("msg1", "👍", "user2"),
    ).to.equal(true);
    expect(kafkaProducerMock.emit.calledOnce).to.equal(true);
    const [topic, payload] = kafkaProducerMock.emit.firstCall.args;
    expect(topic).to.equal(ChatTopics.MESSAGE_REACTION_TOGGLED);
    expect(payload.action).to.equal("added");
    expect(payload.emoji).to.equal("👍");
    expect(payload.reactorId).to.equal("user2");
    expect(payload.senderId).to.equal("user1");
  });

  it("should emit Kafka with action=removed when reaction is no longer present after toggle", async () => {
    conversationRepoMock.findById.resolves(makeConversation());
    participantRepoMock.findByConversationAndUser.resolves(
      makeParticipant("user2"),
    );
    messageRepoMock.findById.resolves(
      makeMessage({
        reactions: [
          { emoji: "👍", userId: "user2", createdAt: new Date("2024-01-01") },
        ],
      }),
    );
    messageRepoMock.toggleReaction.resolves(makeMessage({ reactions: [] }));

    const result = await useCase.execute({
      userId: "user2",
      conversationId: "conv1",
      messageId: "msg1",
      emoji: "👍",
    });

    expect(result.reactions).to.have.length(0);
    const [, payload] = kafkaProducerMock.emit.firstCall.args;
    expect(payload.action).to.equal("removed");
  });

  it("should throw NotFoundException when conversation does not exist", async () => {
    conversationRepoMock.findById.resolves(null);

    try {
      await useCase.execute({
        userId: "user1",
        conversationId: "conv1",
        messageId: "msg1",
        emoji: "👍",
      });
      expect.fail("Should have thrown NotFoundException");
    } catch (error) {
      expect(error).to.be.instanceOf(NotFoundException);
    }
  });

  it("should throw ForbiddenException when requester is not a participant", async () => {
    conversationRepoMock.findById.resolves(makeConversation());
    participantRepoMock.findByConversationAndUser.resolves(null);

    try {
      await useCase.execute({
        userId: "outsider",
        conversationId: "conv1",
        messageId: "msg1",
        emoji: "👍",
      });
      expect.fail("Should have thrown ForbiddenException");
    } catch (error) {
      expect(error).to.be.instanceOf(ForbiddenException);
    }
  });

  it("should throw NotFoundException when message does not exist", async () => {
    conversationRepoMock.findById.resolves(makeConversation());
    participantRepoMock.findByConversationAndUser.resolves(
      makeParticipant("user1"),
    );
    messageRepoMock.findById.resolves(null);

    try {
      await useCase.execute({
        userId: "user1",
        conversationId: "conv1",
        messageId: "msg1",
        emoji: "👍",
      });
      expect.fail("Should have thrown NotFoundException");
    } catch (error) {
      expect(error).to.be.instanceOf(NotFoundException);
    }
  });

  it("should throw NotFoundException when message belongs to a different conversation", async () => {
    conversationRepoMock.findById.resolves(makeConversation());
    participantRepoMock.findByConversationAndUser.resolves(
      makeParticipant("user1"),
    );
    messageRepoMock.findById.resolves(
      makeMessage({ conversationId: "other-conv" }),
    );

    try {
      await useCase.execute({
        userId: "user1",
        conversationId: "conv1",
        messageId: "msg1",
        emoji: "👍",
      });
      expect.fail("Should have thrown NotFoundException");
    } catch (error) {
      expect(error).to.be.instanceOf(NotFoundException);
    }
  });

  it("should throw BadRequestException when message is deleted", async () => {
    conversationRepoMock.findById.resolves(makeConversation());
    participantRepoMock.findByConversationAndUser.resolves(
      makeParticipant("user1"),
    );
    messageRepoMock.findById.resolves(makeMessage({ isDeleted: true }));

    try {
      await useCase.execute({
        userId: "user1",
        conversationId: "conv1",
        messageId: "msg1",
        emoji: "👍",
      });
      expect.fail("Should have thrown BadRequestException");
    } catch (error) {
      expect(error).to.be.instanceOf(BadRequestException);
    }
  });

  it("should NOT emit Kafka event when toggleReaction repository call throws", async () => {
    conversationRepoMock.findById.resolves(makeConversation());
    participantRepoMock.findByConversationAndUser.resolves(
      makeParticipant("user1"),
    );
    messageRepoMock.findById.resolves(makeMessage());
    messageRepoMock.toggleReaction.rejects(new Error("DB error"));

    try {
      await useCase.execute({
        userId: "user1",
        conversationId: "conv1",
        messageId: "msg1",
        emoji: "👍",
      });
      expect.fail("Should have thrown");
    } catch {
      expect(kafkaProducerMock.emit.called).to.equal(false);
    }
  });
});
