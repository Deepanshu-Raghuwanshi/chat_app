export enum UserTopics {
  USER_CREATED = 'user.created.v1',
  USER_UPDATED = 'user.updated.v1',
  USER_PRESENCE_UPDATED = 'user.presence.updated.v1',
}

export enum PresenceStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
}

export interface UserPresenceUpdatedEventV1 {
  userId: string;
  status: PresenceStatus;
}

export interface UserCreatedEventV1 {
  id: string;
  email: string;
}

export interface UserUpdatedEventV1 {
  id: string;
  username?: string;
  fullName?: string;
  avatarUrl?: string;
}
