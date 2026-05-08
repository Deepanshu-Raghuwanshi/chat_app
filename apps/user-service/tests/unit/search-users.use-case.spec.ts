import { expect } from "chai";
import * as sinon from "sinon";
import { BadRequestException } from "@nestjs/common";
import { SearchUsersUseCase } from "../../src/application/use-cases/search-users.use-case";
import { UserProfileRepository } from "../../src/application/ports/user-profile.repository";
import { FriendshipRepository } from "../../src/application/ports/friendship.repository";
import { FriendRequestRepository } from "../../src/application/ports/friend-request.repository";

const makeProfile = (id: string) => ({
  id,
  username: `user_${id}`,
  fullName: null,
  avatarUrl: null,
  bio: null,
  phoneNumber: null,
  countryCode: null,
  status: null,
  isOnline: false,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe("SearchUsersUseCase (Unit)", () => {
  let useCase: SearchUsersUseCase;
  let userProfileRepo: Record<string, sinon.SinonStub>;
  let friendshipRepo: Record<string, sinon.SinonStub>;
  let friendRequestRepo: Record<string, sinon.SinonStub>;

  beforeEach(() => {
    userProfileRepo = { search: sinon.stub() };
    friendshipRepo = { findByUserId: sinon.stub().resolves([]) };
    friendRequestRepo = {
      findIncomingByUserId: sinon.stub().resolves([]),
      findOutgoingByUserId: sinon.stub().resolves([]),
    };

    useCase = new SearchUsersUseCase(
      userProfileRepo as unknown as UserProfileRepository,
      friendshipRepo as unknown as FriendshipRepository,
      friendRequestRepo as unknown as FriendRequestRepository,
    );
  });

  afterEach(() => sinon.restore());

  describe("input validation", () => {
    it("should throw BadRequestException when query is empty string", async () => {
      try {
        await useCase.execute("u1", "");
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).to.be.instanceOf(BadRequestException);
        expect((err as BadRequestException).message).to.equal(
          "Search query must be at least 2 characters",
        );
      }
    });

    it("should throw BadRequestException when query is 1 character", async () => {
      try {
        await useCase.execute("u1", "a");
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).to.be.instanceOf(BadRequestException);
      }
    });

    it("should throw BadRequestException when query is 101 characters", async () => {
      try {
        await useCase.execute("u1", "a".repeat(101));
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).to.be.instanceOf(BadRequestException);
        expect((err as BadRequestException).message).to.equal(
          "Search query too long",
        );
      }
    });

    it("should not throw when query is exactly 2 characters", async () => {
      userProfileRepo.search.resolves([]);
      const result = await useCase.execute("u1", "ab");
      expect(result).to.deep.equal([]);
    });

    it("should trim whitespace before length check — single space should throw", async () => {
      try {
        await useCase.execute("u1", " ");
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).to.be.instanceOf(BadRequestException);
      }
    });
  });

  describe("happy path", () => {
    it("should call search with trimmed query and return profiles", async () => {
      const profiles = [makeProfile("u2"), makeProfile("u3")];
      userProfileRepo.search.resolves(profiles);

      const result = await useCase.execute("u1", "ali");

      expect(userProfileRepo.search.calledOnce).to.be.equal(true);
      const [calledQuery] = userProfileRepo.search.firstCall.args;
      expect(calledQuery).to.equal("ali");
      expect(result).to.deep.equal(profiles);
    });

    it("should return empty array when repository returns empty array", async () => {
      userProfileRepo.search.resolves([]);
      const result = await useCase.execute("u1", "xyz");
      expect(result).to.deep.equal([]);
    });
  });

  describe("exclusion list", () => {
    it("should always exclude the requesting user", async () => {
      userProfileRepo.search.resolves([]);
      await useCase.execute("u1", "ali");

      const [, excludeIds] = userProfileRepo.search.firstCall.args as [
        string,
        string[],
      ];
      expect(excludeIds).to.include("u1");
    });

    it("should exclude current friends", async () => {
      friendshipRepo.findByUserId.resolves([{ userId1: "u1", userId2: "u2" }]);
      userProfileRepo.search.resolves([]);

      await useCase.execute("u1", "ali");

      const [, excludeIds] = userProfileRepo.search.firstCall.args as [
        string,
        string[],
      ];
      expect(excludeIds).to.include("u2");
    });

    it("should exclude PENDING incoming request senders", async () => {
      friendRequestRepo.findIncomingByUserId.resolves([
        { senderId: "u3", status: "PENDING" },
      ]);
      userProfileRepo.search.resolves([]);

      await useCase.execute("u1", "ali");

      const [, excludeIds] = userProfileRepo.search.firstCall.args as [
        string,
        string[],
      ];
      expect(excludeIds).to.include("u3");
    });

    it("should exclude PENDING outgoing request receivers", async () => {
      friendRequestRepo.findOutgoingByUserId.resolves([
        { receiverId: "u4", status: "PENDING" },
      ]);
      userProfileRepo.search.resolves([]);

      await useCase.execute("u1", "ali");

      const [, excludeIds] = userProfileRepo.search.firstCall.args as [
        string,
        string[],
      ];
      expect(excludeIds).to.include("u4");
    });

    it("should NOT exclude users with REJECTED requests", async () => {
      friendRequestRepo.findOutgoingByUserId.resolves([
        { receiverId: "u5", status: "REJECTED" },
      ]);
      userProfileRepo.search.resolves([]);

      await useCase.execute("u1", "ali");

      const [, excludeIds] = userProfileRepo.search.firstCall.args as [
        string,
        string[],
      ];
      expect(excludeIds).to.not.include("u5");
    });

    it("should NOT exclude users with ACCEPTED requests (friendship model handles that)", async () => {
      friendRequestRepo.findOutgoingByUserId.resolves([
        { receiverId: "u6", status: "ACCEPTED" },
      ]);
      userProfileRepo.search.resolves([]);

      await useCase.execute("u1", "ali");

      const [, excludeIds] = userProfileRepo.search.firstCall.args as [
        string,
        string[],
      ];
      expect(excludeIds).to.not.include("u6");
    });

    it("should build correct excludeIds with all sources combined", async () => {
      friendshipRepo.findByUserId.resolves([{ userId1: "u1", userId2: "u2" }]);
      friendRequestRepo.findIncomingByUserId.resolves([
        { senderId: "u3", status: "PENDING" },
      ]);
      friendRequestRepo.findOutgoingByUserId.resolves([
        { receiverId: "u4", status: "PENDING" },
      ]);
      userProfileRepo.search.resolves([]);

      await useCase.execute("u1", "ali");

      const [, excludeIds] = userProfileRepo.search.firstCall.args as [
        string,
        string[],
      ];
      expect(excludeIds).to.include("u1");
      expect(excludeIds).to.include("u2");
      expect(excludeIds).to.include("u3");
      expect(excludeIds).to.include("u4");
    });
  });
});
