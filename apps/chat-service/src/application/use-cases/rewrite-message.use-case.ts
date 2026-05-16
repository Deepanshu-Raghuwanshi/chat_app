import { Injectable, Inject, BadRequestException } from "@nestjs/common";
import { AiRewriterPort, RewriteTone } from "../ports/ai-rewriter.port";

export interface RewriteMessageDto {
  userId: string;
  text: string;
  tone: RewriteTone;
}

@Injectable()
export class RewriteMessageUseCase {
  constructor(
    @Inject("AiRewriter")
    private readonly aiRewriter: AiRewriterPort,
  ) {}

  async execute(dto: RewriteMessageDto): Promise<{ rewrittenText: string }> {
    const trimmed = dto.text.trim();
    if (!trimmed) {
      throw new BadRequestException("Text cannot be empty");
    }
    const rewrittenText = await this.aiRewriter.rewrite(trimmed, dto.tone);
    return { rewrittenText };
  }
}
