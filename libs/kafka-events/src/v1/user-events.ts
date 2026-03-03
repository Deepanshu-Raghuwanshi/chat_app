export enum UserTopics {
  USER_CREATED = 'user.created.v1',
  USER_UPDATED = 'user.updated.v1',
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
