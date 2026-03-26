import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { UserProfile } from '@prisma/client-user';
import { UserProfileRepository } from '../../application/ports/user-profile.repository';

@Injectable()
export class PrismaUserProfileRepository implements UserProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<UserProfile | null> {
    return this.prisma.userProfile.findUnique({
      where: { id },
    });
  }

  async findByUsername(username: string): Promise<UserProfile | null> {
    return this.prisma.userProfile.findUnique({
      where: { username },
    });
  }

  async findAllExcept(ids: string[]): Promise<UserProfile[]> {
    return this.prisma.userProfile.findMany({
      where: {
        id: {
          notIn: ids,
        },
      },
      take: 20, // Limit recommendations
    });
  }

  async upsert(data: {
    id: string;
    username: string;
    fullName?: string;
    avatarUrl?: string;
  }): Promise<UserProfile> {
    return this.prisma.userProfile.upsert({
      where: { id: data.id },
      update: {
        username: data.username,
        fullName: data.fullName,
        avatarUrl: data.avatarUrl,
      },
      create: {
        id: data.id,
        username: data.username,
        fullName: data.fullName,
        avatarUrl: data.avatarUrl,
      },
    });
  }
}
