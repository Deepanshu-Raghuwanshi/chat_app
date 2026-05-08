export interface LastMessageSnapshot {
  messageId: string;
  senderId: string;
  content: string;
  sentAt: Date;
}

export interface ConversationProps {
  id: string;
  participant1Id: string;
  participant2Id: string;
  lastMessage?: LastMessageSnapshot;
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class ConversationEntity {
  constructor(private readonly props: ConversationProps) {}

  get id() {
    return this.props.id;
  }
  get participant1Id() {
    return this.props.participant1Id;
  }
  get participant2Id() {
    return this.props.participant2Id;
  }
  get lastMessage() {
    return this.props.lastMessage;
  }
  get lastActivityAt() {
    return this.props.lastActivityAt;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }

  static create(props: ConversationProps): ConversationEntity {
    return new ConversationEntity(props);
  }
}
