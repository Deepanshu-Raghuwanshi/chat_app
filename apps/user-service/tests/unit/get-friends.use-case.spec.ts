import { expect } from 'chai';
import * as sinon from 'sinon';
import { GetFriendsUseCase } from '../../src/application/use-cases/get-friends.use-case';
import { FriendshipRepository } from '../../src/application/ports/friendship.repository';

describe('GetFriendsUseCase (Unit)', () => {
  let useCase: GetFriendsUseCase;
  let friendshipRepoMock: Record<string, sinon.SinonStub>;

  beforeEach(() => {
    friendshipRepoMock = {
      findByUserId: sinon.stub(),
      create: sinon.stub(),
      findByUsers: sinon.stub(),
      delete: sinon.stub(),
      deleteByUsers: sinon.stub(),
      findByUserIdAndFriendId: sinon.stub(), // Added if needed by interface
    } as unknown as Record<string, sinon.SinonStub>;

    useCase = new GetFriendsUseCase(friendshipRepoMock as unknown as FriendshipRepository);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should return a list of friend IDs', async () => {
    const userId = 'user1';
    const friendships = [
      { id: '1', createdAt: new Date(), userId1: 'user1', userId2: 'user2' },
      { id: '2', createdAt: new Date(), userId1: 'user3', userId2: 'user1' },
    ];
    friendshipRepoMock.findByUserId.resolves(friendships);

    const result = await useCase.execute(userId);

    expect(result).to.deep.equal(['user2', 'user3']);
    expect(friendshipRepoMock.findByUserId.calledWith('user1')).to.equal(true);
  });

  it('should return empty list if no friends', async () => {
    const userId = 'user1';
    friendshipRepoMock.findByUserId.resolves([]);

    const result = await useCase.execute(userId);

    expect(result).to.be.an('array').with.lengthOf(0);
  });
});
