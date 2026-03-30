import { expect } from "chai";
import * as sinon from "sinon";
import { GetFriendsUseCase } from "../../src/application/use-cases/get-friends.use-case";
import { FriendshipRepository } from "../../src/application/ports/friendship.repository";
import { UserProfileRepository } from "../../src/application/ports/user-profile.repository";
import { PresenceRepository } from "../../src/application/ports/presence.repository";
import { PresenceStatus } from "@kafka-events";

describe("GetFriendsUseCase (Unit)", () => {
  let useCase: GetFriendsUseCase;
  let friendshipRepoMock: Record<string, sinon.SinonStub>;
  let userProfileRepoMock: Record<string, sinon.SinonStub>;
  let presenceRepoMock: Record<string, sinon.SinonStub>;

  beforeEach(() => {
    friendshipRepoMock = {
      findByUserId: sinon.stub(),
    } as unknown as Record<string, sinon.SinonStub>;

    userProfileRepoMock = {
      findById: sinon.stub(),
    } as unknown as Record<string, sinon.SinonStub>;

    presenceRepoMock = {
      getStatuses: sinon.stub(),
    } as unknown as Record<string, sinon.SinonStub>;

    useCase = new GetFriendsUseCase(
      friendshipRepoMock as unknown as FriendshipRepository,
      userProfileRepoMock as unknown as UserProfileRepository,
      presenceRepoMock as unknown as PresenceRepository,
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

    presenceRepoMock.getStatuses.resolves(new Map([
      ["user2", PresenceStatus.ONLINE],
      ["user3", PresenceStatus.OFFLINE]
    ]));

    const result = await useCase.execute(userId);

    expect(result).to.deep.equal([
      { ...profile2, isOnline: true },
      { ...profile3, isOnline: false }
    ]);
    expect(friendshipRepoMock.findByUserId.calledWith("user1")).to.equal(true);
  });

  it("should return empty list if no friends", async () => {
    const userId = "user1";
    friendshipRepoMock.findByUserId.resolves([]);
    presenceRepoMock.getStatuses.resolves(new Map());

    const result = await useCase.execute(userId);

    expect(result).to.be.an("array").with.lengthOf(0);
    expect(userProfileRepoMock.findById.called).to.equal(false);
  });
});
