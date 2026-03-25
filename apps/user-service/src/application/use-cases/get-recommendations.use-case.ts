import { Injectable, Inject } from '@nestjs/common';
import { UserProfileRepository } from '../ports/user-profile.repository';
import { FriendshipRepository } from '../ports/friendship.repository';
import { FriendRequestRepository } from '../ports/friend-request.repository';

@Injectable()
export class GetRecommendationsUseCase {
  constructor(
    @Inject('UserProfileRepository')
    private readonly userProfileRepository: UserProfileRepository,
    @Inject('FriendshipRepository')
    private readonly friendshipRepository: FriendshipRepository,
    @Inject('FriendRequestRepository')
    private readonly friendRequestRepository: FriendRequestRepository,
  ) {}

  async execute(userId: string) {
    // 1. Get current friends to exclude
    const friendships = await this.friendshipRepository.findByUserId(userId);
    const friendIds = friendships.map(f => f.userId1 === userId ? f.userId2 : f.userId1);

    // 2. Get pending requests (both incoming and outgoing) to exclude
    const incomingRequests = await this.friendRequestRepository.findIncomingByUserId(userId);
    const outgoingRequests = await this.friendRequestRepository.findOutgoingByUserId(userId);
    
    const pendingIncomingIds = incomingRequests
      .filter(r => r.status === 'PENDING')
      .map(r => r.senderId);
    
    const pendingOutgoingIds = outgoingRequests
      .filter(r => r.status === 'PENDING')
      .map(r => r.receiverId);

    // 3. Combine all IDs to exclude
    const excludeIds = [
      userId,
      ...friendIds,
      ...pendingIncomingIds,
      ...pendingOutgoingIds
    ];

    // 4. Fetch recommended users (simple: anyone not excluded)
    return this.userProfileRepository.findAllExcept(excludeIds);
  }
}
