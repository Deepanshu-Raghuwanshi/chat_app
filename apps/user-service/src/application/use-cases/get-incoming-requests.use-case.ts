import { Injectable, Inject } from '@nestjs/common';
import { FriendRequestRepository } from '../ports/friend-request.repository';
import { UserProfileRepository } from '../ports/user-profile.repository';

@Injectable()
export class GetIncomingRequestsUseCase {
  constructor(
    @Inject('FriendRequestRepository')
    private readonly friendRequestRepository: FriendRequestRepository,
    @Inject('UserProfileRepository')
    private readonly userProfileRepository: UserProfileRepository,
  ) {}

  async execute(userId: string) {
    const requests = await this.friendRequestRepository.findIncomingByUserId(userId);
    
    // Enrich with sender profiles
    const enrichedRequests = await Promise.all(
      requests.map(async (request) => {
        const sender = await this.userProfileRepository.findById(request.senderId);
        return {
          ...request,
          sender,
        };
      })
    );

    return enrichedRequests;
  }
}
