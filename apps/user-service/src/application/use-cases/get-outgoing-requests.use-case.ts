import { Injectable, Inject } from '@nestjs/common';
import { FriendRequestRepository } from '../ports/friend-request.repository';
import { UserProfileRepository } from '../ports/user-profile.repository';

@Injectable()
export class GetOutgoingRequestsUseCase {
  constructor(
    @Inject('FriendRequestRepository')
    private readonly friendRequestRepository: FriendRequestRepository,
    @Inject('UserProfileRepository')
    private readonly userProfileRepository: UserProfileRepository,
  ) {}

  async execute(userId: string) {
    const requests = await this.friendRequestRepository.findOutgoingByUserId(userId);
    
    // Enrich with receiver profiles
    const enrichedRequests = await Promise.all(
      requests.map(async (request) => {
        const receiver = await this.userProfileRepository.findById(request.receiverId);
        return {
          ...request,
          receiver,
        };
      })
    );

    return enrichedRequests;
  }
}
