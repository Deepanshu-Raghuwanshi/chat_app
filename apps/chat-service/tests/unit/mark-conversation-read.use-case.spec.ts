import { expect } from "chai";
import * as sinon from "sinon";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { MarkConversationReadUseCase } from "../../src/application/use-cases/mark-conversation-read.use-case";
import { ConversationRepository } from "../../src/application/ports/conversation.repository";
import { ConversationParticipantRepository } from "../../src/application/ports/conversation-participant.repository";
import { KafkaProducerService } from "../../src/infrastructure/messaging/kafka-producer.service";
import { ConversationEntity } from "../../src/domain/entities/conversation.entity";
import { ConversationParticipantEntity } from "../../src/domain/entities/conversation-participant.entity";
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

describe("MarkConversationReadUseCase (Unit)", () => {
  let useCase: MarkConversationReadUseCase;
  let conversationRepoMock: Record<string, sinon.SinonStub>;
  let participantRepoMock: Record<string, sinon.SinonStub>;
  let kafkaProducerMock: Record<string, sinon.SinonStub>;

  beforeEach(() => {
    conversationRepoMock = {
      findById: sinon.stub(),
    };
    participantRepoMock = {
      findByConversationAndUser: sinon.stub(),
      updateLastRead: sinon.stub().resolves(),
    };
    kafkaProducerMock = {
      emit: sinon.stub().resolves(),
    };

    useCase = new MarkConversationReadUseCase(
      conversationRepoMock as unknown as ConversationRepository,
      participantRepoMock as unknown as ConversationParticipantRepository,
      kafkaProducerMock as unknown as KafkaProducerService,
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should update lastReadAt and emit message.read.v1", async () => {
    conversationRepoMock.findById.resolves(makeConversation());
    participantRepoMock.findByConversationAndUser.resolves(
      makeParticipant("user1"),
    );

    const result = await useCase.execute({
      userId: "user1",
      conversationId: "conv1",
    });

    expect(result.lastReadAt).to.be.a("string");
    expect(participantRepoMock.updateLastRead.calledOnce).to.equal(true);
    expect(kafkaProducerMock.emit.calledOnce).to.equal(true);
    const [topic, payload] = kafkaProducerMock.emit.firstCall.args;
    expect(topic).to.equal(ChatTopics.MESSAGE_READ);
    expect(payload.conversationId).to.equal("conv1");
    expect(payload.userId).to.equal("user1");
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
