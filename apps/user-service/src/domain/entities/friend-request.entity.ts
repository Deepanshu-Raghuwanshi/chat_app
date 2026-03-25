export enum FriendRequestStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

export interface FriendRequestProps {
  id: string;
  senderId: string;
  receiverId: string;
  status: FriendRequestStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class FriendRequest {
  constructor(private readonly props: FriendRequestProps) {}

  get id(): string { return this.props.id; }
  get senderId(): string { return this.props.senderId; }
  get receiverId(): string { return this.props.receiverId; }
  get status(): FriendRequestStatus { return this.props.status; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  static create(props: FriendRequestProps): FriendRequest {
    return new FriendRequest(props);
  }
}
