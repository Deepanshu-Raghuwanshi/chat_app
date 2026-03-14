import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client-user';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    const pool = new Pool({
      connectionString: process.env.USER_DATABASE_URL,
      options: '-c search_path=user_service',
    });
    const adapter = new PrismaPg(pool);
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }
}
