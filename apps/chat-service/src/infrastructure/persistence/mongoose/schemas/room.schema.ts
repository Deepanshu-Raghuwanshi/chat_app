import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Room extends Document {
  @Prop({ required: true })
  name!: string;

  @Prop()
  description?: string;

  @Prop({ default: false })
  isGroup!: boolean;

  @Prop({ required: true })
  createdBy!: string;
}

export const RoomSchema = SchemaFactory.createForClass(Room);
