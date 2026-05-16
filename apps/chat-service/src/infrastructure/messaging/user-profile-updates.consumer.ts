import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  Inject,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Kafka, Consumer, EachMessagePayload } from "kafkajs";
import {
  UserTopics,
  UserProfileUpdatedEventV1,
} from "@kafka-events";
import { ConversationParticipantRepository } from "../../application/ports/conversation-participant.repository";

@Injectable()
export class UserProfileUpdatesConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UserProfileUpdatesConsumer.name);
  private readonly kafka: Kafka;
  private readonly consumer: Consumer;

  constructor(
    private readonly configService: ConfigService,
    @Inject("ConversationParticipantRepository")
    private readonly participantRepository: ConversationParticipantRepository,
  ) {
    this.kafka = new Kafka({
      clientId: "chat-service-profile-consumer",
      brokers: (
        this.configService.get<string>("KAFKA_BROKERS") || "localhost:9092"
      ).split(","),
    });
    this.consumer = this.kafka.consumer({
      groupId: "chat-service-user-profile-group",
    });
  }

  async onModuleInit() {
    await this.consumer.connect();
    await this.consumer.subscribe({
      topic: UserTopics.USER_PROFILE_UPDATED,
      fromBeginning: false,
    });
    await this.consumer.run({
      eachMessage: async ({ message }: EachMessagePayload) => {
        if (!message.value) return;
        const event: UserProfileUpdatedEventV1 = JSON.parse(
          message.value.toString(),
        );
        await this.handleUserProfileUpdated(event);
      },
    });
    this.logger.log("Subscribed to user.profile.updated.v1 events");
  }

  async onModuleDestroy() {
    await this.consumer.disconnect();
  }

  private async handleUserProfileUpdated(
    event: UserProfileUpdatedEventV1,
  ): Promise<void> {
    try {
      await this.participantRepository.updateProfileByUserId({
        userId: event.userId,
        username: event.username,
        fullName: event.fullName,
        avatarUrl: event.avatarUrl,
      });
      this.logger.log(`Updated participant profiles for user: ${event.userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to update participant profiles for user: ${event.userId}`,
        error,
      );
    }
  }
}
