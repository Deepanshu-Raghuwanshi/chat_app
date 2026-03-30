import { PresenceStatus } from '@kafka-events';

export interface PresenceRepository {
  setStatus(userId: string, status: PresenceStatus): Promise<void>;
  getStatus(userId: string): Promise<PresenceStatus>;
  getStatuses(userIds: string[]): Promise<Map<string, PresenceStatus>>;
}
