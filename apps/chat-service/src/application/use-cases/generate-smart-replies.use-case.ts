import { Injectable, Inject } from "@nestjs/common";
import { AiSmartReplierPort } from "../ports/ai-smart-reply.port";

export interface GenerateSmartRepliesInput {
  userId: string;
  messages: Array<{ role: "me" | "them"; content: string }>;
}

@Injectable()
export class GenerateSmartRepliesUseCase {
  constructor(
    @Inject("AiSmartReplier")
    private readonly aiSmartReplier: AiSmartReplierPort,
  ) {}

  async execute(
    input: GenerateSmartRepliesInput,
  ): Promise<{ suggestions: string[] }> {
    const suggestions = await this.aiSmartReplier.generateReplies(
      input.messages,
    );
    return { suggestions };
  }
}
