export enum FriendTopics {
  FRIEND_REQUEST_SENT = "friend.request.sent.v1",
  FRIEND_REQUEST_ACCEPTED = "friend.request.accepted.v1",
  FRIEND_REMOVED = "friend.removed.v1",
}

export interface FriendRequestSentEventV1 {
  requestId: string;
  senderId: string;
  receiverId: string;
}

export interface FriendRequestAcceptedEventV1 {
  requestId: string;
  senderId: string;
  receiverId: string;
}

export interface FriendRemovedEventV1 {
  userId: string;
  friendId: string;
}
