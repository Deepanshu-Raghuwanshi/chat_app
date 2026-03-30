import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { LoggerModule } from 'nestjs-pino';
import { TerminusModule } from '@nestjs/terminus';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { JwtModule } from '@nestjs/jwt';
import { validate } from './config/env.validation';
import { HealthController } from './interfaces/controllers/health.controller';
import { PresenceGateway } from './interfaces/gateways/presence.gateway';
import { RedisPresenceRepository } from './infrastructure/cache/redis-presence.repository';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URL') || 'mongodb://localhost:27017/chat',
      }),
    }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET') || 'access-secret',
        signOptions: { expiresIn: '1h' },
      }),
    }),
    ClientsModule.registerAsync([
      {
        name: 'KAFKA_SERVICE',
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: 'chat-service',
              brokers: config.get<string>('KAFKA_BROKERS')?.split(',') || ['localhost:9092'],
            },
            consumer: {
              groupId: 'chat-service-consumer',
            },
          },
        }),
      },
    ]),
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
  providers: [
    PresenceGateway,
    {
      provide: 'PresenceRepository',
      useClass: RedisPresenceRepository,
    },
  ],
})
export class AppModule {}
