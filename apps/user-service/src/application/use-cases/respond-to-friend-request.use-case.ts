import { Injectable, Inject, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { FriendRequestRepository } from '../ports/friend-request.repository';
import { FriendshipRepository } from '../ports/friendship.repository';
import { FriendRequestStatus } from '../../domain/entities/friend-request.entity';
import { KafkaProducerService } from '../../infrastructure/messaging/kafka-producer.service';
import { FriendTopics } from '@kafka-events/index';

export interface RespondToFriendRequestDto {
  requestId: string;
  userId: string; // The user responding to the request
  action: 'ACCEPT' | 'REJECT';
}

@Injectable()
export class RespondToFriendRequestUseCase {
  constructor(
    @Inject('FriendRequestRepository')
    private readonly friendRequestRepository: FriendRequestRepository,
    @Inject('FriendshipRepository')
    private readonly friendshipRepository: FriendshipRepository,
    private readonly kafkaProducer: KafkaProducerService
  ) {}

  async execute(dto: RespondToFriendRequestDto) {
    const { requestId, userId, action } = dto;

    const request = await this.friendRequestRepository.findById(requestId);
    if (!request) {
      throw new NotFoundException('Friend request not found');
    }

    if (request.receiverId !== userId) {
      throw new ForbiddenException('You can only respond to requests sent to you');
    }

    if (request.status !== FriendRequestStatus.PENDING) {
      throw new BadRequestException('This friend request is no longer pending');
    }

    if (action === 'REJECT') {
      return this.friendRequestRepository.updateStatus(requestId, FriendRequestStatus.REJECTED);
    }

    // ACCEPT action
    await this.friendRequestRepository.updateStatus(requestId, FriendRequestStatus.ACCEPTED);
    
    // Create actual friendship
    const friendship = await this.friendshipRepository.create(request.senderId, request.receiverId);

    // Emit Kafka Event
    await this.kafkaProducer.emit(FriendTopics.FRIEND_REQUEST_ACCEPTED, {
      requestId: request.id,
      senderId: request.senderId,
      receiverId: request.receiverId,
    });

    return friendship;
  }
}
