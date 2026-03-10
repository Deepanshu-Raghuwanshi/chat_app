import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { UserTopics, UserCreatedEventV1 } from '@kafka-events/index';
import { PrismaService } from '../persistence/prisma.service';

@Injectable()
export class UserEventsConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UserEventsConsumer.name);
  private kafka: Kafka;
  private consumer: Consumer;

  constructor(private prisma: PrismaService) {
    this.kafka = new Kafka({
      clientId: 'user-service-consumer',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    });
    this.consumer = this.kafka.consumer({ groupId: 'user-service-group' });
  }

  async onModuleInit() {
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: UserTopics.USER_CREATED, fromBeginning: true });

    await this.consumer.run({
      eachMessage: async ({ message }: EachMessagePayload) => {
        if (!message.value) return;
        const payload: UserCreatedEventV1 = JSON.parse(message.value.toString());
        await this.handleUserCreated(payload);
      },
    });
  }

  async onModuleDestroy() {
    await this.consumer.disconnect();
  }

  private async handleUserCreated(event: UserCreatedEventV1) {
    this.logger.log(`Handling USER_CREATED for user: ${event.id}`);

    try {
      await this.prisma.userProfile.upsert({
        where: { id: event.id },
        update: {}, // Idempotency: do nothing if already exists
        create: {
          id: event.id,
          username: event.email.split('@')[0] + '_' + Math.random().toString(36).substring(2, 5),
          fullName: event.email.split('@')[0],
        },
      });
      this.logger.log(`Profile created/verified for user: ${event.id}`);
    } catch (error) {
      this.logger.error(`Error creating profile for user: ${event.id}`, error);
    }
  }
}
