import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Kafka, Consumer } from "kafkajs";
import { FriendshipVerifier } from "../../application/ports/friendship-verifier.port";
import {
  FriendTopics,
  FriendRequestAcceptedEventV1,
  FriendRemovedEventV1,
} from "@kafka-events";
import { RedisService } from "./redis.service";

@Injectable()
export class FriendshipCacheService
  implements FriendshipVerifier, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(FriendshipCacheService.name);
  private readonly PREFIX = "friendship:";
  private consumer: Consumer;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    const kafka = new Kafka({
      clientId: "chat-service-friendship",
      brokers: (
        this.configService.get<string>("KAFKA_BROKERS") || "localhost:9092"
      ).split(","),
    });
    this.consumer = kafka.consumer({ groupId: "friendship-cache-consumer" });
  }

  async onModuleInit() {
    await this.consumer.connect();
    await this.consumer.subscribe({
      topic: FriendTopics.FRIEND_REQUEST_ACCEPTED,
      fromBeginning: true,
    });
    await this.consumer.subscribe({
      topic: FriendTopics.FRIEND_REMOVED,
      fromBeginning: true,
    });

    await this.consumer.run({
      eachMessage: async ({ topic, message }) => {
        try {
          if (topic === FriendTopics.FRIEND_REQUEST_ACCEPTED) {
            const event = JSON.parse(
              message.value?.toString() ?? "{}",
            ) as FriendRequestAcceptedEventV1;
            const key = this.buildKey(event.senderId, event.receiverId);
            await this.redisService.client.set(key, "1");
            this.logger.debug(`Cached friendship: ${key}`);
          } else if (topic === FriendTopics.FRIEND_REMOVED) {
            const event = JSON.parse(
              message.value?.toString() ?? "{}",
            ) as FriendRemovedEventV1;
            const key = this.buildKey(event.userId, event.friendId);
            await this.redisService.client.del(key);
            this.logger.debug(`Removed friendship cache: ${key}`);
          }
        } catch (err) {
          this.logger.error(`Error processing event on topic ${topic}`, err);
        }
      },
    });
  }

  async onModuleDestroy() {
    await this.consumer.disconnect();
  }

  async areFriends(userId1: string, userId2: string): Promise<boolean> {
    const key = this.buildKey(userId1, userId2);
    const value = await this.redisService.client.get(key);
    return value === "1";
  }

  private buildKey(a: string, b: string): string {
    const [min, max] = [a, b].sort();
    return `${this.PREFIX}${min}:${max}`;
  }
}
