import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { FriendshipRepository } from "../ports/friendship.repository";
import { KafkaProducerService } from "../../infrastructure/messaging/kafka-producer.service";
import { FriendTopics, FriendRemovedEventV1 } from "@kafka-events/index";

@Injectable()
export class RemoveFriendUseCase {
  constructor(
    @Inject("FriendshipRepository")
    private readonly friendshipRepository: FriendshipRepository,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  async execute(userId: string, friendId: string): Promise<void> {
    if (userId === friendId) {
      throw new BadRequestException("You cannot remove yourself");
    }

    const friendship = await this.friendshipRepository.findByUsers(
      userId,
      friendId,
    );
    if (!friendship) {
      throw new NotFoundException("Friendship not found");
    }

    await this.friendshipRepository.deleteByUsers(userId, friendId);

    await this.kafkaProducer.emit(FriendTopics.FRIEND_REMOVED, {
      userId,
      friendId,
    } satisfies FriendRemovedEventV1);
  }
}
