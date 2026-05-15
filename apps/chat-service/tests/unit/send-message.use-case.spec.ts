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

function makeMessage(
  overrides?: Partial<Parameters<typeof MessageEntity.create>[0]>,
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
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  });
}

function makeQuotedMessage(
  overrides?: Partial<Parameters<typeof MessageEntity.create>[0]>,
): MessageEntity {
  return MessageEntity.create({
    id: "quoted-msg",
    conversationId: "conv1",
    senderId: "user2",
    content: "original message",
    type: "TEXT",
    status: "SENT",
    isDeleted: false,
    isEdited: false,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
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
      findById: sinon.stub(),
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

  // --- Quoted-reply tests ---

  it("should create message without replyTo when no quotedMessageId is supplied", async () => {
    conversationRepoMock.findById.resolves(makeConversation());
    participantRepoMock.findByConversationAndUser.resolves(
      makeParticipant("user1"),
    );
    messageRepoMock.create.resolves(makeMessage());

    await useCase.execute({
      userId: "user1",
      conversationId: "conv1",
      content: "plain message",
    });

    const createArg = messageRepoMock.create.firstCall.args[0];
    expect(createArg.replyTo).to.equal(undefined);
    expect(messageRepoMock.findById.called).to.equal(false);
  });

  it("should create message with replyTo snapshot when quotedMessageId is valid", async () => {
    conversationRepoMock.findById.resolves(makeConversation());
    participantRepoMock.findByConversationAndUser.resolves(
      makeParticipant("user1"),
    );
    messageRepoMock.findById.resolves(makeQuotedMessage());
    messageRepoMock.create.resolves(makeMessage());

    await useCase.execute({
      userId: "user1",
      conversationId: "conv1",
      content: "reply message",
      quotedMessageId: "quoted-msg",
    });

    const createArg = messageRepoMock.create.firstCall.args[0];
    expect(createArg.replyTo).to.deep.equal({
      messageId: "quoted-msg",
      senderId: "user2",
      content: "original message",
    });
  });

  it("should truncate quoted content to 200 chars in the snapshot", async () => {
    const longContent = "x".repeat(300);
    conversationRepoMock.findById.resolves(makeConversation());
    participantRepoMock.findByConversationAndUser.resolves(
      makeParticipant("user1"),
    );
    messageRepoMock.findById.resolves(
      makeQuotedMessage({ content: longContent }),
    );
    messageRepoMock.create.resolves(makeMessage());

    await useCase.execute({
      userId: "user1",
      conversationId: "conv1",
      content: "reply",
      quotedMessageId: "quoted-msg",
    });

    const createArg = messageRepoMock.create.firstCall.args[0];
    expect(createArg.replyTo.content).to.have.lengthOf(200);
  });

  it("should include replyTo in the Kafka event when quoting", async () => {
    conversationRepoMock.findById.resolves(makeConversation());
    participantRepoMock.findByConversationAndUser.resolves(
      makeParticipant("user1"),
    );
    messageRepoMock.findById.resolves(makeQuotedMessage());
    messageRepoMock.create.resolves(makeMessage());

    await useCase.execute({
      userId: "user1",
      conversationId: "conv1",
      content: "reply",
      quotedMessageId: "quoted-msg",
    });

    const [, payload] = kafkaProducerMock.emit.firstCall.args;
    expect(payload.replyTo).to.deep.equal({
      messageId: "quoted-msg",
      senderId: "user2",
      content: "original message",
    });
  });

  it("should not include replyTo in the Kafka event when not quoting", async () => {
    conversationRepoMock.findById.resolves(makeConversation());
    participantRepoMock.findByConversationAndUser.resolves(
      makeParticipant("user1"),
    );
    messageRepoMock.create.resolves(makeMessage());

    await useCase.execute({
      userId: "user1",
      conversationId: "conv1",
      content: "plain message",
    });

    const [, payload] = kafkaProducerMock.emit.firstCall.args;
    expect(payload.replyTo).to.equal(undefined);
  });

  it("should throw NotFoundException when quotedMessageId maps to no document", async () => {
    conversationRepoMock.findById.resolves(makeConversation());
    participantRepoMock.findByConversationAndUser.resolves(
      makeParticipant("user1"),
    );
    messageRepoMock.findById.resolves(null);

    try {
      await useCase.execute({
        userId: "user1",
        conversationId: "conv1",
        content: "reply",
        quotedMessageId: "nonexistent",
      });
      expect.fail("Should have thrown NotFoundException");
    } catch (error) {
      expect(error).to.be.instanceOf(NotFoundException);
      expect((error as NotFoundException).message).to.equal(
        "Quoted message not found",
      );
    }

    expect(messageRepoMock.create.called).to.equal(false);
  });

  it("should throw NotFoundException when quoted message belongs to a different conversation", async () => {
    conversationRepoMock.findById.resolves(makeConversation());
    participantRepoMock.findByConversationAndUser.resolves(
      makeParticipant("user1"),
    );
    messageRepoMock.findById.resolves(
      makeQuotedMessage({ conversationId: "other-conv" }),
    );

    try {
      await useCase.execute({
        userId: "user1",
        conversationId: "conv1",
        content: "reply",
        quotedMessageId: "quoted-msg",
      });
      expect.fail("Should have thrown NotFoundException");
    } catch (error) {
      expect(error).to.be.instanceOf(NotFoundException);
      expect((error as NotFoundException).message).to.equal(
        "Quoted message not found",
      );
    }

    expect(messageRepoMock.create.called).to.equal(false);
  });

  it("should throw BadRequestException when quoted message is deleted", async () => {
    conversationRepoMock.findById.resolves(makeConversation());
    participantRepoMock.findByConversationAndUser.resolves(
      makeParticipant("user1"),
    );
    messageRepoMock.findById.resolves(makeQuotedMessage({ isDeleted: true }));

    try {
      await useCase.execute({
        userId: "user1",
        conversationId: "conv1",
        content: "reply",
        quotedMessageId: "quoted-msg",
      });
      expect.fail("Should have thrown BadRequestException");
    } catch (error) {
      expect(error).to.be.instanceOf(BadRequestException);
      expect((error as BadRequestException).message).to.equal(
        "Cannot reply to a deleted message",
      );
    }

    expect(messageRepoMock.create.called).to.equal(false);
  });
});
