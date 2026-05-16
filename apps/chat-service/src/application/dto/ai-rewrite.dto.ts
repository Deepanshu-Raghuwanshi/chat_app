import { IsString, IsNotEmpty, MaxLength, IsEnum } from "class-validator";
import { Transform } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import { RewriteTone } from "../ports/ai-rewriter.port";

const TONE_VALUES: RewriteTone[] = [
  "fix-grammar",
  "professional",
  "casual",
  "shorter",
  "longer",
];

export class AiRewriteDto {
  @ApiProperty({
    description: "Draft message text to rewrite",
    minLength: 1,
    maxLength: 4000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  text!: string;

  @ApiProperty({ enum: TONE_VALUES, description: "Desired rewrite tone" })
  @IsEnum(TONE_VALUES)
  tone!: RewriteTone;
}
