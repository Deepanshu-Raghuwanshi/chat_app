import { Injectable, Inject, BadRequestException } from "@nestjs/common";
import { UserProfile } from "@prisma/client-user";
import { FriendRequestStatus } from "../../domain/entities/friend-request.entity";
import { UserProfileRepository } from "../ports/user-profile.repository";
import { FriendshipRepository } from "../ports/friendship.repository";
import { FriendRequestRepository } from "../ports/friend-request.repository";

export type RelationshipStatus =
  | "friend"
  | "pending_incoming"
  | "pending_outgoing"
  | "none";

export type UserSearchResult = UserProfile & {
  relationshipStatus: RelationshipStatus;
};

@Injectable()
export class SearchUsersUseCase {
  constructor(
    @Inject("UserProfileRepository")
    private readonly userProfileRepository: UserProfileRepository,
    @Inject("FriendshipRepository")
    private readonly friendshipRepository: FriendshipRepository,
    @Inject("FriendRequestRepository")
    private readonly friendRequestRepository: FriendRequestRepository,
  ) {}

  async execute(
    userId: string,
    query: string | undefined,
  ): Promise<UserSearchResult[]> {
    const trimmed = query?.trim() ?? "";

    if (trimmed.length < 2) {
      throw new BadRequestException(
        "Search query must be at least 2 characters",
      );
    }
    if (trimmed.length > 100) {
      throw new BadRequestException("Search query too long");
    }

    const [friendships, incomingRequests, outgoingRequests] = await Promise.all(
      [
        this.friendshipRepository.findByUserId(userId),
        this.friendRequestRepository.findIncomingByUserId(userId),
        this.friendRequestRepository.findOutgoingByUserId(userId),
      ],
    );

    const friendIdSet = new Set(
      friendships.map((f) => (f.userId1 === userId ? f.userId2 : f.userId1)),
    );
    const pendingIncomingSet = new Set(
      incomingRequests
        .filter((r) => r.status === FriendRequestStatus.PENDING)
        .map((r) => r.senderId),
    );
    const pendingOutgoingSet = new Set(
      outgoingRequests
        .filter((r) => r.status === FriendRequestStatus.PENDING)
        .map((r) => r.receiverId),
    );

    const profiles = await this.userProfileRepository.search(trimmed, [
      userId,
    ]);

    return profiles.map((profile) => {
      let relationshipStatus: RelationshipStatus = "none";
      if (friendIdSet.has(profile.id)) {
        relationshipStatus = "friend";
      } else if (pendingOutgoingSet.has(profile.id)) {
        relationshipStatus = "pending_outgoing";
      } else if (pendingIncomingSet.has(profile.id)) {
        relationshipStatus = "pending_incoming";
      }
      return { ...profile, relationshipStatus };
    });
  }
}
