export enum ChatTopics {
  MESSAGE_SENT = "message.sent.v1",
  MESSAGE_DELIVERED = "message.delivered.v1",
  MESSAGE_EDITED = "message.edited.v1",
  MESSAGE_DELETED = "message.deleted.v1",
  MESSAGE_READ = "message.read.v1",
  MESSAGE_REACTION_TOGGLED = "message.reaction.toggled.v1",
}

export enum MessageType {
  TEXT = "TEXT",
}

export enum MessageStatus {
  SENT = "SENT",
  DELIVERED = "DELIVERED",
  READ = "READ",
}

/** Immutable snapshot of the quoted message, embedded in MessageSentEventV1.replyTo. */
export interface ReplyToSnapshot {
  messageId: string;
  senderId: string;
  content: string;
}

export interface MessageSentEventV1 {
  messageId: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  content: string;
  type: MessageType;
  sentAt: string;
  replyTo?: ReplyToSnapshot;
}

export interface MessageDeliveredEventV1 {
  conversationId: string;
  senderId: string;
  recipientId: string;
  deliveredAt: string;
}

export interface MessageReadEventV1 {
  conversationId: string;
  readerId: string;
  senderId: string;
  lastReadAt: string;
}

export interface MessageEditedEventV1 {
  messageId: string;
  conversationId: string;
  senderId: string;
  content: string;
  editedAt: string;
}

export interface MessageDeletedEventV1 {
  messageId: string;
  conversationId: string;
  senderId: string;
  deletedAt: string;
}

export interface MessageReactionToggledEventV1 {
  messageId: string;
  conversationId: string;
  senderId: string;
  reactorId: string;
  emoji: string;
  action: "added" | "removed";
  toggledAt: string;
}
