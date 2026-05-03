import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { UserProfileRepository } from '../ports/user-profile.repository';
import { CloudinaryService } from '../../infrastructure/cloudinary/cloudinary.service';
import { KafkaProducerService } from '../../infrastructure/messaging/kafka-producer.service';

@Injectable()
export class UpdateAvatarUseCase {
  constructor(
    @Inject('UserProfileRepository')
    private readonly userProfileRepository: UserProfileRepository,
    private readonly cloudinaryService: CloudinaryService,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  async execute(userId: string, file: Express.Multer.File) {
    const user = await this.userProfileRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    const uploadResult = await this.cloudinaryService.uploadImage(file);
    const avatarUrl = uploadResult.secure_url;

    const updatedUser = await this.userProfileRepository.update(userId, { avatarUrl });

    // Emit event for synchronization
    await this.kafkaProducer.emit('user.profile.updated', {
      userId: updatedUser.id,
      username: updatedUser.username,
      fullName: updatedUser.fullName,
      avatarUrl: updatedUser.avatarUrl,
      bio: updatedUser.bio,
      status: updatedUser.status,
    });

    return { avatarUrl };
  }
}
