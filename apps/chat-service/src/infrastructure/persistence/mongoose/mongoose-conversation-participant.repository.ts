import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { ConversationParticipant } from "./schemas/conversation-participant.schema";
import {
  ConversationParticipantRepository,
  CreateParticipantInput,
} from "../../../application/ports/conversation-participant.repository";
import { ConversationParticipantEntity } from "../../../domain/entities/conversation-participant.entity";

@Injectable()
export class MongooseConversationParticipantRepository implements ConversationParticipantRepository {
  constructor(
    @InjectModel(ConversationParticipant.name)
    private readonly model: Model<ConversationParticipant>,
  ) {}

  async findByConversationAndUser(
    conversationId: string,
    userId: string,
  ): Promise<ConversationParticipantEntity | null> {
    const doc = await this.model.findOne({ conversationId, userId }).exec();
    return doc ? this.toEntity(doc) : null;
  }

  async findByConversationId(
    conversationId: string,
  ): Promise<ConversationParticipantEntity[]> {
    const docs = await this.model.find({ conversationId }).exec();
    return docs.map((d) => this.toEntity(d));
  }

  async create(
    data: CreateParticipantInput,
  ): Promise<ConversationParticipantEntity> {
    const doc = await this.model.create({
      conversationId: data.conversationId,
      userId: data.userId,
      username: data.username,
      fullName: data.fullName,
      avatarUrl: data.avatarUrl,
    });
    return this.toEntity(doc);
  }

  async updateLastRead(
    conversationId: string,
    userId: string,
    lastReadAt: Date,
  ): Promise<void> {
    await this.model
      .findOneAndUpdate({ conversationId, userId }, { $set: { lastReadAt } })
      .exec();
  }

  private toEntity(
    doc: ConversationParticipant,
  ): ConversationParticipantEntity {
    return ConversationParticipantEntity.create({
      id: (doc._id as Types.ObjectId).toString(),
      conversationId: doc.conversationId,
      userId: doc.userId,
      username: doc.username,
      fullName: doc.fullName,
      avatarUrl: doc.avatarUrl,
      lastReadAt: doc.lastReadAt,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  }
}
