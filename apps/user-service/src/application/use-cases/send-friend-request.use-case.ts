import { Injectable, Inject, BadRequestException, ConflictException } from '@nestjs/common';
import { FriendRequestRepository } from '../ports/friend-request.repository';
import { FriendshipRepository } from '../ports/friendship.repository';
import { FriendRequestStatus } from '../../domain/entities/friend-request.entity';
import { KafkaProducerService } from '../../infrastructure/messaging/kafka-producer.service';
import { FriendTopics } from '@kafka-events/index';

export interface SendFriendRequestDto {
  senderId: string;
  receiverId: string;
}

@Injectable()
export class SendFriendRequestUseCase {
  constructor(
    @Inject('FriendRequestRepository')
    private readonly friendRequestRepository: FriendRequestRepository,
    @Inject('FriendshipRepository')
    private readonly friendshipRepository: FriendshipRepository,
    private readonly kafkaProducer: KafkaProducerService
  ) {}

  async execute(dto: SendFriendRequestDto) {
    const { senderId, receiverId } = dto;

    if (senderId === receiverId) {
      throw new BadRequestException('You cannot send a friend request to yourself');
    }

    // Check if they are already friends
    const existingFriendship = await this.friendshipRepository.findByUsers(senderId, receiverId);
    if (existingFriendship) {
      throw new ConflictException('You are already friends with this user');
    }

    // Check if there is an existing pending request from sender to receiver
    const existingRequest = await this.friendRequestRepository.findBySenderAndReceiver(senderId, receiverId);
    if (existingRequest && existingRequest.status === FriendRequestStatus.PENDING) {
      throw new ConflictException('A friend request is already pending');
    }

    // Check if there is an existing pending request from receiver to sender (reverse)
    const reverseRequest = await this.friendRequestRepository.findBySenderAndReceiver(receiverId, senderId);
    if (reverseRequest && reverseRequest.status === FriendRequestStatus.PENDING) {
      throw new ConflictException('This user has already sent you a friend request');
    }

    let request;
    // If there was a REJECTED request, we might want to allow re-sending or update the status back to PENDING
    if (existingRequest && existingRequest.status === FriendRequestStatus.REJECTED) {
      request = await this.friendRequestRepository.updateStatus(existingRequest.id, FriendRequestStatus.PENDING);
    } else {
      request = await this.friendRequestRepository.create({
        senderId,
        receiverId,
        status: FriendRequestStatus.PENDING,
      });
    }

    // Emit Kafka Event
    await this.kafkaProducer.emit(FriendTopics.FRIEND_REQUEST_SENT, {
      requestId: request.id,
      senderId,
      receiverId,
    });

    return request;
  }
}
