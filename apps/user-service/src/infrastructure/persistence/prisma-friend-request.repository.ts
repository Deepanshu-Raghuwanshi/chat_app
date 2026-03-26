import { Injectable } from '@nestjs/common';
import { FriendRequest, FriendRequestStatus } from '@prisma/client-user';
import { FriendRequestRepository } from '../../application/ports/friend-request.repository';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaFriendRequestRepository implements FriendRequestRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    senderId: string;
    receiverId: string;
    status: FriendRequestStatus;
  }): Promise<FriendRequest> {
    return this.prisma.friendRequest.create({
      data,
    });
  }

  async findById(id: string): Promise<FriendRequest | null> {
    return this.prisma.friendRequest.findUnique({
      where: { id },
    });
  }

  async findBySenderAndReceiver(
    senderId: string,
    receiverId: string
  ): Promise<FriendRequest | null> {
    return this.prisma.friendRequest.findUnique({
      where: {
        senderId_receiverId: {
          senderId,
          receiverId,
        },
      },
    });
  }

  async findIncomingByUserId(userId: string): Promise<FriendRequest[]> {
    return this.prisma.friendRequest.findMany({
      where: {
        receiverId: userId,
        status: FriendRequestStatus.PENDING,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOutgoingByUserId(userId: string): Promise<FriendRequest[]> {
    return this.prisma.friendRequest.findMany({
      where: {
        senderId: userId,
        status: FriendRequestStatus.PENDING,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(
    id: string,
    status: FriendRequestStatus
  ): Promise<FriendRequest> {
    return this.prisma.friendRequest.update({
      where: { id },
      data: { status },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.friendRequest.delete({
      where: { id },
    });
  }
}
