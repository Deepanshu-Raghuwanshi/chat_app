import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { Kafka, Consumer } from "kafkajs";
import { ConfigService } from "@nestjs/config";
import { PresenceGateway } from "../../interfaces/gateways/presence.gateway";
import {
  ChatTopics,
  FriendTopics,
  FriendRemovedEventV1,
  MessageSentEventV1,
  MessageEditedEventV1,
  MessageDeletedEventV1,
} from "@kafka-events";

@Injectable()
export class ChatGateway implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChatGateway.name);
  private consumer: Consumer;

  constructor(
    private readonly configService: ConfigService,
    private readonly presenceGateway: PresenceGateway,
  ) {
    const kafka = new Kafka({
      clientId: "chat-service-gateway",
      brokers: (
        this.configService.get<string>("KAFKA_BROKERS") || "localhost:9092"
      ).split(","),
    });
    this.consumer = kafka.consumer({ groupId: "chat-gateway-consumer" });
  }

  async onModuleInit() {
    await this.consumer.connect();
    await this.consumer.subscribe({
      topics: [
        ChatTopics.MESSAGE_SENT,
        ChatTopics.MESSAGE_EDITED,
        ChatTopics.MESSAGE_DELETED,
        FriendTopics.FRIEND_REMOVED,
      ],
      fromBeginning: false,
    });

    await this.consumer.run({
      eachMessage: async ({ topic, message }) => {
        try {
          const payload = JSON.parse(message.value?.toString() ?? "{}");
          this.fanOut(topic, payload);
        } catch (err) {
          this.logger.error(
            `Error processing chat event on topic ${topic}`,
            err,
          );
        }
      },
    });

    this.logger.log("ChatGateway Kafka consumer started");
  }

  async onModuleDestroy() {
    await this.consumer.disconnect();
  }

  private fanOut(topic: string, payload: unknown) {
    if (!payload || typeof payload !== "object") return;
    const p = payload as Record<string, unknown>;

    if (topic === ChatTopics.MESSAGE_SENT) {
      if (!p.senderId || !p.receiverId) return;
      const event = p as unknown as MessageSentEventV1;
      this.presenceGateway.emitToRoom(
        `user:${event.receiverId}`,
        "message.new",
        event,
      );
      this.presenceGateway.emitToRoom(
        `user:${event.senderId}`,
        "message.new",
        event,
      );
    } else if (topic === ChatTopics.MESSAGE_EDITED) {
      if (!p.conversationId) return;
      const event = p as unknown as MessageEditedEventV1;
      this.presenceGateway.emitToRoom(
        `conversation:${event.conversationId}`,
        "message.updated",
        event,
      );
    } else if (topic === ChatTopics.MESSAGE_DELETED) {
      if (!p.conversationId) return;
      const event = p as unknown as MessageDeletedEventV1;
      this.presenceGateway.emitToRoom(
        `conversation:${event.conversationId}`,
        "message.deleted",
        event,
      );
    } else if (topic === FriendTopics.FRIEND_REMOVED) {
      if (!p.userId || !p.friendId) return;
      const event = p as unknown as FriendRemovedEventV1;
      // Notify both sides so each user's conversation list updates in real-time.
      this.presenceGateway.emitToRoom(
        `user:${event.userId}`,
        "friendship.removed",
        event,
      );
      this.presenceGateway.emitToRoom(
        `user:${event.friendId}`,
        "friendship.removed",
        event,
      );
    }
  }
}
