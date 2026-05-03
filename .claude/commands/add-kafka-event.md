Read the following files before doing anything else:
- docs/architecture.md
- libs/kafka-events/src/index.ts
- libs/kafka-events/src/v1/ (read all event files)
- apps/auth-service/src/infrastructure/messaging/ (Kafka producer pattern reference)
- apps/user-service/src/infrastructure/messaging/ (Kafka consumer pattern reference)

You are adding a new Kafka event: **$ARGUMENTS**

---

## Your Task

Add a new Kafka event to the system end-to-end — from the event contract in `@kafka-events`, through the producer in the source service, to the consumer(s) in the target service(s).

---

## Step 1 — Define the Event Contract

Determine:
1. **Topic name**: must end in `.v1` (e.g. `message.sent.v1`)
2. **Producer service**: which service triggers this event?
3. **Consumer service(s)**: which service(s) need to react?
4. **Payload**: what data does the event carry? (no optional fields unless truly optional)

Add to `libs/kafka-events/src/v1/<domain>-events.ts`:

```typescript
// Add to the existing enum
export enum <Domain>Topics {
  // existing...
  <TOPIC_CONSTANT> = '<domain>.<action>.v1',
}

// Add the payload interface
export interface <Domain><Action>EventV1 {
  id: string;           // always include entity ID
  // ... all required fields
  occurredAt: string;   // ISO 8601 timestamp, always include
}
```

Then export it from `libs/kafka-events/src/index.ts`:
```typescript
export * from './v1/<domain>-events';
```

---

## Step 2 — Implement the Producer

In the source service at `apps/<service>/src/infrastructure/messaging/kafka-producer.service.ts`:

```typescript
@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly kafka: Kafka;
  private producer: Producer;
  private readonly logger = new Logger(KafkaProducerService.name);

  constructor(private readonly configService: ConfigService) {
    this.kafka = new Kafka({
      clientId: '<service-name>',
      brokers: this.configService.get<string>('KAFKA_BROKERS').split(','),
    });
    this.producer = this.kafka.producer();
  }

  async onModuleInit() {
    await this.producer.connect();
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
  }

  async emit<T>(topic: string, payload: T): Promise<void> {
    await this.producer.send({
      topic,
      messages: [{ value: JSON.stringify(payload) }],
    });
    this.logger.debug(`Emitted event to topic: ${topic}`);
  }
}
```

Call it from the use case:
```typescript
await this.kafkaProducer.emit(<Domain>Topics.<TOPIC_CONSTANT>, {
  id: result.id,
  // ... other payload fields
  occurredAt: new Date().toISOString(),
} satisfies <Domain><Action>EventV1);
```

The `satisfies` keyword ensures the payload matches the event interface at compile time.

---

## Step 3 — Implement the Consumer

In the target service at `apps/<service>/src/infrastructure/messaging/<domain>-consumer.service.ts`:

```typescript
@Injectable()
export class <Domain>ConsumerService implements OnModuleInit {
  private readonly kafka: Kafka;
  private consumer: Consumer;
  private readonly logger = new Logger(<Domain>ConsumerService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly <action>UseCase: <Action>UseCase,
  ) {
    this.kafka = new Kafka({
      clientId: '<consuming-service>-consumer',
      brokers: this.configService.get<string>('KAFKA_BROKERS').split(','),
    });
    this.consumer = this.kafka.consumer({
      groupId: '<consuming-service>-group',
    });
  }

  async onModuleInit() {
    await this.consumer.connect();
    await this.consumer.subscribe({
      topic: <Domain>Topics.<TOPIC_CONSTANT>,
      fromBeginning: false,
    });

    await this.consumer.run({
      eachMessage: async ({ message }) => {
        try {
          const payload = JSON.parse(message.value.toString()) as <Domain><Action>EventV1;
          await this.<action>UseCase.execute(payload);
        } catch (error) {
          this.logger.error(`Failed to process <domain>.<action>.v1`, error);
          // Do NOT re-throw — let Kafka continue; log for manual review
        }
      },
    });
  }

  async onModuleDestroy() {
    await this.consumer.disconnect();
  }
}
```

**Consumer group name**: always `<service-name>-group`, consistent across all consumers in the same service.

---

## Step 4 — Register in Module

Add both producer and consumer to the relevant NestJS module providers:

```typescript
@Module({
  providers: [
    KafkaProducerService,   // in the producing service
    <Domain>ConsumerService, // in the consuming service
    <Action>UseCase,
  ],
})
export class <Domain>Module {}
```

---

## Step 5 — Update the Architecture Doc

Open `docs/architecture.md` and add the new topic to the **Kafka Topics** table in section 6.4:

```markdown
| `<domain>.<action>.v1` | <producing-service> | <consuming-service(s)> |
```

---

## Rules

- Topic name: always lowercase, dot-separated, ending in `.v1`
- Consumer errors: **never** crash the consumer — catch, log, and continue
- Event payload: use `satisfies <EventInterface>` when emitting to catch type errors at compile time
- Consumer group: one stable group name per consuming service (`<service>-group`)
- `occurredAt` field: always include as ISO 8601 string for event ordering and debugging
- Never hardcode topic strings in use cases or controllers — always use the enum from `@kafka-events`

---

## Verification

```bash
pnpm nx typecheck <producer-service>    # No type errors
pnpm nx typecheck <consumer-service>    # No type errors
pnpm nx lint <producer-service>
pnpm nx lint <consumer-service>
```

Then start infra and both services to verify the event flows end-to-end:
```bash
pnpm start:infra
pnpm start:<producer-service>
pnpm start:<consumer-service>
```
