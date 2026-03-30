import { UserProfile } from '@prisma/client-user';

export interface UserProfileRepository {
  findById(id: string): Promise<UserProfile | null>;

  findByUsername(username: string): Promise<UserProfile | null>;

  findAllExcept(ids: string[]): Promise<UserProfile[]>;

  upsert(data: {
    id: string;
    username: string;
    fullName?: string;
    avatarUrl?: string;
    isOnline?: boolean;
  }): Promise<UserProfile>;
}
