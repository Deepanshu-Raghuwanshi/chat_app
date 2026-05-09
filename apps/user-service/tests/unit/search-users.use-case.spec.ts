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
    it("should call search with trimmed query and return profiles annotated with relationshipStatus 'none'", async () => {
      const profiles = [makeProfile("u2"), makeProfile("u3")];
      userProfileRepo.search.resolves(profiles);

      const result = await useCase.execute("u1", "ali");

      expect(userProfileRepo.search.calledOnce).to.be.equal(true);
      const [calledQuery] = userProfileRepo.search.firstCall.args;
      expect(calledQuery).to.equal("ali");
      expect(result).to.deep.equal([
        { ...profiles[0], relationshipStatus: "none" },
        { ...profiles[1], relationshipStatus: "none" },
      ]);
    });

    it("should return empty array when repository returns empty array", async () => {
      userProfileRepo.search.resolves([]);
      const result = await useCase.execute("u1", "xyz");
      expect(result).to.deep.equal([]);
    });
  });

  describe("exclusion list", () => {
    it("should pass only the requesting user in excludeIds to the repository", async () => {
      userProfileRepo.search.resolves([]);
      await useCase.execute("u1", "ali");

      const [, excludeIds] = userProfileRepo.search.firstCall.args as [
        string,
        string[],
      ];
      expect(excludeIds).to.deep.equal(["u1"]);
    });

    it("should annotate current friends with 'friend' status", async () => {
      friendshipRepo.findByUserId.resolves([{ userId1: "u1", userId2: "u2" }]);
      userProfileRepo.search.resolves([makeProfile("u2")]);

      const result = await useCase.execute("u1", "ali");

      expect(result[0].relationshipStatus).to.equal("friend");
    });

    it("should annotate PENDING incoming request senders with 'pending_incoming'", async () => {
      friendRequestRepo.findIncomingByUserId.resolves([
        { senderId: "u3", status: "PENDING" },
      ]);
      userProfileRepo.search.resolves([makeProfile("u3")]);

      const result = await useCase.execute("u1", "ali");

      expect(result[0].relationshipStatus).to.equal("pending_incoming");
    });

    it("should annotate PENDING outgoing request receivers with 'pending_outgoing'", async () => {
      friendRequestRepo.findOutgoingByUserId.resolves([
        { receiverId: "u4", status: "PENDING" },
      ]);
      userProfileRepo.search.resolves([makeProfile("u4")]);

      const result = await useCase.execute("u1", "ali");

      expect(result[0].relationshipStatus).to.equal("pending_outgoing");
    });

    it("should annotate users with REJECTED requests as 'none'", async () => {
      friendRequestRepo.findOutgoingByUserId.resolves([
        { receiverId: "u5", status: "REJECTED" },
      ]);
      userProfileRepo.search.resolves([makeProfile("u5")]);

      const result = await useCase.execute("u1", "ali");

      expect(result[0].relationshipStatus).to.equal("none");
    });

    it("should annotate users with ACCEPTED requests as 'none' (friendship model handles friend status)", async () => {
      friendRequestRepo.findOutgoingByUserId.resolves([
        { receiverId: "u6", status: "ACCEPTED" },
      ]);
      userProfileRepo.search.resolves([makeProfile("u6")]);

      const result = await useCase.execute("u1", "ali");

      expect(result[0].relationshipStatus).to.equal("none");
    });

    it("should annotate all relationship types correctly in a combined result", async () => {
      friendshipRepo.findByUserId.resolves([{ userId1: "u1", userId2: "u2" }]);
      friendRequestRepo.findIncomingByUserId.resolves([
        { senderId: "u3", status: "PENDING" },
      ]);
      friendRequestRepo.findOutgoingByUserId.resolves([
        { receiverId: "u4", status: "PENDING" },
      ]);
      userProfileRepo.search.resolves([
        makeProfile("u2"),
        makeProfile("u3"),
        makeProfile("u4"),
        makeProfile("u5"),
      ]);

      const result = await useCase.execute("u1", "ali");

      const [, excludeIds] = userProfileRepo.search.firstCall.args as [
        string,
        string[],
      ];
      expect(excludeIds).to.deep.equal(["u1"]);

      expect(result.find((r) => r.id === "u2")?.relationshipStatus).to.equal(
        "friend",
      );
      expect(result.find((r) => r.id === "u3")?.relationshipStatus).to.equal(
        "pending_incoming",
      );
      expect(result.find((r) => r.id === "u4")?.relationshipStatus).to.equal(
        "pending_outgoing",
      );
      expect(result.find((r) => r.id === "u5")?.relationshipStatus).to.equal(
        "none",
      );
    });
  });
});
