import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

@Schema({ timestamps: true })
export class ConversationParticipant extends Document {
  @Prop({ required: true, index: true })
  conversationId!: string;

  @Prop({ required: true, index: true })
  userId!: string;

  @Prop()
  lastReadAt?: Date;
}

export const ConversationParticipantSchema = SchemaFactory.createForClass(
  ConversationParticipant,
);

ConversationParticipantSchema.index(
  { conversationId: 1, userId: 1 },
  { unique: true },
);
