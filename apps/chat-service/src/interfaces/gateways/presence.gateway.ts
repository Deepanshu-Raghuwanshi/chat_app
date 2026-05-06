import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Inject, Logger } from "@nestjs/common";
import { ClientKafka } from "@nestjs/microservices";
import { JwtService } from "@nestjs/jwt";
import { PresenceRepository } from "../../application/ports/presence.repository";
import {
  UserTopics,
  PresenceStatus,
  UserPresenceUpdatedEventV1,
} from "@kafka-events";

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  },
  namespace: "presence",
})
export class PresenceGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(PresenceGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    @Inject("PresenceRepository")
    private readonly presenceRepository: PresenceRepository,
    @Inject("KAFKA_SERVICE")
    private readonly kafkaClient: ClientKafka,
    private readonly jwtService: JwtService,
  ) {}

  async handleConnection(client: Socket) {
    const userId = this.getUserId(client);
    if (!userId) {
      client.disconnect();
      return;
    }

    this.logger.debug(`User connected: ${userId}`);
    await client.join(`user:${userId}`);
    await this.presenceRepository.setStatus(userId, PresenceStatus.ONLINE);

    const event: UserPresenceUpdatedEventV1 = {
      userId,
      status: PresenceStatus.ONLINE,
    };
    this.kafkaClient.emit(UserTopics.USER_PRESENCE_UPDATED, event);

    // Notify all clients about the status change
    this.server.emit("presence.updated", event);
  }

  async handleDisconnect(client: Socket) {
    const userId = this.getUserId(client);
    if (!userId) return;

    this.logger.debug(`User disconnected: ${userId}`);
    await this.presenceRepository.setStatus(userId, PresenceStatus.OFFLINE);

    const event: UserPresenceUpdatedEventV1 = {
      userId,
      status: PresenceStatus.OFFLINE,
    };
    this.kafkaClient.emit(UserTopics.USER_PRESENCE_UPDATED, event);

    // Notify all clients about the status change
    this.server.emit("presence.updated", event);
  }

  emitToRoom(room: string, event: string, payload: unknown): void {
    this.server?.to(room).emit(event, payload);
  }

  private getUserId(client: Socket): string | null {
    const token = client.handshake.auth?.token || client.handshake.query?.token;

    // Try to get from cookie if available
    let accessToken = token;
    if (!accessToken) {
      const cookies = client.handshake.headers.cookie;
      if (cookies) {
        const match = cookies.match(/access_token=([^;]+)/);
        if (match) accessToken = match[1];
      }
    }

    // Allow direct userId override only in non-production environments for debugging
    const directUserId = client.handshake.query?.userId;
    if (process.env.NODE_ENV !== "production" && directUserId)
      return directUserId as string;

    if (!accessToken) return null;

    try {
      const payload = this.jwtService.verify(accessToken);
      return payload.sub;
    } catch (e) {
      this.logger.error(`Invalid token for presence gateway: ${e}`);
      return null;
    }
  }
}
