import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { TerminusModule } from '@nestjs/terminus';
import { validate } from './config/env.validation';
import { HealthController } from './interfaces/controllers/health.controller';
import { PrismaService } from './infrastructure/persistence/prisma.service';
import { PrismaHealthIndicator } from './infrastructure/persistence/prisma.health';
import { UserEventsConsumer } from './infrastructure/messaging/user-events.consumer';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
        transport: process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty' }
          : undefined,
      },
    }),
    TerminusModule,
  ],
  controllers: [HealthController],
  providers: [PrismaService, PrismaHealthIndicator, UserEventsConsumer],
})
export class AppModule {}
