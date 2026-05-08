import { expect } from "chai";
import * as sinon from "sinon";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { EditMessageUseCase } from "../../src/application/use-cases/edit-message.use-case";
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
    content: "original",
    type: "TEXT",
    status: "SENT",
    isDeleted: false,
    isEdited: false,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  });
}

describe("EditMessageUseCase (Unit)", () => {
  let useCase: EditMessageUseCase;
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

    useCase = new EditMessageUseCase(
      messageRepoMock as unknown as MessageRepository,
      kafkaProducerMock as unknown as KafkaProducerService,
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should set isEdited: true and update content", async () => {
    const original = makeMessage();
    const updated = makeMessage({ content: "edited", isEdited: true });
    messageRepoMock.findById.resolves(original);
    messageRepoMock.update.resolves(updated);

    const result = await useCase.execute({
      userId: "user1",
      conversationId: "conv1",
      messageId: "msg1",
      content: "edited",
    });

    expect(result.isEdited).to.equal(true);
    expect(result.content).to.equal("edited");
    expect(messageRepoMock.update.calledOnce).to.equal(true);
    const updateArgs = messageRepoMock.update.firstCall.args[1];
    expect(updateArgs.isEdited).to.equal(true);
    expect(kafkaProducerMock.emit.calledOnce).to.equal(true);
  });

  it("should throw NotFoundException when message does not exist", async () => {
    messageRepoMock.findById.resolves(null);

    try {
      await useCase.execute({
        userId: "user1",
        conversationId: "conv1",
        messageId: "msg1",
        content: "x",
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
        content: "x",
      });
      expect.fail("Should have thrown ForbiddenException");
    } catch (error) {
      expect(error).to.be.instanceOf(ForbiddenException);
    }
  });

  it("should throw BadRequestException when message is already deleted", async () => {
    messageRepoMock.findById.resolves(makeMessage({ isDeleted: true }));

    try {
      await useCase.execute({
        userId: "user1",
        conversationId: "conv1",
        messageId: "msg1",
        content: "x",
      });
      expect.fail("Should have thrown BadRequestException");
    } catch (error) {
      expect(error).to.be.instanceOf(BadRequestException);
    }
  });
});
