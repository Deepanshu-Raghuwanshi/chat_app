import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { PassportModule } from "@nestjs/passport";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import {
  Conversation,
  ConversationSchema,
} from "./infrastructure/persistence/mongoose/schemas/conversation.schema";
import {
  ConversationParticipant,
  ConversationParticipantSchema,
} from "./infrastructure/persistence/mongoose/schemas/conversation-participant.schema";
import {
  Message,
  MessageSchema,
} from "./infrastructure/persistence/mongoose/schemas/message.schema";
import { MongooseConversationRepository } from "./infrastructure/persistence/mongoose/mongoose-conversation.repository";
import { MongooseConversationParticipantRepository } from "./infrastructure/persistence/mongoose/mongoose-conversation-participant.repository";
import { MongooseMessageRepository } from "./infrastructure/persistence/mongoose/mongoose-message.repository";
import { FriendshipCacheService } from "./infrastructure/cache/friendship-cache.service";
import { KafkaProducerService } from "./infrastructure/messaging/kafka-producer.service";
import { JwtStrategy } from "./infrastructure/strategies/jwt.strategy";
import { ConversationController } from "./interfaces/controllers/conversation.controller";
import { CreateOrGetConversationUseCase } from "./application/use-cases/create-or-get-conversation.use-case";
import { GetConversationUseCase } from "./application/use-cases/get-conversation.use-case";
import { ListConversationsUseCase } from "./application/use-cases/list-conversations.use-case";
import { GetMessagesUseCase } from "./application/use-cases/get-messages.use-case";
import { SendMessageUseCase } from "./application/use-cases/send-message.use-case";
import { EditMessageUseCase } from "./application/use-cases/edit-message.use-case";
import { DeleteMessageUseCase } from "./application/use-cases/delete-message.use-case";
import { MarkConversationReadUseCase } from "./application/use-cases/mark-conversation-read.use-case";
import { SearchConversationsUseCase } from "./application/use-cases/search-conversations.use-case";
import { ConversationViewBuilder } from "./application/services/conversation-view.builder";
import { PresenceGateway } from "./interfaces/gateways/presence.gateway";
import { ChatGateway } from "./infrastructure/messaging/chat.gateway";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      {
        name: ConversationParticipant.name,
        schema: ConversationParticipantSchema,
      },
      { name: Message.name, schema: MessageSchema },
    ]),
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_ACCESS_SECRET") || "access-secret",
        signOptions: { expiresIn: "1h" },
      }),
    }),
    ClientsModule.registerAsync([
      {
        name: "KAFKA_SERVICE",
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: "chat-service",
              brokers: config.get<string>("KAFKA_BROKERS")?.split(",") || [
                "localhost:9092",
              ],
            },
            consumer: {
              groupId: "chat-service-consumer",
            },
          },
        }),
      },
    ]),
  ],
  controllers: [ConversationController],
  providers: [
    // Application services
    ConversationViewBuilder,

    // Use cases
    CreateOrGetConversationUseCase,
    GetConversationUseCase,
    ListConversationsUseCase,
    SearchConversationsUseCase,
    GetMessagesUseCase,
    SendMessageUseCase,
    EditMessageUseCase,
    DeleteMessageUseCase,
    MarkConversationReadUseCase,

    // Gateways
    PresenceGateway,
    ChatGateway,

    // Infrastructure
    KafkaProducerService,
    JwtStrategy,

    // Repository bindings
    {
      provide: "ConversationRepository",
      useClass: MongooseConversationRepository,
    },
    {
      provide: "ConversationParticipantRepository",
      useClass: MongooseConversationParticipantRepository,
    },
    {
      provide: "MessageRepository",
      useClass: MongooseMessageRepository,
    },
    {
      provide: "FriendshipVerifier",
      useClass: FriendshipCacheService,
    },
  ],
})
export class ChatModule {}
