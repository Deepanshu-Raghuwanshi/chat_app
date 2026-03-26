export enum FriendTopics {
  FRIEND_REQUEST_SENT = 'friend.request.sent.v1',
  FRIEND_REQUEST_ACCEPTED = 'friend.request.accepted.v1',
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
