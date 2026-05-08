import { Injectable } from "@nestjs/common";
import { PresenceRepository } from "../../application/ports/presence.repository";
import { PresenceStatus } from "@kafka-events";
import { RedisService } from "./redis.service";

@Injectable()
export class RedisPresenceRepository implements PresenceRepository {
  private readonly PRESENCE_PREFIX = "presence:";

  constructor(private readonly redisService: RedisService) {}

  async setStatus(userId: string, status: PresenceStatus): Promise<void> {
    await this.redisService.client.set(
      `${this.PRESENCE_PREFIX}${userId}`,
      status,
    );
  }

  async getStatus(userId: string): Promise<PresenceStatus> {
    const status = await this.redisService.client.get(
      `${this.PRESENCE_PREFIX}${userId}`,
    );
    return (status as PresenceStatus) || PresenceStatus.OFFLINE;
  }

  async getStatuses(userIds: string[]): Promise<Map<string, PresenceStatus>> {
    const result = new Map<string, PresenceStatus>();
    if (userIds.length === 0) return result;

    const keys = userIds.map((id) => `${this.PRESENCE_PREFIX}${id}`);
    const statuses = await this.redisService.client.mGet(keys);

    userIds.forEach((id, index) => {
      result.set(
        id,
        (statuses[index] as PresenceStatus) || PresenceStatus.OFFLINE,
      );
    });

    return result;
  }
}
