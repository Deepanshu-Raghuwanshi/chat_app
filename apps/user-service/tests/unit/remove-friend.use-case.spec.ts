import { expect } from "chai";
import * as sinon from "sinon";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { RemoveFriendUseCase } from "../../src/application/use-cases/remove-friend.use-case";
import { FriendshipRepository } from "../../src/application/ports/friendship.repository";
import { KafkaProducerService } from "../../src/infrastructure/messaging/kafka-producer.service";
import { FriendTopics } from "@kafka-events";

describe("RemoveFriendUseCase (Unit)", () => {
  let useCase: RemoveFriendUseCase;
  let friendshipRepoMock: Record<string, sinon.SinonStub>;
  let kafkaProducerMock: sinon.SinonStubbedInstance<KafkaProducerService>;

  beforeEach(() => {
    friendshipRepoMock = {
      findByUsers: sinon.stub(),
      deleteByUsers: sinon.stub().resolves(),
      create: sinon.stub(),
      findByUserId: sinon.stub(),
      delete: sinon.stub(),
    };
    kafkaProducerMock = sinon.createStubInstance(KafkaProducerService);

    useCase = new RemoveFriendUseCase(
      friendshipRepoMock as unknown as FriendshipRepository,
      kafkaProducerMock as unknown as KafkaProducerService,
    );
  });

  afterEach(() => sinon.restore());

  it("should delete friendship and emit FRIEND_REMOVED event", async () => {
    friendshipRepoMock.findByUsers.resolves({
      id: "f1",
      userId1: "user1",
      userId2: "user2",
    });

    await useCase.execute("user1", "user2");

    expect(
      friendshipRepoMock.deleteByUsers.calledOnceWith("user1", "user2"),
    ).to.equal(true);
    expect(kafkaProducerMock.emit.calledOnce).to.equal(true);
    const emitArgs = kafkaProducerMock.emit.firstCall.args as [
      string,
      { userId: string; friendId: string },
    ];
    expect(emitArgs[0]).to.equal(FriendTopics.FRIEND_REMOVED);
    expect(emitArgs[1].userId).to.equal("user1");
    expect(emitArgs[1].friendId).to.equal("user2");
  });

  it("should throw NotFoundException when friendship does not exist", async () => {
    friendshipRepoMock.findByUsers.resolves(null);

    try {
      await useCase.execute("user1", "user2");
      expect.fail("Should have thrown NotFoundException");
    } catch (error) {
      expect(error).to.be.instanceOf(NotFoundException);
    }

    expect(kafkaProducerMock.emit.called).to.equal(false);
  });

  it("should throw BadRequestException when userId equals friendId", async () => {
    try {
      await useCase.execute("user1", "user1");
      expect.fail("Should have thrown BadRequestException");
    } catch (error) {
      expect(error).to.be.instanceOf(BadRequestException);
    }

    expect(friendshipRepoMock.findByUsers.called).to.equal(false);
    expect(kafkaProducerMock.emit.called).to.equal(false);
  });

  it("should NOT emit event when deleteByUsers throws", async () => {
    friendshipRepoMock.findByUsers.resolves({
      id: "f1",
      userId1: "user1",
      userId2: "user2",
    });
    friendshipRepoMock.deleteByUsers.rejects(new Error("DB error"));

    try {
      await useCase.execute("user1", "user2");
      expect.fail("Should have thrown");
    } catch {
      expect(kafkaProducerMock.emit.called).to.equal(false);
    }
  });
});
