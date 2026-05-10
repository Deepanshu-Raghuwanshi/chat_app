import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { ConversationParticipant } from "./schemas/conversation-participant.schema";
import {
  ConversationParticipantRepository,
  CreateParticipantInput,
  UpdateParticipantProfileInput,
  UpdateParticipantProfileByUserInput,
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

  async updateProfile(data: UpdateParticipantProfileInput): Promise<void> {
    const fields: Partial<Record<string, unknown>> = {};
    if (data.username !== undefined) fields.username = data.username;
    if (data.fullName !== undefined) fields.fullName = data.fullName;
    if (data.avatarUrl !== undefined) fields.avatarUrl = data.avatarUrl;
    if (Object.keys(fields).length === 0) return;
    await this.model
      .findOneAndUpdate(
        { conversationId: data.conversationId, userId: data.userId },
        { $set: fields },
      )
      .exec();
  }

  async updateProfileByUserId(
    data: UpdateParticipantProfileByUserInput,
  ): Promise<void> {
    const fields: Partial<Record<string, unknown>> = {};
    if (data.username !== undefined) fields.username = data.username;
    if (data.fullName !== undefined) fields.fullName = data.fullName;
    if (data.avatarUrl !== undefined) fields.avatarUrl = data.avatarUrl;
    if (Object.keys(fields).length === 0) return;
    await this.model
      .updateMany({ userId: data.userId }, { $set: fields })
      .exec();
  }

  async findConversationIdsByParticipantName(
    userId: string,
    query: string,
  ): Promise<string[]> {
    const myParticipations = await this.model
      .find({ userId })
      .select("conversationId")
      .lean()
      .exec();

    const myConvIds = myParticipations.map((p) => p.conversationId);
    if (myConvIds.length === 0) return [];

    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");

    const matched = await this.model
      .find({
        conversationId: { $in: myConvIds },
        userId: { $ne: userId },
        $or: [{ username: regex }, { fullName: regex }],
      })
      .select("conversationId")
      .limit(50)
      .lean()
      .exec();

    return matched.map((p) => p.conversationId);
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
