import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { UserProfileRepository } from '../ports/user-profile.repository';

@Injectable()
export class GetProfileUseCase {
  constructor(
    @Inject('UserProfileRepository')
    private readonly userProfileRepository: UserProfileRepository,
  ) {}

  async execute(userId: string) {
    const user = await this.userProfileRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User profile not found');
    }
    return user;
  }
}
