export enum ChatTopics {
  MESSAGE_SENT = 'message.sent.v1',
  MESSAGE_READ = 'message.read.v1',
}

export enum MessageType {
  TEXT = 'TEXT',
}

export enum MessageStatus {
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
}

export interface MessageSentEventV1 {
  messageId: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  content: string;
  type: MessageType;
  sentAt: string;
}

export interface MessageReadEventV1 {
  conversationId: string;
  userId: string;
  lastReadAt: string;
}
