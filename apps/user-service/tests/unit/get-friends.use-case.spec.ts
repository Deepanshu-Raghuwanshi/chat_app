import { expect } from "chai";
import * as sinon from "sinon";
import { GetFriendsUseCase } from "../../src/application/use-cases/get-friends.use-case";
import { FriendshipRepository } from "../../src/application/ports/friendship.repository";
import { UserProfileRepository } from "apps/user-service/src/application/ports/user-profile.repository";

describe("GetFriendsUseCase (Unit)", () => {
  let useCase: GetFriendsUseCase;
  let friendshipRepoMock: Record<string, sinon.SinonStub>;
  let userProfileRepoMock: Record<string, sinon.SinonStub>;

  beforeEach(() => {
    friendshipRepoMock = {
      findByUserId: sinon.stub(),
      create: sinon.stub(),
      findByUsers: sinon.stub(),
      delete: sinon.stub(),
      deleteByUsers: sinon.stub(),
      findByUserIdAndFriendId: sinon.stub(),
    } as unknown as Record<string, sinon.SinonStub>;

    userProfileRepoMock = {
      findById: sinon.stub(),
      findByUsername: sinon.stub(),
      findAllExcept: sinon.stub(),
      upsert: sinon.stub(),
    } as unknown as Record<string, sinon.SinonStub>;

    useCase = new GetFriendsUseCase(
      friendshipRepoMock as unknown as FriendshipRepository,
      userProfileRepoMock as unknown as UserProfileRepository,
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should return a list of friend profiles", async () => {
    const userId = "user1";
    const friendships = [
      { id: "1", createdAt: new Date(), userId1: "user1", userId2: "user2" },
      { id: "2", createdAt: new Date(), userId1: "user3", userId2: "user1" },
    ];
    friendshipRepoMock.findByUserId.resolves(friendships);

    const profile2 = { id: "user2", username: "user2", fullName: "User Two" };
    const profile3 = { id: "user3", username: "user3", fullName: "User Three" };

    userProfileRepoMock.findById.withArgs("user2").resolves(profile2);
    userProfileRepoMock.findById.withArgs("user3").resolves(profile3);

    const result = await useCase.execute(userId);

    expect(result).to.deep.equal([profile2, profile3]);
    expect(friendshipRepoMock.findByUserId.calledWith("user1")).to.equal(true);
  });

  it("should return empty list if no friends", async () => {
    const userId = "user1";
    friendshipRepoMock.findByUserId.resolves([]);

    const result = await useCase.execute(userId);

    expect(result).to.be.an("array").with.lengthOf(0);
    expect(userProfileRepoMock.findById.called).to.equal(false);
  });
});
