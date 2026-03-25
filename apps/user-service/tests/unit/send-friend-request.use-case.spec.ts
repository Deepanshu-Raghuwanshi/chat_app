import { expect } from 'chai';
import * as sinon from 'sinon';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { SendFriendRequestUseCase } from '../../src/application/use-cases/send-friend-request.use-case';
import { FriendRequestStatus } from '../../src/domain/entities/friend-request.entity';
import { FriendRequestRepository } from '../../src/application/ports/friend-request.repository';
import { FriendshipRepository } from '../../src/application/ports/friendship.repository';
import { KafkaProducerService } from '../../src/infrastructure/messaging/kafka-producer.service';

describe('SendFriendRequestUseCase (Unit)', () => {
  let useCase: SendFriendRequestUseCase;
  let friendRequestRepoMock: Record<string, sinon.SinonStub>;
  let friendshipRepoMock: Record<string, sinon.SinonStub>;
  let kafkaProducerMock: Record<string, sinon.SinonStub>;

  beforeEach(() => {
    friendRequestRepoMock = {
      create: sinon.stub(),
      findBySenderAndReceiver: sinon.stub(),
      updateStatus: sinon.stub(),
    };
    friendshipRepoMock = {
      findByUsers: sinon.stub(),
    };
    kafkaProducerMock = {
      emit: sinon.stub().resolves(),
    };

    useCase = new SendFriendRequestUseCase(
      friendRequestRepoMock as unknown as FriendRequestRepository,
      friendshipRepoMock as unknown as FriendshipRepository,
      kafkaProducerMock as unknown as KafkaProducerService
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should throw BadRequestException if sender and receiver are the same', async () => {
    const dto = { senderId: 'user1', receiverId: 'user1' };

    try {
      await useCase.execute(dto);
      expect.fail('Should have thrown BadRequestException');
    } catch (error) {
      expect(error).to.be.instanceOf(BadRequestException);
      expect((error as BadRequestException).message).to.equal('You cannot send a friend request to yourself');
    }
  });

  it('should throw ConflictException if already friends', async () => {
    const dto = { senderId: 'user1', receiverId: 'user2' };
    friendshipRepoMock.findByUsers.resolves({ id: 'f1' });

    try {
      await useCase.execute(dto);
      expect.fail('Should have thrown ConflictException');
    } catch (error) {
      expect(error).to.be.instanceOf(ConflictException);
      expect((error as ConflictException).message).to.equal('You are already friends with this user');
    }
  });

  it('should throw ConflictException if request is already pending', async () => {
    const dto = { senderId: 'user1', receiverId: 'user2' };
    friendshipRepoMock.findByUsers.resolves(null);
    friendRequestRepoMock.findBySenderAndReceiver.resolves({ status: FriendRequestStatus.PENDING });

    try {
      await useCase.execute(dto);
      expect.fail('Should have thrown ConflictException');
    } catch (error) {
      expect(error).to.be.instanceOf(ConflictException);
      expect((error as ConflictException).message).to.equal('A friend request is already pending');
    }
  });

  it('should throw ConflictException if reverse request is already pending', async () => {
    const dto = { senderId: 'user1', receiverId: 'user2' };
    friendshipRepoMock.findByUsers.resolves(null);
    friendRequestRepoMock.findBySenderAndReceiver.withArgs('user1', 'user2').resolves(null);
    friendRequestRepoMock.findBySenderAndReceiver.withArgs('user2', 'user1').resolves({ status: FriendRequestStatus.PENDING });

    try {
      await useCase.execute(dto);
      expect.fail('Should have thrown ConflictException');
    } catch (error) {
      expect(error).to.be.instanceOf(ConflictException);
      expect((error as ConflictException).message).to.equal('This user has already sent you a friend request');
    }
  });

  it('should create a new friend request if none exists', async () => {
    const dto = { senderId: 'user1', receiverId: 'user2' };
    friendshipRepoMock.findByUsers.resolves(null);
    friendRequestRepoMock.findBySenderAndReceiver.resolves(null);
    friendRequestRepoMock.create.resolves({ id: 'req1', ...dto, status: FriendRequestStatus.PENDING });

    const result = await useCase.execute(dto);

    expect(result.id).to.equal('req1');
    expect(friendRequestRepoMock.create.calledOnce).to.be.equal(true);
  });

  it('should update status to PENDING if previous request was REJECTED', async () => {
    const dto = { senderId: 'user1', receiverId: 'user2' };
    friendshipRepoMock.findByUsers.resolves(null);
    friendRequestRepoMock.findBySenderAndReceiver.withArgs('user1', 'user2').resolves({ id: 'req1', status: FriendRequestStatus.REJECTED });
    friendRequestRepoMock.updateStatus.resolves({ id: 'req1', status: FriendRequestStatus.PENDING });

    const result = await useCase.execute(dto);

    expect(result.status).to.equal(FriendRequestStatus.PENDING);
    expect(friendRequestRepoMock.updateStatus.calledWith('req1', FriendRequestStatus.PENDING)).to.be.equal(true);
  });
});
