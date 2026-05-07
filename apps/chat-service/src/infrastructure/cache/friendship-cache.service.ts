import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Kafka, Consumer } from "kafkajs";
import { FriendshipVerifier } from "../../application/ports/friendship-verifier.port";
import { FriendTopics, FriendRequestAcceptedEventV1 } from "@kafka-events";
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

    await this.consumer.run({
      eachMessage: async ({ message }) => {
        try {
          const event = JSON.parse(
            message.value?.toString() ?? "{}",
          ) as FriendRequestAcceptedEventV1;
          const key = this.buildKey(event.senderId, event.receiverId);
          await this.redisService.client.set(key, "1");
          this.logger.debug(`Cached friendship: ${key}`);
        } catch (err) {
          this.logger.error(
            "Error processing friend.request.accepted event",
            err,
          );
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
