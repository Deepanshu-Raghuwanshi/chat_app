import { Injectable, Inject, BadRequestException } from "@nestjs/common";
import { UserProfile } from "@prisma/client-user";
import { FriendRequestStatus } from "../../domain/entities/friend-request.entity";
import { UserProfileRepository } from "../ports/user-profile.repository";
import { FriendshipRepository } from "../ports/friendship.repository";
import { FriendRequestRepository } from "../ports/friend-request.repository";

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
  ): Promise<UserProfile[]> {
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

    const friendIds = friendships.map((f) =>
      f.userId1 === userId ? f.userId2 : f.userId1,
    );
    const pendingIncomingIds = incomingRequests
      .filter((r) => r.status === FriendRequestStatus.PENDING)
      .map((r) => r.senderId);
    const pendingOutgoingIds = outgoingRequests
      .filter((r) => r.status === FriendRequestStatus.PENDING)
      .map((r) => r.receiverId);

    const excludeIds = [
      userId,
      ...friendIds,
      ...pendingIncomingIds,
      ...pendingOutgoingIds,
    ];

    return this.userProfileRepository.search(trimmed, excludeIds);
  }
}
