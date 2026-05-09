import { expect } from "chai";
import * as sinon from "sinon";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { SendMessageUseCase } from "../../src/application/use-cases/send-message.use-case";
import { ConversationRepository } from "../../src/application/ports/conversation.repository";
import { ConversationParticipantRepository } from "../../src/application/ports/conversation-participant.repository";
import { MessageRepository } from "../../src/application/ports/message.repository";
import { FriendshipVerifier } from "../../src/application/ports/friendship-verifier.port";
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

function makeMessage(): MessageEntity {
  return MessageEntity.create({
    id: "msg1",
    conversationId: "conv1",
    senderId: "user1",
    content: "hello",
    type: "TEXT",
    status: "SENT",
    isDeleted: false,
    isEdited: false,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  });
}

describe("SendMessageUseCase (Unit)", () => {
  let useCase: SendMessageUseCase;
  let conversationRepoMock: Record<string, sinon.SinonStub>;
  let participantRepoMock: Record<string, sinon.SinonStub>;
  let messageRepoMock: Record<string, sinon.SinonStub>;
  let friendshipVerifierMock: Record<string, sinon.SinonStub>;
  let kafkaProducerMock: Record<string, sinon.SinonStub>;

  beforeEach(() => {
    conversationRepoMock = {
      findById: sinon.stub(),
      updateLastMessage: sinon.stub().resolves(),
    };
    participantRepoMock = {
      findByConversationAndUser: sinon.stub(),
    };
    messageRepoMock = {
      create: sinon.stub(),
    };
    friendshipVerifierMock = {
      areFriends: sinon.stub().resolves(true),
    };
    kafkaProducerMock = {
      emit: sinon.stub().resolves(),
    };

    useCase = new SendMessageUseCase(
      conversationRepoMock as unknown as ConversationRepository,
      participantRepoMock as unknown as ConversationParticipantRepository,
      messageRepoMock as unknown as MessageRepository,
      friendshipVerifierMock as unknown as FriendshipVerifier,
      kafkaProducerMock as unknown as KafkaProducerService,
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should create message and emit message.sent.v1", async () => {
    conversationRepoMock.findById.resolves(makeConversation());
    participantRepoMock.findByConversationAndUser.resolves(
      makeParticipant("user1"),
    );
    messageRepoMock.create.resolves(makeMessage());

    const result = await useCase.execute({
      userId: "user1",
      conversationId: "conv1",
      content: "hello",
    });

    expect(result.id).to.equal("msg1");
    expect(messageRepoMock.create.calledOnce).to.equal(true);
    expect(kafkaProducerMock.emit.calledOnce).to.equal(true);
    const [topic, payload] = kafkaProducerMock.emit.firstCall.args;
    expect(topic).to.equal(ChatTopics.MESSAGE_SENT);
    expect(payload.senderId).to.equal("user1");
    expect(payload.conversationId).to.equal("conv1");
  });

  it("should throw BadRequestException when content is empty", async () => {
    try {
      await useCase.execute({
        userId: "user1",
        conversationId: "conv1",
        content: "   ",
      });
      expect.fail("Should have thrown BadRequestException");
    } catch (error) {
      expect(error).to.be.instanceOf(BadRequestException);
    }
  });

  it("should throw NotFoundException when conversation does not exist", async () => {
    conversationRepoMock.findById.resolves(null);

    try {
      await useCase.execute({
        userId: "user1",
        conversationId: "conv1",
        content: "hello",
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
        userId: "user1",
        conversationId: "conv1",
        content: "hello",
      });
      expect.fail("Should have thrown ForbiddenException");
    } catch (error) {
      expect(error).to.be.instanceOf(ForbiddenException);
    }
  });

  it("should NOT emit Kafka event when message repository throws", async () => {
    conversationRepoMock.findById.resolves(makeConversation());
    participantRepoMock.findByConversationAndUser.resolves(
      makeParticipant("user1"),
    );
    messageRepoMock.create.rejects(new Error("DB error"));

    try {
      await useCase.execute({
        userId: "user1",
        conversationId: "conv1",
        content: "hello",
      });
      expect.fail("Should have thrown");
    } catch {
      expect(kafkaProducerMock.emit.called).to.equal(false);
    }
  });

  it("should throw ForbiddenException when users are no longer friends — regression for post-unfriend messaging bug", async () => {
    conversationRepoMock.findById.resolves(makeConversation());
    participantRepoMock.findByConversationAndUser.resolves(
      makeParticipant("user1"),
    );
    friendshipVerifierMock.areFriends.resolves(false);

    try {
      await useCase.execute({
        userId: "user1",
        conversationId: "conv1",
        content: "hello after unfriend",
      });
      expect.fail("Should have thrown ForbiddenException");
    } catch (error) {
      expect(error).to.be.instanceOf(ForbiddenException);
    }

    expect(messageRepoMock.create.called).to.equal(false);
    expect(kafkaProducerMock.emit.called).to.equal(false);
  });
});
