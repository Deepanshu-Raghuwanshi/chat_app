import { UserProfile } from "@prisma/client-user";

export interface UserProfileRepository {
  findById(id: string): Promise<UserProfile | null>;

  findByUsername(username: string): Promise<UserProfile | null>;

  findAllExcept(ids: string[]): Promise<UserProfile[]>;

  search(query: string, excludeIds: string[]): Promise<UserProfile[]>;

  upsert(data: {
    id: string;
    username: string;
    fullName?: string;
    avatarUrl?: string;
    bio?: string;
    phoneNumber?: string;
    countryCode?: string;
    status?: string;
    isOnline?: boolean;
  }): Promise<UserProfile>;

  update(
    id: string,
    data: {
      fullName?: string;
      avatarUrl?: string;
      bio?: string;
      phoneNumber?: string;
      countryCode?: string;
      status?: string;
      isOnline?: boolean;
      theme?: string;
    },
  ): Promise<UserProfile>;
}
