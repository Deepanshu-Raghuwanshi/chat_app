import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Conversation } from "./schemas/conversation.schema";
import {
  ConversationRepository,
  CreateConversationInput,
} from "../../../application/ports/conversation.repository";
import {
  ConversationEntity,
  LastMessageSnapshot,
} from "../../../domain/entities/conversation.entity";

@Injectable()
export class MongooseConversationRepository implements ConversationRepository {
  constructor(
    @InjectModel(Conversation.name) private readonly model: Model<Conversation>,
  ) {}

  async findById(id: string): Promise<ConversationEntity | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const doc = await this.model.findById(id).exec();
    return doc ? this.toEntity(doc) : null;
  }

  async findByParticipants(
    userId1: string,
    userId2: string,
  ): Promise<ConversationEntity | null> {
    const [p1Id, p2Id] = [userId1, userId2].sort();
    const doc = await this.model
      .findOne({ participant1Id: p1Id, participant2Id: p2Id })
      .exec();
    return doc ? this.toEntity(doc) : null;
  }

  async findByUserId(
    userId: string,
    limit: number,
    before?: string,
  ): Promise<ConversationEntity[]> {
    const query: Record<string, unknown> = {
      $or: [{ participant1Id: userId }, { participant2Id: userId }],
    };

    if (before && Types.ObjectId.isValid(before)) {
      const cursor = await this.model.findById(before).exec();
      if (cursor) {
        query["lastActivityAt"] = { $lt: cursor.lastActivityAt };
      }
    }

    const docs = await this.model
      .find(query)
      .sort({ lastActivityAt: -1 })
      .limit(limit)
      .exec();
    return docs.map((d) => this.toEntity(d));
  }

  async findByIds(ids: string[]): Promise<ConversationEntity[]> {
    const objectIds = ids
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    const docs = await this.model
      .find({ _id: { $in: objectIds } })
      .sort({ lastActivityAt: -1 })
      .exec();

    return docs.map((d) => this.toEntity(d));
  }

  async create(data: CreateConversationInput): Promise<ConversationEntity> {
    const doc = await this.model.create({
      participant1Id: data.participant1Id,
      participant2Id: data.participant2Id,
    });
    return this.toEntity(doc);
  }

  async updateLastMessage(
    id: string,
    snapshot: LastMessageSnapshot,
  ): Promise<void> {
    await this.model
      .findByIdAndUpdate(id, {
        $set: {
          lastMessage: {
            messageId: snapshot.messageId,
            senderId: snapshot.senderId,
            content: snapshot.content,
            sentAt: snapshot.sentAt,
          },
          lastActivityAt: snapshot.sentAt,
        },
      })
      .exec();
  }

  private toEntity(doc: Conversation): ConversationEntity {
    return ConversationEntity.create({
      id: (doc._id as Types.ObjectId).toString(),
      participant1Id: doc.participant1Id,
      participant2Id: doc.participant2Id,
      lastMessage: doc.lastMessage
        ? {
            messageId: doc.lastMessage.messageId,
            senderId: doc.lastMessage.senderId,
            content: doc.lastMessage.content,
            sentAt: doc.lastMessage.sentAt,
          }
        : undefined,
      lastActivityAt: doc.lastActivityAt,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  }
}
