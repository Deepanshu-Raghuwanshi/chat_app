import { Test, TestingModule } from '@nestjs/testing';
import { expect } from 'chai';
import { PrismaService } from '../../src/infrastructure/persistence/prisma.service';
import { PrismaFriendshipRepository } from '../../src/infrastructure/persistence/prisma-friendship.repository';

describe('PrismaFriendshipRepository (Integration)', () => {
  let repository: PrismaFriendshipRepository;
  let prisma: PrismaService;

  before(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService, PrismaFriendshipRepository],
    }).compile();

    repository = module.get<PrismaFriendshipRepository>(PrismaFriendshipRepository);
    prisma = module.get<PrismaService>(PrismaService);
    await prisma.onModuleInit();
  });

  beforeEach(async () => {
    // Clean up tables
    await prisma.friendship.deleteMany();
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

  it('should create a friendship', async () => {
    const friendship = await repository.create('user1', 'user2');

    expect(friendship.id).to.be.a('string');
    // It should order user IDs
    expect(friendship.userId1).to.equal('user1');
    expect(friendship.userId2).to.equal('user2');
  });

  it('should create a friendship and order IDs correctly', async () => {
    const friendship = await repository.create('user2', 'user1');

    expect(friendship.userId1).to.equal('user1');
    expect(friendship.userId2).to.equal('user2');
  });

  it('should find friendship by users', async () => {
    await repository.create('user1', 'user2');

    const friendship = await repository.findByUsers('user2', 'user1');

    expect(friendship).to.not.equal(null);
    expect(friendship?.userId1).to.equal('user1');
  });

  it('should find all friendships for a user', async () => {
    await repository.create('user1', 'user2');
    await repository.create('user1', 'user3');

    const friendships = await repository.findByUserId('user1');

    expect(friendships).to.have.lengthOf(2);
  });

  it('should delete a friendship by users', async () => {
    await repository.create('user1', 'user2');
    
    await repository.deleteByUsers('user1', 'user2');

    const friendship = await repository.findByUsers('user1', 'user2');
    expect(friendship).to.equal(null);
  });
});
