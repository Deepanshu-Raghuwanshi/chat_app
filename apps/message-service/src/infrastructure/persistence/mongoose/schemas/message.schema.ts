import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Message extends Document {
  @Prop({ required: true, index: true })
  roomId!: string;

  @Prop({ required: true, index: true })
  senderId!: string;

  @Prop({ required: true })
  content!: string;

  @Prop({ enum: ['text', 'image', 'file'], default: 'text' })
  type!: string;

  @Prop()
  metadata?: string;

  @Prop({ default: false })
  isRead!: boolean;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
MessageSchema.index({ roomId: 1, createdAt: -1 });
