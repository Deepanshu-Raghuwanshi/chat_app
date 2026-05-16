import {
  IsArray,
  IsIn,
  IsString,
  IsNotEmpty,
  MaxLength,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";
import { Type, Transform } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";

@ValidatorConstraint({ name: "LastMessageIsFromThem", async: false })
export class LastMessageIsFromThemConstraint implements ValidatorConstraintInterface {
  validate(messages: MessageContextItemDto[]): boolean {
    if (!Array.isArray(messages) || messages.length === 0) return true;
    return messages[messages.length - 1]?.role === "them";
  }

  defaultMessage(): string {
    return 'The last message in the context must have role "them"';
  }
}

export class MessageContextItemDto {
  @ApiProperty({
    enum: ["me", "them"],
    description:
      '"me" = the current user (reply sender). "them" = the other participant.',
  })
  @IsIn(["me", "them"])
  role!: "me" | "them";

  @ApiProperty({
    maxLength: 500,
    description: "Message text. Truncated to 500 chars by the client.",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  content!: string;
}

export class AiSmartReplyDto {
  @ApiProperty({
    type: [MessageContextItemDto],
    minItems: 1,
    maxItems: 10,
    description: "Conversation context — 1–10 messages, oldest first.",
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => MessageContextItemDto)
  @Validate(LastMessageIsFromThemConstraint)
  messages!: MessageContextItemDto[];
}
