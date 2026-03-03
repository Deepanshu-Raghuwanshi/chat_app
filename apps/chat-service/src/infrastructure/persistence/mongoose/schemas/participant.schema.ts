import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

@Schema({ timestamps: true })
export class Participant extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Room', required: true })
  roomId!: string;

  @Prop({ required: true })
  userId!: string;

  @Prop({ enum: ['owner', 'admin', 'member'], default: 'member' })
  role!: string;

  @Prop({ default: Date.now })
  joinedAt!: Date;
}

export const ParticipantSchema = SchemaFactory.createForClass(Participant);
ParticipantSchema.index({ roomId: 1, userId: 1 }, { unique: true });
