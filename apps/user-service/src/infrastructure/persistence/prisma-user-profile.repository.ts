import { Injectable } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { UserProfile } from "@prisma/client-user";
import { UserProfileRepository } from "../../application/ports/user-profile.repository";

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

  async search(query: string, excludeIds: string[]): Promise<UserProfile[]> {
    return this.prisma.userProfile.findMany({
      where: {
        AND: [
          { id: { notIn: excludeIds } },
          {
            OR: [
              { username: { contains: query, mode: "insensitive" } },
              { fullName: { contains: query, mode: "insensitive" } },
            ],
          },
        ],
      },
      orderBy: { username: "asc" },
      take: 20,
    });
  }

  async upsert(data: {
    id: string;
    username: string;
    fullName?: string;
    avatarUrl?: string;
    bio?: string;
    phoneNumber?: string;
    countryCode?: string;
    status?: string;
    isOnline?: boolean;
  }): Promise<UserProfile> {
    return this.prisma.userProfile.upsert({
      where: { id: data.id },
      update: {
        username: data.username,
        fullName: data.fullName,
        avatarUrl: data.avatarUrl,
        bio: data.bio,
        phoneNumber: data.phoneNumber,
        countryCode: data.countryCode,
        status: data.status,
        isOnline: data.isOnline,
      },
      create: {
        id: data.id,
        username: data.username,
        fullName: data.fullName,
        avatarUrl: data.avatarUrl,
        bio: data.bio,
        phoneNumber: data.phoneNumber,
        countryCode: data.countryCode,
        status: data.status,
        isOnline: data.isOnline,
      },
    });
  }

  async update(
    id: string,
    data: {
      fullName?: string;
      avatarUrl?: string;
      bio?: string;
      phoneNumber?: string;
      countryCode?: string;
      status?: string;
      isOnline?: boolean;
      theme?: string;
    },
  ): Promise<UserProfile> {
    return this.prisma.userProfile.update({
      where: { id },
      data,
    });
  }
}
