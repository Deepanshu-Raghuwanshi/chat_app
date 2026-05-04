import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { MessageStatus, MessageType } from '@kafka-events';

@Schema({ timestamps: true })
export class Message extends Document {
  @Prop({ required: true, index: true })
  conversationId!: string;

  @Prop({ required: true })
  senderId!: string;

  @Prop({ required: true })
  content!: string;

  @Prop({ enum: Object.values(MessageType), default: MessageType.TEXT })
  type!: MessageType;

  @Prop({ enum: Object.values(MessageStatus), default: MessageStatus.SENT })
  status!: MessageStatus;

  @Prop({ default: false })
  isDeleted!: boolean;

  @Prop({ default: false })
  isEdited!: boolean;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

MessageSchema.index({ conversationId: 1, createdAt: -1 });
