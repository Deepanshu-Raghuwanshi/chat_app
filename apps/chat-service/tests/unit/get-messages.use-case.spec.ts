import { expect } from "chai";
import * as sinon from "sinon";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { GetMessagesUseCase } from "../../src/application/use-cases/get-messages.use-case";
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
  id: string,
  senderId = "user1",
  status = "SENT",
): MessageEntity {
  return MessageEntity.create({
    id,
    conversationId: "conv1",
    senderId,
    content: `message ${id}`,
    type: "TEXT",
    status,
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
  let kafkaProducerMock: Record<string, sinon.SinonStub>;

  beforeEach(() => {
    conversationRepoMock = {
      findById: sinon.stub(),
    };
    participantRepoMock = {
      findByConversationAndUser: sinon.stub(),
    };
    messageRepoMock = {
      findByConversationId: sinon.stub(),
      updateStatusBySender: sinon.stub().resolves(1),
    };
    kafkaProducerMock = {
      emit: sinon.stub().resolves(),
    };

    useCase = new GetMessagesUseCase(
      conversationRepoMock as unknown as ConversationRepository,
      participantRepoMock as unknown as ConversationParticipantRepository,
      messageRepoMock as unknown as MessageRepository,
      kafkaProducerMock as unknown as KafkaProducerService,
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

  it("should return SENT messages from the other participant as DELIVERED in the response", async () => {
    conversationRepoMock.findById.resolves(makeConversation());
    participantRepoMock.findByConversationAndUser.resolves(
      makeParticipant("user1"),
    );
    messageRepoMock.findByConversationId.resolves([
      makeMessage("msg1", "user2", "SENT"),
      makeMessage("msg2", "user1", "SENT"),
    ]);

    const result = await useCase.execute({
      userId: "user1",
      conversationId: "conv1",
    });

    const msg1View = result.data.find((m) => m.id === "msg1");
    const msg2View = result.data.find((m) => m.id === "msg2");
    expect(msg1View?.status).to.equal("DELIVERED");
    expect(msg2View?.status).to.equal("SENT");
  });

  it("should call updateStatusBySender with SENT and target the other participant when SENT messages exist", async () => {
    conversationRepoMock.findById.resolves(makeConversation());
    participantRepoMock.findByConversationAndUser.resolves(
      makeParticipant("user1"),
    );
    messageRepoMock.findByConversationId.resolves([
      makeMessage("msg1", "user2", "SENT"),
    ]);

    await useCase.execute({ userId: "user1", conversationId: "conv1" });

    // allow the fire-and-forget microtask to settle
    await new Promise((r) => setTimeout(r, 0));

    expect(messageRepoMock.updateStatusBySender.calledOnce).to.equal(true);
    const [convId, senderId, fromStatuses, toStatus] =
      messageRepoMock.updateStatusBySender.firstCall.args;
    expect(convId).to.equal("conv1");
    expect(senderId).to.equal("user2");
    expect(fromStatuses).to.deep.equal(["SENT"]);
    expect(toStatus).to.equal("DELIVERED");
  });

  it("should NOT call updateStatusBySender when no SENT messages from the other participant exist", async () => {
    conversationRepoMock.findById.resolves(makeConversation());
    participantRepoMock.findByConversationAndUser.resolves(
      makeParticipant("user1"),
    );
    messageRepoMock.findByConversationId.resolves([
      makeMessage("msg1", "user1", "SENT"),
      makeMessage("msg2", "user2", "DELIVERED"),
    ]);

    await useCase.execute({ userId: "user1", conversationId: "conv1" });
    await new Promise((r) => setTimeout(r, 0));

    expect(messageRepoMock.updateStatusBySender.called).to.equal(false);
    expect(kafkaProducerMock.emit.called).to.equal(false);
  });

  it("should emit message.delivered.v1 with correct payload when modifiedCount > 0", async () => {
    conversationRepoMock.findById.resolves(makeConversation());
    participantRepoMock.findByConversationAndUser.resolves(
      makeParticipant("user1"),
    );
    messageRepoMock.findByConversationId.resolves([
      makeMessage("msg1", "user2", "SENT"),
    ]);
    messageRepoMock.updateStatusBySender.resolves(1);

    await useCase.execute({ userId: "user1", conversationId: "conv1" });
    await new Promise((r) => setTimeout(r, 0));

    expect(kafkaProducerMock.emit.calledOnce).to.equal(true);
    const [topic, payload] = kafkaProducerMock.emit.firstCall.args;
    expect(topic).to.equal(ChatTopics.MESSAGE_DELIVERED);
    expect(payload.conversationId).to.equal("conv1");
    expect(payload.senderId).to.equal("user2");
    expect(payload.recipientId).to.equal("user1");
    expect(payload.deliveredAt).to.be.a("string");
  });

  it("should NOT emit Kafka event when updateStatusBySender returns 0", async () => {
    conversationRepoMock.findById.resolves(makeConversation());
    participantRepoMock.findByConversationAndUser.resolves(
      makeParticipant("user1"),
    );
    messageRepoMock.findByConversationId.resolves([
      makeMessage("msg1", "user2", "SENT"),
    ]);
    messageRepoMock.updateStatusBySender.resolves(0);

    await useCase.execute({ userId: "user1", conversationId: "conv1" });
    await new Promise((r) => setTimeout(r, 0));

    expect(kafkaProducerMock.emit.called).to.equal(false);
  });

  it("should still return messages successfully when updateStatusBySender rejects", async () => {
    conversationRepoMock.findById.resolves(makeConversation());
    participantRepoMock.findByConversationAndUser.resolves(
      makeParticipant("user1"),
    );
    messageRepoMock.findByConversationId.resolves([
      makeMessage("msg1", "user2", "SENT"),
    ]);
    messageRepoMock.updateStatusBySender.rejects(new Error("DB error"));

    const result = await useCase.execute({
      userId: "user1",
      conversationId: "conv1",
    });
    await new Promise((r) => setTimeout(r, 0));

    expect(result.data).to.have.length(1);
    expect(result.data[0].status).to.equal("DELIVERED");
    expect(kafkaProducerMock.emit.called).to.equal(false);
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
