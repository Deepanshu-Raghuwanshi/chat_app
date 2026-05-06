import { expect } from "chai";
import * as sinon from "sinon";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { DeleteMessageUseCase } from "../../src/application/use-cases/delete-message.use-case";
import { MessageRepository } from "../../src/application/ports/message.repository";
import { KafkaProducerService } from "../../src/infrastructure/messaging/kafka-producer.service";
import { MessageEntity } from "../../src/domain/entities/message.entity";

function makeMessage(
  overrides: Partial<{
    id: string;
    conversationId: string;
    senderId: string;
    content: string;
    type: string;
    status: string;
    isDeleted: boolean;
    isEdited: boolean;
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
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  });
}

describe("DeleteMessageUseCase (Unit)", () => {
  let useCase: DeleteMessageUseCase;
  let messageRepoMock: Record<string, sinon.SinonStub>;
  let kafkaProducerMock: Record<string, sinon.SinonStub>;

  beforeEach(() => {
    messageRepoMock = {
      findById: sinon.stub(),
      update: sinon.stub(),
    };
    kafkaProducerMock = {
      emit: sinon.stub().resolves(),
    };

    useCase = new DeleteMessageUseCase(
      messageRepoMock as unknown as MessageRepository,
      kafkaProducerMock as unknown as KafkaProducerService,
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should set isDeleted: true and replace content with [deleted]", async () => {
    messageRepoMock.findById.resolves(makeMessage());
    messageRepoMock.update.resolves(
      makeMessage({ content: "[deleted]", isDeleted: true }),
    );

    const result = await useCase.execute({
      userId: "user1",
      conversationId: "conv1",
      messageId: "msg1",
    });

    expect(result.isDeleted).to.equal(true);
    expect(result.content).to.equal("[deleted]");
    const updateArgs = messageRepoMock.update.firstCall.args[1];
    expect(updateArgs.content).to.equal("[deleted]");
    expect(updateArgs.isDeleted).to.equal(true);
    expect(kafkaProducerMock.emit.calledOnce).to.equal(true);
  });

  it("should throw NotFoundException when message does not exist", async () => {
    messageRepoMock.findById.resolves(null);

    try {
      await useCase.execute({
        userId: "user1",
        conversationId: "conv1",
        messageId: "msg1",
      });
      expect.fail("Should have thrown NotFoundException");
    } catch (error) {
      expect(error).to.be.instanceOf(NotFoundException);
    }
  });

  it("should throw ForbiddenException when requester is not the sender", async () => {
    messageRepoMock.findById.resolves(makeMessage({ senderId: "other-user" }));

    try {
      await useCase.execute({
        userId: "user1",
        conversationId: "conv1",
        messageId: "msg1",
      });
      expect.fail("Should have thrown ForbiddenException");
    } catch (error) {
      expect(error).to.be.instanceOf(ForbiddenException);
    }
  });
});
