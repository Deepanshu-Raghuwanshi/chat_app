import { expect } from 'chai';
import * as sinon from 'sinon';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { RespondToFriendRequestUseCase } from '../../src/application/use-cases/respond-to-friend-request.use-case';
import { FriendRequestStatus } from '../../src/domain/entities/friend-request.entity';
import { FriendRequestRepository } from '../../src/application/ports/friend-request.repository';
import { FriendshipRepository } from '../../src/application/ports/friendship.repository';
import { KafkaProducerService } from '../../src/infrastructure/messaging/kafka-producer.service';
import { FriendRequest } from '@prisma/client-user';

describe('RespondToFriendRequestUseCase (Unit)', () => {
  let useCase: RespondToFriendRequestUseCase;
  let friendRequestRepoMock: Record<string, sinon.SinonStub>;
  let friendshipRepoMock: Record<string, sinon.SinonStub>;
  let kafkaProducerMock: sinon.SinonStubbedInstance<KafkaProducerService>;

  beforeEach(() => {
    friendRequestRepoMock = {
      findById: sinon.stub(),
      updateStatus: sinon.stub(),
      create: sinon.stub(),
      findBySenderAndReceiver: sinon.stub(),
      findIncomingByUserId: sinon.stub(),
      findOutgoingByUserId: sinon.stub(),
      delete: sinon.stub(),
    };
    friendshipRepoMock = {
      create: sinon.stub(),
      findByUsers: sinon.stub(),
      findByUserId: sinon.stub(),
      delete: sinon.stub(),
      deleteByUsers: sinon.stub(),
    };
    kafkaProducerMock = sinon.createStubInstance(KafkaProducerService);

    useCase = new RespondToFriendRequestUseCase(
      friendRequestRepoMock as unknown as FriendRequestRepository,
      friendshipRepoMock as unknown as FriendshipRepository,
      kafkaProducerMock as unknown as KafkaProducerService
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should throw NotFoundException if request does not exist', async () => {
    const dto = { requestId: 'req1', userId: 'user2', action: 'ACCEPT' as const };
    friendRequestRepoMock.findById.resolves(null);

    try {
      await useCase.execute(dto);
      expect.fail('Should have thrown NotFoundException');
    } catch (error) {
      expect(error).to.be.instanceOf(NotFoundException);
    }
  });

  it('should throw ForbiddenException if user is not the receiver', async () => {
    const dto = { requestId: 'req1', userId: 'user3', action: 'ACCEPT' as const };
    friendRequestRepoMock.findById.resolves({ 
      id: 'req1', 
      senderId: 'user1',
      receiverId: 'user2', 
      status: FriendRequestStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as FriendRequest);

    try {
      await useCase.execute(dto);
      expect.fail('Should have thrown ForbiddenException');
    } catch (error) {
      expect(error).to.be.instanceOf(ForbiddenException);
    }
  });

  it('should throw BadRequestException if request is not PENDING', async () => {
    const dto = { requestId: 'req1', userId: 'user2', action: 'ACCEPT' as const };
    friendRequestRepoMock.findById.resolves({ 
      id: 'req1', 
      senderId: 'user1',
      receiverId: 'user2', 
      status: FriendRequestStatus.ACCEPTED,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as FriendRequest);

    try {
      await useCase.execute(dto);
      expect.fail('Should have thrown BadRequestException');
    } catch (error) {
      expect(error).to.be.instanceOf(BadRequestException);
    }
  });

  it('should reject friend request', async () => {
    const dto = { requestId: 'req1', userId: 'user2', action: 'REJECT' as const };
    friendRequestRepoMock.findById.resolves({ 
      id: 'req1', 
      senderId: 'user1',
      receiverId: 'user2', 
      status: FriendRequestStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as FriendRequest);
    friendRequestRepoMock.updateStatus.resolves({ 
      id: 'req1', 
      senderId: 'user1',
      receiverId: 'user2',
      status: FriendRequestStatus.REJECTED,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as FriendRequest);

    const result = await useCase.execute(dto);

    expect((result as FriendRequest).status).to.equal(FriendRequestStatus.REJECTED);
    expect(friendRequestRepoMock.updateStatus.calledWith('req1', FriendRequestStatus.REJECTED)).to.equal(true);
    expect(friendshipRepoMock.create.called).to.equal(false);
  });

  it('should accept friend request and create friendship', async () => {
    const dto = { requestId: 'req1', userId: 'user2', action: 'ACCEPT' as const };
    friendRequestRepoMock.findById.resolves({ 
      id: 'req1', 
      senderId: 'user1', 
      receiverId: 'user2', 
      status: FriendRequestStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as FriendRequest);
    friendRequestRepoMock.updateStatus.resolves({ 
      id: 'req1', 
      senderId: 'user1',
      receiverId: 'user2',
      status: FriendRequestStatus.ACCEPTED,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as FriendRequest);
    friendshipRepoMock.create.resolves({ id: 'f1', userId1: 'user1', userId2: 'user2', createdAt: new Date() });

    const result = await useCase.execute(dto);

    expect(result.id).to.equal('f1');
    expect(friendRequestRepoMock.updateStatus.calledWith('req1', FriendRequestStatus.ACCEPTED)).to.equal(true);
    expect(friendshipRepoMock.create.calledWith('user1', 'user2')).to.equal(true);
  });
});
