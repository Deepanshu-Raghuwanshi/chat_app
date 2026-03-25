export interface FriendshipProps {
  id: string;
  userId1: string;
  userId2: string;
  createdAt: Date;
}

export class Friendship {
  constructor(private readonly props: FriendshipProps) {}

  get id(): string { return this.props.id; }
  get userId1(): string { return this.props.userId1; }
  get userId2(): string { return this.props.userId2; }
  get createdAt(): Date { return this.props.createdAt; }

  static create(props: FriendshipProps): Friendship {
    return new Friendship(props);
  }
}
