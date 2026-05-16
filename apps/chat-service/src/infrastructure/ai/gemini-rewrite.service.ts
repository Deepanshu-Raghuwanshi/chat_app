import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import {
  AiRewriterPort,
  RewriteTone,
} from "../../application/ports/ai-rewriter.port";

const PROMPTS: Record<RewriteTone, (text: string) => string> = {
  "fix-grammar": (text) =>
    `Fix the grammar, spelling, and punctuation of the following message. Return only the corrected message, no explanation:\n\n${text}`,
  professional: (text) =>
    `Rewrite the following message to be more professional and formal. Keep the same meaning. Return only the rewritten message, no explanation:\n\n${text}`,
  casual: (text) =>
    `Rewrite the following message to be more casual and friendly. Keep the same meaning. Return only the rewritten message, no explanation:\n\n${text}`,
  shorter: (text) =>
    `Rewrite the following message to be shorter and more concise. Keep the key information. Return only the rewritten message, no explanation:\n\n${text}`,
  longer: (text) =>
    `Expand the following message to be more detailed and elaborate. Add relevant context. Return only the expanded message, no explanation:\n\n${text}`,
};

const TIMEOUT_MS = 10_000;

@Injectable()
export class GeminiRewriteService implements AiRewriterPort {
  private readonly logger = new Logger(GeminiRewriteService.name);
  private readonly model: GenerativeModel;

  constructor(private readonly config: ConfigService) {
    const apiKey = config.get<string>("GEMINI_API_KEY")!;
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({
      model: "gemini-flash-latest",
      generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
    });
  }

  async rewrite(text: string, tone: RewriteTone): Promise<string> {
    const prompt = PROMPTS[tone](text);
    let timerId: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timerId = setTimeout(
        () => reject(new ServiceUnavailableException("AI provider timed out")),
        TIMEOUT_MS,
      );
    });

    try {
      const result = await Promise.race([
        this.model.generateContent(prompt),
        timeoutPromise,
      ]);
      return result.response.text().trim();
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      this.logger.error(`Gemini API call failed: ${message}`, stack);
      throw new ServiceUnavailableException("AI provider unavailable");
    } finally {
      clearTimeout(timerId);
    }
  }
}
