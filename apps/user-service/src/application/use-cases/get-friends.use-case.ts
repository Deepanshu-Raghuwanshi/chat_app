import { Injectable, Inject } from '@nestjs/common';
import { FriendshipRepository } from '../ports/friendship.repository';
import { UserProfileRepository } from '../ports/user-profile.repository';

@Injectable()
export class GetFriendsUseCase {
  constructor(
    @Inject('FriendshipRepository')
    private readonly friendshipRepository: FriendshipRepository,
    @Inject('UserProfileRepository')
    private readonly userProfileRepository: UserProfileRepository
  ) {}

  async execute(userId: string) {
    const friendships = await this.friendshipRepository.findByUserId(userId);
    
    // Extract the other user's ID from each friendship
    const friendIds = friendships.map(f => f.userId1 === userId ? f.userId2 : f.userId1);
    
    // Fetch profiles for all friends
    const profiles = await Promise.all(
      friendIds.map(id => this.userProfileRepository.findById(id))
    );

    // Filter out null profiles (if any)
    return profiles.filter(p => p !== null);
  }
}
