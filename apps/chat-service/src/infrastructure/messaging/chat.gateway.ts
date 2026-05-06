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

    if (topic === ChatTopics.MESSAGE_SENT) {
      const event = payload as MessageSentEventV1;
      if (!event.senderId || !event.receiverId) return;
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
      const event = payload as MessageEditedEventV1;
      if (!event.conversationId) return;
      this.presenceGateway.emitToRoom(
        `conversation:${event.conversationId}`,
        "message.updated",
        event,
      );
    } else if (topic === ChatTopics.MESSAGE_DELETED) {
      const event = payload as MessageDeletedEventV1;
      if (!event.conversationId) return;
      this.presenceGateway.emitToRoom(
        `conversation:${event.conversationId}`,
        "message.deleted",
        event,
      );
    }
  }
}
