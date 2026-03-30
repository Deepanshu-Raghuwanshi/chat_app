import { PresenceStatus } from '@kafka-events';

export interface PresenceRepository {
  getStatus(userId: string): Promise<PresenceStatus>;
  getStatuses(userIds: string[]): Promise<Map<string, PresenceStatus>>;
}
