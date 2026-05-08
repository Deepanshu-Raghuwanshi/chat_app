export interface ConversationParticipantProps {
  id: string;
  conversationId: string;
  userId: string;
  username: string;
  fullName?: string;
  avatarUrl?: string;
  lastReadAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class ConversationParticipantEntity {
  constructor(private readonly props: ConversationParticipantProps) {}

  get id() {
    return this.props.id;
  }
  get conversationId() {
    return this.props.conversationId;
  }
  get userId() {
    return this.props.userId;
  }
  get username() {
    return this.props.username;
  }
  get fullName() {
    return this.props.fullName;
  }
  get avatarUrl() {
    return this.props.avatarUrl;
  }
  get lastReadAt() {
    return this.props.lastReadAt;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }

  static create(
    props: ConversationParticipantProps,
  ): ConversationParticipantEntity {
    return new ConversationParticipantEntity(props);
  }
}
