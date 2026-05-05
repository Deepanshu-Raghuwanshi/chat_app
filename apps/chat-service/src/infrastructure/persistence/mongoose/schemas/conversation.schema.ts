import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

@Schema({ timestamps: true })
export class Conversation extends Document {
  @Prop({ required: true, index: true })
  participant1Id!: string;

  @Prop({ required: true, index: true })
  participant2Id!: string;

  @Prop({
    type: {
      messageId: { type: String, required: true },
      senderId: { type: String, required: true },
      content: { type: String, required: true },
      sentAt: { type: Date, required: true },
    },
    _id: false,
  })
  lastMessage?: {
    messageId: string;
    senderId: string;
    content: string;
    sentAt: Date;
  };

  @Prop({ default: Date.now, index: true })
  lastActivityAt!: Date;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

ConversationSchema.index(
  { participant1Id: 1, participant2Id: 1 },
  { unique: true },
);
ConversationSchema.index({ lastActivityAt: -1 });
