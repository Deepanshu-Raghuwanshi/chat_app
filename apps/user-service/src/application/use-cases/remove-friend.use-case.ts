import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { FriendshipRepository } from '../ports/friendship.repository';

@Injectable()
export class RemoveFriendUseCase {
  constructor(
    @Inject('FriendshipRepository')
    private readonly friendshipRepository: FriendshipRepository,
  ) {}

  async execute(userId: string, friendId: string): Promise<void> {
    if (userId === friendId) {
      throw new BadRequestException('You cannot remove yourself');
    }

    const friendship = await this.friendshipRepository.findByUsers(userId, friendId);
    if (!friendship) {
      throw new NotFoundException('Friendship not found');
    }

    await this.friendshipRepository.deleteByUsers(userId, friendId);
  }
}
