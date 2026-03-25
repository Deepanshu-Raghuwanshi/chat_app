import { FriendRequest, FriendRequestStatus } from '@prisma/client-user';

export interface FriendRequestRepository {
  create(data: {
    senderId: string;
    receiverId: string;
    status: FriendRequestStatus;
  }): Promise<FriendRequest>;

  findById(id: string): Promise<FriendRequest | null>;

  findBySenderAndReceiver(
    senderId: string,
    receiverId: string
  ): Promise<FriendRequest | null>;

  findIncomingByUserId(userId: string): Promise<FriendRequest[]>;

  findOutgoingByUserId(userId: string): Promise<FriendRequest[]>;

  updateStatus(id: string, status: FriendRequestStatus): Promise<FriendRequest>;

  delete(id: string): Promise<void>;
}
