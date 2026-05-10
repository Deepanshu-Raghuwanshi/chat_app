import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Message } from "./schemas/message.schema";
import {
  MessageRepository,
  CreateMessageInput,
  UpdateMessageInput,
} from "../../../application/ports/message.repository";
import { MessageEntity } from "../../../domain/entities/message.entity";
import { MessageStatus } from "@kafka-events";

@Injectable()
export class MongooseMessageRepository implements MessageRepository {
  constructor(
    @InjectModel(Message.name) private readonly model: Model<Message>,
  ) {}

  async findById(id: string): Promise<MessageEntity | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const doc = await this.model.findById(id).exec();
    return doc ? this.toEntity(doc) : null;
  }

  async findByConversationId(
    conversationId: string,
    limit: number,
    before?: string,
  ): Promise<MessageEntity[]> {
    const query: Record<string, unknown> = { conversationId };

    if (before && Types.ObjectId.isValid(before)) {
      const cursor = await this.model.findById(before).exec();
      if (cursor) {
        query["createdAt"] = { $lt: cursor.createdAt };
      }
    }

    const docs = await this.model
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();

    return docs.map((d) => this.toEntity(d));
  }

  async create(data: CreateMessageInput): Promise<MessageEntity> {
    const doc = await this.model.create({
      conversationId: data.conversationId,
      senderId: data.senderId,
      content: data.content,
      type: data.type,
    });
    return this.toEntity(doc);
  }

  async update(id: string, data: UpdateMessageInput): Promise<MessageEntity> {
    const doc = await this.model
      .findByIdAndUpdate(id, { $set: data }, { new: true })
      .exec();
    if (!doc) throw new NotFoundException(`Message ${id} not found`);
    return this.toEntity(doc);
  }

  async countUnread(
    conversationId: string,
    since: Date,
    excludeSenderId: string,
  ): Promise<number> {
    return this.model.countDocuments({
      conversationId,
      createdAt: { $gt: since },
      senderId: { $ne: excludeSenderId },
    });
  }

  async updateStatusBySender(
    conversationId: string,
    senderId: string,
    fromStatuses: MessageStatus[],
    toStatus: MessageStatus,
  ): Promise<number> {
    const result = await this.model.updateMany(
      {
        conversationId,
        senderId,
        status: { $in: fromStatuses },
        isDeleted: false,
      },
      { $set: { status: toStatus } },
    );
    return result.modifiedCount;
  }

  private toEntity(doc: Message): MessageEntity {
    return MessageEntity.create({
      id: (doc._id as Types.ObjectId).toString(),
      conversationId: doc.conversationId,
      senderId: doc.senderId,
      content: doc.content,
      type: doc.type,
      status: doc.status,
      isDeleted: doc.isDeleted,
      isEdited: doc.isEdited,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  }
}
