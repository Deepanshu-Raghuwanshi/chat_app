import {
  IsUUID,
  IsOptional,
  IsInt,
  IsString,
  Min,
  Max,
  MinLength,
  MaxLength,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";

export class CreateConversationDto {
  @ApiProperty({
    description: "UUID of the friend to start a conversation with",
    format: "uuid",
  })
  @IsUUID()
  targetUserId!: string;

  @ApiPropertyOptional({ description: "Display username of the target user" })
  @IsOptional()
  @IsString()
  targetUsername?: string;

  @ApiPropertyOptional({ description: "Full name of the target user" })
  @IsOptional()
  @IsString()
  targetFullName?: string;

  @ApiPropertyOptional({ description: "Avatar URL of the target user" })
  @IsOptional()
  @IsString()
  targetAvatarUrl?: string;

  @ApiPropertyOptional({
    description: "Display username of the requesting user",
  })
  @IsOptional()
  @IsString()
  callerUsername?: string;

  @ApiPropertyOptional({ description: "Full name of the requesting user" })
  @IsOptional()
  @IsString()
  callerFullName?: string;

  @ApiPropertyOptional({ description: "Avatar URL of the requesting user" })
  @IsOptional()
  @IsString()
  callerAvatarUrl?: string;
}

export class ListConversationsQueryDto {
  @ApiPropertyOptional({
    description:
      "Search term — min 1 char, max 100 chars. When present activates search mode; pagination params are ignored.",
    minLength: 1,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({
    format: "uuid",
    description: "Cursor — fetch conversations older than this ID",
  })
  @IsOptional()
  @IsUUID()
  before?: string;
}
