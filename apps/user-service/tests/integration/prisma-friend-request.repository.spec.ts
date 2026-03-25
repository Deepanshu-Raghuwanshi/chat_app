import { Test, TestingModule } from '@nestjs/testing';
import { expect } from 'chai';
import { PrismaService } from '../../src/infrastructure/persistence/prisma.service';
import { PrismaFriendRequestRepository } from '../../src/infrastructure/persistence/prisma-friend-request.repository';
import { FriendRequestStatus } from '@prisma/client-user';

describe('PrismaFriendRequestRepository (Integration)', () => {
  let repository: PrismaFriendRequestRepository;
  let prisma: PrismaService;

  before(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService, PrismaFriendRequestRepository],
    }).compile();

    repository = module.get<PrismaFriendRequestRepository>(PrismaFriendRequestRepository);
    prisma = module.get<PrismaService>(PrismaService);
    await prisma.onModuleInit();
  });

  beforeEach(async () => {
    // Clean up tables
    await prisma.friendRequest.deleteMany();
    await prisma.userProfile.deleteMany();

    // Create some users for testing
    await prisma.userProfile.createMany({
      data: [
        { id: 'user1', username: 'test1' },
        { id: 'user2', username: 'test2' },
        { id: 'user3', username: 'test3' },
      ],
    });
  });

  it('should create a friend request', async () => {
    const data = {
      senderId: 'user1',
      receiverId: 'user2',
      status: FriendRequestStatus.PENDING,
    };

    const request = await repository.create(data);

    expect(request.id).to.be.a('string');
    expect(request.senderId).to.equal('user1');
    expect(request.receiverId).to.equal('user2');
  });

  it('should find a request by sender and receiver', async () => {
    await prisma.friendRequest.create({
      data: {
        senderId: 'user1',
        receiverId: 'user2',
        status: FriendRequestStatus.PENDING,
      },
    });

    const request = await repository.findBySenderAndReceiver('user1', 'user2');

    expect(request).to.not.equal(null);
    expect(request?.senderId).to.equal('user1');
  });

  it('should find incoming requests for a user', async () => {
    await prisma.friendRequest.create({
      data: {
        senderId: 'user1',
        receiverId: 'user3',
        status: FriendRequestStatus.PENDING,
      },
    });

    const requests = await repository.findIncomingByUserId('user3');

    expect(requests).to.have.lengthOf(1);
    expect(requests[0].senderId).to.equal('user1');
  });

  it('should update request status', async () => {
    const created = await prisma.friendRequest.create({
      data: {
        senderId: 'user1',
        receiverId: 'user2',
        status: FriendRequestStatus.PENDING,
      },
    });

    const updated = await repository.updateStatus(created.id, FriendRequestStatus.ACCEPTED);

    expect(updated.status).to.equal(FriendRequestStatus.ACCEPTED);
  });
});
