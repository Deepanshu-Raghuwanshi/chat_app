import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { UserProfileRepository } from '../ports/user-profile.repository';
import { KafkaProducerService } from '../../infrastructure/messaging/kafka-producer.service';

interface UpdateProfileRequest {
  userId: string;
  fullName?: string;
  bio?: string;
  phoneNumber?: string;
  countryCode?: string;
  status?: string;
}

@Injectable()
export class UpdateProfileUseCase {
  constructor(
    @Inject('UserProfileRepository')
    private readonly userProfileRepository: UserProfileRepository,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  async execute(request: UpdateProfileRequest) {
    const { userId, ...data } = request;
    
    const user = await this.userProfileRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    const updatedUser = await this.userProfileRepository.update(userId, data);

    // Emit event for synchronization
    await this.kafkaProducer.emit('user.profile.updated', {
      userId: updatedUser.id,
      username: updatedUser.username,
      fullName: updatedUser.fullName,
      avatarUrl: updatedUser.avatarUrl,
      bio: updatedUser.bio,
      status: updatedUser.status,
    });

    return updatedUser;
  }
}
