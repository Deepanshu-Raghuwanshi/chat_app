import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';
import { UserTopics, UserCreatedEventV1 } from '@kafka-events/index';

@Injectable()
export class UserEventsProducer implements OnModuleInit, OnModuleDestroy {
  private kafka: Kafka;
  private producer: Producer;

  constructor() {
    this.kafka = new Kafka({
      clientId: 'auth-service',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    });
    this.producer = this.kafka.producer();
  }

  async onModuleInit() {
    await this.producer.connect();
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
  }

  async emitUserCreated(event: UserCreatedEventV1) {
    await this.producer.send({
      topic: UserTopics.USER_CREATED,
      messages: [
        {
          key: event.id,
          value: JSON.stringify(event),
        },
      ],
    });
  }
}
